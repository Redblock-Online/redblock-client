import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Represents a collision box in 3D space
 */
export interface CollisionBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
  object?: THREE.Object3D;
}

/**
 * Physics system using Rapier3D for realistic physics simulation
 * Maintains API compatibility with the old CollisionSystem
 */
export class PhysicsSystem {
  private world!: RAPIER.World;
  private characterController!: RAPIER.KinematicCharacterController;
  private playerBody!: RAPIER.RigidBody;
  private playerCollider!: RAPIER.Collider;
  private initialized = false;
  private physicsEnabled = false; // Physics paused by default
  private colliders: Map<CollisionBox, RAPIER.Collider> = new Map();
  
  // Fixed timestep accumulator for stable, optimized physics
  private readonly fixedTimeStep = 1 / 60; // 60Hz physics updates
  private accumulator = 0;
  
  public playerRadius = 0.25; // Reduced from 0.3 to 0.25 to avoid getting stuck on edges
  public playerHeight = 1.5;
  private stepHeight = 0.2; // Reduced from 0.5 to 0.2 - only small steps can be climbed
  
  // Temporary vectors to avoid allocations
  private _tempVec = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector3();

  constructor() {
    this.initRapier();
  }

  private async initRapier() {
    await RAPIER.init();
    
    // Create physics world with gravity (reduced precision for performance)
    const gravity = new RAPIER.Vector3(0.0, -24.0, 0.0);
    this.world = new RAPIER.World(gravity);
    
    // Reduce integration parameters for better performance
    // Default is usually 4 substeps - we reduce to 2 for speed
    this.world.integrationParameters.numSolverIterations = 2; // Reduced from 4
    this.world.integrationParameters.numInternalPgsIterations = 1; // Minimal
    
    // Create character controller with small offset to smooth out collisions
    this.characterController = this.world.createCharacterController(0.01);
    // min_width reduced to 0.1 to avoid getting stuck on edges
    this.characterController.enableAutostep(this.stepHeight, 0.1, true);
    // Disable snap-to-ground completely to prevent vertical jitter
    // this.characterController.enableSnapToGround(0.02);
    this.characterController.setSlideEnabled(true);
    // Ensure character controller doesn't apply any filtering by default
    this.characterController.setApplyImpulsesToDynamicBodies(false);
    console.log("[PhysicsSystem] Character controller configured with offset: 0.01, autostep: 0.2/0.1, snap-to-ground: DISABLED");
    
    // Create player rigid body (kinematic position-based)
    // Position represents the BASE of the player (feet level)
    const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, 2, 0);
    this.playerBody = this.world.createRigidBody(playerBodyDesc);
    
    // Create player capsule collider
    // Capsule halfHeight is the cylinder part (excluding the radius spheres)
    const capsuleHalfHeight = (this.playerHeight - 2 * this.playerRadius) / 2;
    
    // Offset collider so bottom is at rigid body position (feet level)
    // Center of capsule should be at playerHeight/2 above the feet
    const playerColliderDesc = RAPIER.ColliderDesc.capsule(
      capsuleHalfHeight,
      this.playerRadius
    )
      .setTranslation(0, this.playerHeight / 2, 0)
      .setSensor(false)  // Player is solid, not a sensor
      .setCollisionGroups(0xFFFF_FFFF);  // Collide with everything
    
    this.playerCollider = this.world.createCollider(
      playerColliderDesc,
      this.playerBody
    );
    
    console.log("[PhysicsSystem] Player collider created:");
    console.log("  Capsule halfHeight:", capsuleHalfHeight);
    console.log("  Capsule radius:", this.playerRadius);
    console.log("  Capsule Y offset:", this.playerHeight / 2);
    console.log("  Total player height:", this.playerHeight);
    console.log("  Collision groups:", this.playerCollider.collisionGroups());
    
