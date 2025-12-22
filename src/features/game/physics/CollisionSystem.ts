import * as THREE from "three";

/**
 * Represents a collision box in 3D space
 */
export interface CollisionBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
  object?: THREE.Object3D; // Optional reference to the 3D object
}

/**
 * Collision detection and resolution system
 * Handles AABB (Axis-Aligned Bounding Box) collisions
 */
export class CollisionSystem {
  private colliders: CollisionBox[] = [];
  public playerRadius = 0.3; // Player capsule radius (public for controls access)
  public playerHeight = 1.8; // Player height (public for controls access)
  private stepHeight = 0.5; // Maximum step height player can climb
  
  // Temporary vectors to avoid allocations
  private _tempVec = new THREE.Vector3();
  private _tempBox = new THREE.Box3();

  /**
   * Add a collision box to the system
   */
  public addCollider(box: CollisionBox): void {
    this.colliders.push(box);
  }

  /**
   * Add a collision box from a THREE.Object3D
   * Automatically calculates the bounding box
   */
  public addColliderFromObject(object: THREE.Object3D): CollisionBox {
    const box = new THREE.Box3().setFromObject(object);
    const collider: CollisionBox = {
      min: box.min.clone(),
      max: box.max.clone(),
      object,
    };
    this.colliders.push(collider);
    return collider;
  }

  /**
   * Remove a specific collider
   */
  public removeCollider(collider: CollisionBox): void {
    const index = this.colliders.indexOf(collider);
    if (index !== -1) {
      this.colliders.splice(index, 1);
    }
  }

  /**
   * Remove all colliders associated with an object
   */
  public removeCollidersForObject(object: THREE.Object3D): void {
    this.colliders = this.colliders.filter((c) => c.object !== object);
  }

  /**
   * Clear all colliders
   */
  public clearAll(): void {
    this.colliders = [];
  }

  /**
   * Get all colliders
   */
  public getColliders(): CollisionBox[] {
    return this.colliders;
  }

  /**
   * Check if a capsule (player) collides with any collider
   * A capsule is defined by two sphere centers (top and bottom) and a radius
   * Returns the collision normal if there's a collision, null otherwise
   */
  public checkCapsuleCollision(
    bottomCenter: THREE.Vector3,
    topCenter: THREE.Vector3,
    radius: number
  ): THREE.Vector3 | null {
    let closestCollision: { normal: THREE.Vector3; penetration: number } | null = null;
    let maxPenetration = 0;

    for (const collider of this.colliders) {
      // Find the closest point on the capsule line segment to the box
      const capsuleAxis = new THREE.Vector3().subVectors(topCenter, bottomCenter);
      const capsuleLength = capsuleAxis.length();
      
      if (capsuleLength > 0) {
        capsuleAxis.normalize();
      }

      // Find the closest point on the box to the capsule line segment
      const closestPointOnCapsule = bottomCenter.clone();
      let minDistance = Infinity;
      const closestPointOnBox = new THREE.Vector3();

      // Sample points along the capsule
      const samples = 5;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const samplePoint = new THREE.Vector3().lerpVectors(bottomCenter, topCenter, t);
        
        // Find closest point on box to this sample point
        const boxPoint = this._tempVec.set(
          Math.max(collider.min.x, Math.min(samplePoint.x, collider.max.x)),
          Math.max(collider.min.y, Math.min(samplePoint.y, collider.max.y)),
          Math.max(collider.min.z, Math.min(samplePoint.z, collider.max.z))
        );

        const distance = samplePoint.distanceTo(boxPoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestPointOnCapsule.copy(samplePoint);
          closestPointOnBox.copy(boxPoint);
        }
      }

      // Check if there's a collision
      if (minDistance < radius) {
        const penetration = radius - minDistance;
        
        // Calculate collision normal (direction to push the capsule out)
        const normal = new THREE.Vector3().subVectors(closestPointOnCapsule, closestPointOnBox);
        
        // If normal is zero (capsule center is inside box), find the closest face
        if (normal.lengthSq() < 0.0001) {
          const center = closestPointOnCapsule;
          const distances = [
            Math.abs(center.x - collider.min.x),
            Math.abs(center.x - collider.max.x),
            Math.abs(center.y - collider.min.y),
            Math.abs(center.y - collider.max.y),
            Math.abs(center.z - collider.min.z),
            Math.abs(center.z - collider.max.z),
          ];
          const minDist = Math.min(...distances);
          const index = distances.indexOf(minDist);
          
          switch (index) {
            case 0: normal.set(-1, 0, 0); break;
            case 1: normal.set(1, 0, 0); break;
            case 2: normal.set(0, -1, 0); break;
            case 3: normal.set(0, 1, 0); break;
            case 4: normal.set(0, 0, -1); break;
            case 5: normal.set(0, 0, 1); break;
          }
        } else {
          normal.normalize();
        }
        
        // Keep track of the collision with maximum penetration
        if (penetration > maxPenetration) {
          maxPenetration = penetration;
          closestCollision = { normal, penetration };
        }
      }
    }
    