    this.initialized = true;
    console.log("[PhysicsSystem] Rapier initialized successfully");
  }

  /**
   * Wait for Rapier to initialize
   */
  public async waitForInit(): Promise<void> {
    while (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Add a collision box to the system
   * @param box - Collision box definition
   * @param rotation - Optional rotation quaternion for rotated colliders
   */
  public addCollider(box: CollisionBox, rotation?: THREE.Quaternion): void {
    if (!this.initialized) {
      console.warn("[PhysicsSystem] Not initialized yet, queueing collider");
      setTimeout(() => this.addCollider(box, rotation), 50);
      return;
    }

    const size = this._tempVec.subVectors(box.max, box.min);
    const center = this._tempVec2.addVectors(box.min, box.max).multiplyScalar(0.5);
    
    // Create static rigid body
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(center.x, center.y, center.z);
    
    // Apply rotation if provided
    if (rotation) {
      const rapierRotation = new RAPIER.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      bodyDesc.setRotation(rapierRotation);
    }
    
    const body = this.world.createRigidBody(bodyDesc);
    
    // Create cuboid collider (explicitly not a sensor, solid for raycasts)
    // Set collision groups: 0xFFFF for membership (all groups), 0xFFFF for filter (collides with all)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    )
      .setSensor(false)  // Explicitly mark as solid, not a sensor
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
      .setCollisionGroups(0xFFFF_FFFF);  // Collide with everything
    
    const collider = this.world.createCollider(colliderDesc, body);
    this.colliders.set(box, collider);
    
    console.log("[PhysicsSystem] 🔧 Ground collider - isSensor:", collider.isSensor(), 
                "handle:", collider.handle,
                "groups:", collider.collisionGroups());
    
    console.log("[PhysicsSystem] ✅ Collider added at Y:", center.y.toFixed(1), "size:", `${size.x.toFixed(0)}x${size.y.toFixed(0)}x${size.z.toFixed(0)}`, "(total:", this.colliders.size + ")");
  }

  /**
   * Add a collision box from a THREE.Object3D
   * For rotated/scaled objects, uses actual dimensions and rotation instead of AABB
   */
  public addColliderFromObject(object: THREE.Object3D, useActualShape: boolean = false): CollisionBox {
    if (useActualShape && object instanceof THREE.Mesh) {
      // Get the actual scale and rotation from the object
      const worldScale = new THREE.Vector3();
      const worldRotation = new THREE.Quaternion();
      const worldPosition = new THREE.Vector3();
      
      object.updateWorldMatrix(true, false);
      object.matrixWorld.decompose(worldPosition, worldRotation, worldScale);
      
      // Get base geometry size (assuming BoxGeometry with size 1x1x1)
      // For Cube class, the base geometry is 1x1x1, then scaled by baseScale (0.4)
      // Then further scaled by object.scale
      const baseSize = 1.0;
      const actualSize = new THREE.Vector3(
        baseSize * Math.abs(worldScale.x),
        baseSize * Math.abs(worldScale.y),
        baseSize * Math.abs(worldScale.z)
      );
      
      // Calculate min/max from center and size
      const halfSize = actualSize.clone().multiplyScalar(0.5);
      const box: CollisionBox = {
        min: worldPosition.clone().sub(halfSize),
        max: worldPosition.clone().add(halfSize),
        object,
      };
      
      // Add collider with rotation
      this.addCollider(box, worldRotation);
      return box;
    } else {
      // Fallback to AABB for non-mesh objects or when useActualShape is false
      const box = new THREE.Box3().setFromObject(object);
      const collider: CollisionBox = {
        min: box.min.clone(),
        max: box.max.clone(),
        object,
      };
      this.addCollider(collider);
      return collider;
    }
  }

  /**
   * Remove a specific collider
   */
  public removeCollider(collider: CollisionBox): void {
    const rapierCollider = this.colliders.get(collider);
    if (rapierCollider) {
      const body = rapierCollider.parent();
      if (body) {
        this.world.removeRigidBody(body);
      }
      this.colliders.delete(collider);
    }
  }

  /**
   * Remove all colliders associated with an object
   */
  public removeCollidersForObject(object: THREE.Object3D): void {
    const toRemove: CollisionBox[] = [];
    this.colliders.forEach((_, box) => {
      if (box.object === object) {
        toRemove.push(box);
      }
    });
    toRemove.forEach(box => this.removeCollider(box));
  }

  /**
   * Clear all colliders (except player)
   */
  public clearAll(): void {
    const toRemove = Array.from(this.colliders.keys());
    toRemove.forEach(box => this.removeCollider(box));
  }

  /**
   * Get all colliders
   */
  public getColliders(): CollisionBox[] {
    return Array.from(this.colliders.keys());
  }

  /**
   * Check if a capsule collides with any collider
   * Legacy method for compatibility
   */
  public checkCapsuleCollision(
    bottomCenter: THREE.Vector3,
    topCenter: THREE.Vector3,
    radius: number
  ): THREE.Vector3 | null {
    if (!this.initialized) return null;

    const center = this._tempVec.addVectors(bottomCenter, topCenter).multiplyScalar(0.5);
    const totalHeight = bottomCenter.distanceTo(topCenter);
    
    // Rapier capsule: halfHeight is the CYLINDER part (excluding radius spheres)
    // Total height = 2 * (halfHeight + radius)
    // So: halfHeight = (totalHeight / 2) - radius
    const capsuleHalfHeight = Math.max(0.01, (totalHeight / 2) - radius);
    
    // Create temporary collider for testing
    const shape = new RAPIER.Capsule(capsuleHalfHeight, radius);
    const translation = new RAPIER.Vector3(center.x, center.y, center.z);
    const rotation = new RAPIER.Quaternion(0, 0, 0, 1);
    
    let hasCollision = false;
    this.world.intersectionsWithShape(translation, rotation, shape, (collider) => {
      // Ignore player's own collider
      if (collider.handle !== this.playerCollider.handle) {
        hasCollision = true;
        return false; // Stop checking
      }
      return true; // Continue checking
    });
    
    if (hasCollision) {
      // Return a default normal (up vector) for compatibility
      return new THREE.Vector3(0, 1, 0);
    }
    
    return null;
  }

  /**
   * Check if a sphere collides with any collider
   */
  public checkSphereCollision(
    center: THREE.Vector3,
    radius: number
  ): THREE.Vector3 | null {
    return this.checkCapsuleCollision(center, center, radius);
  }

  /**
   * Push player out if they are inside a collider
   * Uses Rapier's character controller for smooth resolution
   */
  public pushOutOfColliders(position: THREE.Vector3, _onGround: boolean = false): THREE.Vector3 {
    if (!this.initialized) return position.clone();

    // Sync player body position
    this.playerBody.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true
    );
    
    // For now, just return the position
    // Rapier's character controller handles depenetration in slidePlayerAlongWalls
    return position.clone();
  }

  /**
   * Slide the player along walls when colliding
   * Uses Rapier's character controller for proper physics
   */
  public slidePlayerAlongWalls(
    position: THREE.Vector3,
    desiredMovement: THREE.Vector3
  ): THREE.Vector3 {
    if (!this.initialized) {
      console.warn("[PhysicsSystem] slidePlayerAlongWalls: Not initialized");
      return position.clone();
    }
    
    if (!this.physicsEnabled) {
      console.warn("[PhysicsSystem] slidePlayerAlongWalls: Physics not enabled");
      return position.clone();
    }
    
    if (desiredMovement.lengthSq() === 0) {
      // console.log("[PhysicsSystem] slidePlayerAlongWalls: Zero movement, skipping");
      return position.clone();
    }

    // console.log("[PhysicsSystem] 🎮 slidePlayerAlongWalls");
    // console.log("  Input pos Y:", position.y.toFixed(3));
    // console.log("  Desired movement:", desiredMovement.toArray().map(v => v.toFixed(3)));
    // console.log("  Player height:", this.playerHeight, "radius:", this.playerRadius);

    // CRITICAL: Ensure body position matches game position
    const currentPos = this.playerBody.translation();
    // console.log("  Player body pos Y:", currentPos.y.toFixed(3));
    const posDiff = Math.abs(currentPos.y - position.y);
    if (posDiff > 0.1) {
      // console.warn("[PhysicsSystem] Position mismatch - body:", currentPos.y.toFixed(2), "game:", position.y.toFixed(2));
      this.playerBody.setTranslation(
        new RAPIER.Vector3(position.x, position.y, position.z),
        true
      );
    }

    // Compute movement using character controller
    const movementVector = new RAPIER.Vector3(
      desiredMovement.x,
      desiredMovement.y,
      desiredMovement.z
    );

    // Use character controller - it should automatically detect collisions
    this.characterController.computeColliderMovement(
      this.playerCollider,
      movementVector
    );

    const correctedMovement = this.characterController.computedMovement();
    const newPos = new THREE.Vector3(
      position.x + correctedMovement.x,
      position.y + correctedMovement.y,
      position.z + correctedMovement.z
    );
    
    const _isGrounded = this.characterController.computedGrounded();
    
    // console.log("  Corrected movement Y:", correctedMovement.y.toFixed(3));
    // console.log("  New pos Y:", newPos.y.toFixed(3));
    // console.log("  Grounded:", isGrounded);
    // console.log("  Num collisions:", this.characterController.numComputedCollisions());
    // console.log("  Character controller offset: 0.0, snap: 0.02");
    
    // Update rigid body position for next frame
    this.playerBody.setTranslation(
      new RAPIER.Vector3(newPos.x, newPos.y, newPos.z),
      true
    );

    return newPos;
  }

  /**
   * Check if the player is standing on ground
   * Returns the ground Y position if on ground, null otherwise
   */
  public checkGroundCollision(position: THREE.Vector3, maxDistance: number = 100): number | null {
    if (!this.initialized) return null;

    // CRITICAL: Sync player body position BEFORE raycasting
    this.playerBody.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true
    );

    const rayOrigin = new RAPIER.Vector3(position.x, position.y, position.z);
    const rayDir = new RAPIER.Vector3(0, -1, 0);
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    const maxToi = maxDistance;
    
    // Debug logging disabled for performance

    let closestGroundY: number | null = null;

    // Cast ray with filter to exclude player collider (same pattern as slidePlayerAlongWalls)
    const filterFlags = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
    const filterPredicate = (collider: RAPIER.Collider) => {
      return collider.handle !== this.playerCollider.handle;
    };

    // Use castRayAndGetNormal which supports filtering
    const hit = this.world.castRayAndGetNormal(
      ray, 
      maxToi, 
      true,
      filterFlags,
      undefined,
      undefined,
      undefined,
      filterPredicate
    );
    
    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      closestGroundY = hitPoint.y;
    }

    return closestGroundY;
  }

  /**
   * Check if player is grounded using character controller
   */
  public isGrounded(): boolean {
    if (!this.initialized) return false;
    return this.characterController.computedGrounded();
  }

  /**
   * Set player dimensions
   */
  public setPlayerDimensions(radius: number, height: number): void {
    this.playerRadius = radius;
    this.playerHeight = height;
    
    if (this.initialized && this.playerCollider && this.playerBody) {
      // Remove old collider
      this.world.removeCollider(this.playerCollider, false);
      
      // Create new collider with updated dimensions
      const capsuleHeight = height - 2 * radius;
      const playerColliderDesc = RAPIER.ColliderDesc.capsule(
        capsuleHeight / 2,
        radius
      ).setTranslation(0, height / 2, 0);
      
      this.playerCollider = this.world.createCollider(
        playerColliderDesc,
        this.playerBody
      );
    }
  }

  /**
   * Set step height (currently disabled - autostep is off)
   */
  public setStepHeight(height: number): void {
    this.stepHeight = height;
    // Autostep is disabled to prevent climbing blocks without jumping
    // if (this.initialized && this.characterController) {
    //   this.characterController.enableAutostep(height, 0.1, true);
    // }
  }

  /**
   * Update physics world with fixed timestep accumulator
   * Call this every frame - internally steps physics at fixed 60Hz
   */
  public step(deltaTime: number): void {
    if (!this.initialized || !this.physicsEnabled) return;
    
    // Clamp delta time to prevent spiral of death
    const clampedDelta = Math.min(deltaTime, 0.1);
    
    // Accumulate time
    this.accumulator += clampedDelta;
    
    // Step physics at fixed timestep (more stable and can skip steps when slow)
    let stepsThisFrame = 0;
    const maxStepsPerFrame = 3; // Prevent too many steps on slow frames
    
    while (this.accumulator >= this.fixedTimeStep && stepsThisFrame < maxStepsPerFrame) {
      this.world.step();
      this.accumulator -= this.fixedTimeStep;
      stepsThisFrame++;
    }
    
    // If we hit max steps, discard remaining time to prevent spiral
    if (stepsThisFrame >= maxStepsPerFrame) {
      this.accumulator = 0;
    }
  }

  /**
   * Enable physics simulation (call when level starts)
   */
  public enablePhysics(): void {
    this.physicsEnabled = true;
    console.log("[PhysicsSystem] ✅ Physics ENABLED - gravity and collisions active");
  }

  /**
   * Disable physics simulation (call when level ends or pauses)
   */
  public disablePhysics(): void {
    this.physicsEnabled = false;
    console.log("[PhysicsSystem] ⏸️  Physics DISABLED - no gravity or collisions");
  }

  /**
   * Check if physics is currently enabled
   */
  public isPhysicsEnabled(): boolean {
    return this.physicsEnabled;
  }

  /**
   * Get player position from physics body
   */
  public getPlayerPosition(): THREE.Vector3 {
    if (!this.initialized) return new THREE.Vector3();
    const pos = this.playerBody.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  /**
   * Set player position
   */
  public setPlayerPosition(position: THREE.Vector3): void {
    if (!this.initialized) return;
    this.playerBody.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true
    );
  }

  /**
   * Debug: Draw collision boxes
   */
  public debugDrawColliders(scene: THREE.Scene): THREE.LineSegments[] {
    const lines: THREE.LineSegments[] = [];
    
    this.colliders.forEach((_, collider) => {
      const box = new THREE.Box3(collider.min, collider.max);
      const helper = new THREE.Box3Helper(box, 0x00ff00);
      scene.add(helper);
      lines.push(helper);
    });

    return lines;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    if (this.initialized) {
      this.world.free();
      this.initialized = false;
    }
  }
}