    return closestCollision ? closestCollision.normal : null;
  }

  /**
   * Check if a sphere collides with any collider (legacy method, kept for compatibility)
   * Now uses capsule collision with zero height
   */
  public checkSphereCollision(
    center: THREE.Vector3,
    radius: number
  ): THREE.Vector3 | null {
    // Use capsule collision with zero height (just a sphere)
    return this.checkCapsuleCollision(center, center, radius);
  }

  /**
   * Resolve player collision with the environment
   * Returns the corrected position after collision resolution
   */
  public resolvePlayerCollision(
    position: THREE.Vector3,
    _velocity: THREE.Vector3
  ): THREE.Vector3 {
    const newPosition = position.clone();
    const _playerBottom = newPosition.y;
    const _playerTop = newPosition.y + this.playerHeight;
    const playerCenter = newPosition.clone();
    playerCenter.y += this.playerHeight / 2;

    // Check collision at player's center (simplified capsule as sphere)
    const collision = this.checkSphereCollision(playerCenter, this.playerRadius);
    
    if (collision) {
      // Push player out of collision
      const penetrationDepth = this.playerRadius - playerCenter.distanceTo(
        this.getClosestPointOnColliders(playerCenter)
      );
      
      newPosition.addScaledVector(collision, penetrationDepth + 0.01);
    }

    return newPosition;
  }

  /**
   * Calculate minimum translation vector to separate capsule from all colliders
   * Uses single-step MTV calculation for stable, non-vibrating resolution
   */
  private calculateMTV(
    capsuleBottom: THREE.Vector3,
    capsuleTop: THREE.Vector3,
    radius: number
  ): THREE.Vector3 | null {
    let maxPenetration = 0;
    let bestMTV: THREE.Vector3 | null = null;
    let debugInfo = '';
    let colliderIndex = 0;
    
    // Check against all colliders
    for (const collider of this.colliders) {
      colliderIndex++;
      // Get capsule axis
      const capsuleAxis = this._tempVec.copy(capsuleTop).sub(capsuleBottom);
      const capsuleHeight = capsuleAxis.length();
      capsuleAxis.normalize();
      
      // Find closest point on collider to capsule
      const capsuleCenter = new THREE.Vector3()
        .addVectors(capsuleBottom, capsuleTop)
        .multiplyScalar(0.5);
      
      // Clamp to collider bounds
      const closestPoint = new THREE.Vector3(
        Math.max(collider.min.x, Math.min(capsuleCenter.x, collider.max.x)),
        Math.max(collider.min.y, Math.min(capsuleCenter.y, collider.max.y)),
        Math.max(collider.min.z, Math.min(capsuleCenter.z, collider.max.z))
      );
      
      // Find closest point on capsule line segment
      const toBB = closestPoint.clone().sub(capsuleBottom);
      const t = Math.max(0, Math.min(capsuleHeight, toBB.dot(capsuleAxis)));
      const closestOnCapsule = capsuleBottom.clone().addScaledVector(capsuleAxis, t);
      
      // Calculate penetration
      const diff = closestOnCapsule.clone().sub(closestPoint);
      const dist = diff.length();
      const penetration = radius - dist;
      
      // Only consider penetration if it's actually penetrating (positive value)
      if (penetration > 0 && penetration > maxPenetration) {
        maxPenetration = penetration;
        
        // Normal points from box to capsule (push capsule away from box)
        let normal: THREE.Vector3;
        if (dist > 0.0001) {
          normal = diff.clone().normalize();
        } else {
          // Capsule line passes through or is exactly on box surface
          // Use direction from box center to capsule center
          const boxCenter = new THREE.Vector3()
            .addVectors(collider.min, collider.max)
            .multiplyScalar(0.5);
          normal = capsuleCenter.clone().sub(boxCenter);
          if (normal.lengthSq() < 0.0001) {
            // Capsule center is at box center - default to up
            normal = new THREE.Vector3(0, 1, 0);
          } else {
            normal.normalize();
          }
        }
        bestMTV = normal.multiplyScalar(penetration);
        const colliderSize = new THREE.Vector3().subVectors(collider.max, collider.min);
        debugInfo = `[Collider ${colliderIndex}] pen=${penetration.toFixed(3)}, dist=${dist.toFixed(3)}, normal=(${normal.x.toFixed(2)},${normal.y.toFixed(2)},${normal.z.toFixed(2)}), box min=(${collider.min.x.toFixed(1)},${collider.min.y.toFixed(1)},${collider.min.z.toFixed(1)}), box max=(${collider.max.x.toFixed(1)},${collider.max.y.toFixed(1)},${collider.max.z.toFixed(1)}), size=(${colliderSize.x.toFixed(1)},${colliderSize.y.toFixed(1)},${colliderSize.z.toFixed(1)}), capsuleCenter=(${capsuleCenter.x.toFixed(1)},${capsuleCenter.y.toFixed(1)},${capsuleCenter.z.toFixed(1)})`;
      }
    }
    
    // if (bestMTV && maxPenetration > 0.01) {
    //   console.log(`[MTV Calc] ${debugInfo}`);
    // }
    
    return bestMTV;
  }

  /**
   * Push player out if they are inside a collider
   * Uses single-step MTV for stable, non-vibrating resolution
   */
  public pushOutOfColliders(position: THREE.Vector3, onGround: boolean = false): THREE.Vector3 {
    const capsuleBottom = position.clone();
    capsuleBottom.y += this.playerRadius;
    const capsuleTop = position.clone();
    capsuleTop.y += this.playerHeight - this.playerRadius;
    
    // console.log(`[PushOut] Player pos: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}), capsuleBottom: (${capsuleBottom.x.toFixed(2)}, ${capsuleBottom.y.toFixed(2)}, ${capsuleBottom.z.toFixed(2)}), capsuleTop: (${capsuleTop.x.toFixed(2)}, ${capsuleTop.y.toFixed(2)}, ${capsuleTop.z.toFixed(2)}), radius: ${this.playerRadius}`);
    
    const mtv = this.calculateMTV(capsuleBottom, capsuleTop, this.playerRadius);
    
    if (!mtv) {
      return position; // No collision
    }
    
    // console.log(`[Collision] MTV: (${mtv.x.toFixed(3)}, ${mtv.y.toFixed(3)}, ${mtv.z.toFixed(3)}), onGround: ${onGround}`);
    
    const correctedPosition = position.clone();
    
    // Always apply full MTV - don't special-case "onGround" to prevent vibration
    correctedPosition.add(mtv.multiplyScalar(1.01));
    // console.log(`[Collision] Corrected: (${correctedPosition.x.toFixed(2)}, ${correctedPosition.y.toFixed(2)}, ${correctedPosition.z.toFixed(2)})`);
    
    return correctedPosition;
  }

  /**
   * Swept collision detection - finds the first collision along the movement path
   * Prevents tunneling through thin walls at high speeds
   */
  private sweptCapsuleCollision(
    start: THREE.Vector3,
    movement: THREE.Vector3
  ): { position: THREE.Vector3; t: number; normal: THREE.Vector3 | null } {
    const capsuleBottom = start.clone();
    capsuleBottom.y += this.playerRadius;
    const capsuleTop = start.clone();
    capsuleTop.y += this.playerHeight - this.playerRadius;
    
    let minT = 1.0; // Fraction of movement completed
    let hitNormal: THREE.Vector3 | null = null;
    
    // Substep the movement to detect collisions
    const substeps = Math.max(1, Math.ceil(movement.length() / 0.05)); // 5cm substeps (more precise)
    const substepMovement = movement.clone().divideScalar(substeps);
    
    for (let step = 0; step < substeps; step++) {
      const testBottom = capsuleBottom.clone().addScaledVector(substepMovement, step);
      const testTop = capsuleTop.clone().addScaledVector(substepMovement, step);
      
      const collision = this.checkCapsuleCollision(testBottom, testTop, this.playerRadius);
      
      if (collision) {
        // Stop slightly before collision point to prevent penetration
        minT = Math.max(0, (step - 1) / substeps);
        hitNormal = collision.clone().normalize();
        break;
      }
    }
    
    const finalPosition = start.clone().addScaledVector(movement, minT);
    return { position: finalPosition, t: minT, normal: hitNormal };
  }

  /**
   * Slide the player along walls when colliding
   * Uses swept collision detection to prevent tunneling
   * Single-step depenetration for stability
   */
  public slidePlayerAlongWalls(
    position: THREE.Vector3,
    desiredMovement: THREE.Vector3
  ): THREE.Vector3 {
    if (desiredMovement.lengthSq() === 0) {
      return position; // No movement
    }

    // First, ensure player is not inside a collider using MTV
    const safePosition = this.pushOutOfColliders(position, false);

    const maxBounces = 3; // Number of slides along walls
    const currentPosition = safePosition.clone();
    const remainingMovement = desiredMovement.clone();
    
    for (let bounce = 0; bounce < maxBounces; bounce++) {
      if (remainingMovement.lengthSq() < 0.0001) {
        break; // Movement too small, stop
      }

      // Use swept collision detection
      const swept = this.sweptCapsuleCollision(currentPosition, remainingMovement);
      
      currentPosition.copy(swept.position);
      
      if (swept.t >= 1.0 || !swept.normal) {
        // Completed full movement without collision
        break;
      }
      
      // Depenetrate using MTV
      const depenetratedPos = this.pushOutOfColliders(currentPosition, false);
      currentPosition.copy(depenetratedPos);
      
      // Calculate remaining movement by projecting onto the wall
      const remainingFraction = 1.0 - swept.t;
      const remainingLength = remainingMovement.length() * remainingFraction;
      
      // Project remaining movement onto collision plane
      const dot = remainingMovement.dot(swept.normal);
      remainingMovement.addScaledVector(swept.normal, -dot);
      remainingMovement.normalize().multiplyScalar(remainingLength * 0.98); // Small damping to prevent infinite sliding
    }
    
    return currentPosition;
  }

  /**
   * Check if the player is standing on ground
   * Returns the ground Y position if on ground, null otherwise
   */
  public checkGroundCollision(position: THREE.Vector3, maxDistance: number = 100): number | null {
    const rayStart = position.clone();
    const rayEnd = position.clone();
    rayEnd.y -= maxDistance; // Check far below

    let closestGroundY: number | null = null;

    for (const collider of this.colliders) {
      // Check if ray intersects with the top of the collider (XZ plane)
      if (
        rayStart.x >= collider.min.x - this.playerRadius &&
        rayStart.x <= collider.max.x + this.playerRadius &&
        rayStart.z >= collider.min.z - this.playerRadius &&
        rayStart.z <= collider.max.z + this.playerRadius
      ) {
        // Check if we're above the collider and the ray passes through its top
        if (rayStart.y >= collider.max.y && rayEnd.y <= collider.max.y) {
          if (closestGroundY === null || collider.max.y > closestGroundY) {
            closestGroundY = collider.max.y;
          }
        }
      }
    }

    return closestGroundY;
  }

  /**
   * Get the closest point on any collider to a given point
   */
  private getClosestPointOnColliders(point: THREE.Vector3): THREE.Vector3 {
    const closestPoint = new THREE.Vector3();
    let minDistance = Infinity;

    for (const collider of this.colliders) {
      const closest = this._tempVec.set(
        Math.max(collider.min.x, Math.min(point.x, collider.max.x)),
        Math.max(collider.min.y, Math.min(point.y, collider.max.y)),
        Math.max(collider.min.z, Math.min(point.z, collider.max.z))
      );

      const distance = closest.distanceTo(point);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint.copy(closest);
      }
    }

    return closestPoint;
  }

  /**
   * Set player dimensions
   */
  public setPlayerDimensions(radius: number, height: number): void {
    this.playerRadius = radius;
    this.playerHeight = height;
  }

  /**
   * Set step height (max height player can climb)
   */
  public setStepHeight(height: number): void {
    this.stepHeight = height;
  }

  /**
   * Debug: Draw collision boxes (for visualization)
   */
  public debugDrawColliders(scene: THREE.Scene): THREE.LineSegments[] {
    const lines: THREE.LineSegments[] = [];
    
    for (const collider of this.colliders) {
      const box = new THREE.Box3(collider.min, collider.max);
      const helper = new THREE.Box3Helper(box, 0x00ff00);
      scene.add(helper);
      lines.push(helper);
    }

    return lines;
  }
}
