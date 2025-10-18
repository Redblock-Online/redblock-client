// src/systems/Controls.ts
import * as THREE from "three";
import type WSManager from "@/utils/ws/WSManager";
import type Target from "@/objects/Target";
import type { PhysicsSystem } from "./PhysicsSystem";
import { buildTargetsInfo } from "@/utils/targetsInfo";
export default class Controls {
  private camera: THREE.Camera;
  private domElement: HTMLCanvasElement;
  private pitchObject = new THREE.Object3D();
  private yawObject = new THREE.Object3D();
  private paused = false;
  private targets: Target[] = [];
  private sensitivity = 0.0002;
  private PI_2 = Math.PI / 2;
  private moveSpeed = 8;
  private velocity = new THREE.Vector3();
  private acceleration = 0.07;
  private damping = 0.9;
  private isCrouching = false;
  private standHeight = .8;  // Camera at eye level (lower for better ground feel)
  private crouchHeight = 0.4;  // Crouch camera height
  private heightLerp = 3;  // Very slow interpolation to prevent jitter
  private crouchSpeedFactor = 0.6;

  private velocityY = 0;
  private gravity = -24;
  private jumpStrength = 8;
  private terminalVelocity = -50;
  private airControlFactor = 1;
  private onGround = false;
  private lastGroundedTime = -Infinity;
  private lastJumpPressedTime = -Infinity;
  private jumpBuffer = 0.12;
  private coyoteTime = 0.1;
  private lastJumpTime = -Infinity;
  private jumpCooldown = 0.15;
  private groundCheckDistance = 0.15; // Distance to check for ground below player

  private keysPressed: Record<string, boolean> = {};
  private wsManager: WSManager;
  private getAmmountOfTargetsSelected: () => number;
  private collisionSystem?: PhysicsSystem;
  private lastYawPos = new THREE.Vector3();
  private lastYawRot = new THREE.Euler();
  private lastPitchRot = new THREE.Euler();

  // Room tracking
  private roomCoordX = 0;
  private roomCoordZ = 0;
  private roomSize = 20; // default room size (width/depth)
  private isEditorMode = false; // If true, disable movement limits

  private changeCheckAccumulator = 0;
  private changeCheckInterval = 1 / 24; // 24 times per second (~0.04166s)

  private lastSentPos = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  private lastSentRotX = Number.NaN; // pitch
  private lastSentRotY = Number.NaN; // yaw

  private posThreshold = 0.05; // 5 cm
  private rotThreshold = THREE.MathUtils.degToRad(0.9); // ~0.9°
  private posQuant = 0.01; // 1 cm
  private rotQuant = THREE.MathUtils.degToRad(0.1); // ~0.1°

  private nextSendAt = 0; // ms timestamp

  constructor(
    targets: Target[],
    camera: THREE.Camera,
    domElement: HTMLCanvasElement,
    wsManager: WSManager,
    getAmmountOfTargetsSelected: () => number,
    collisionSystem?: PhysicsSystem,
    isEditorMode: boolean = false
  ) {
    this.targets = targets;
    this.camera = camera;
    this.domElement = domElement;
    this.wsManager = wsManager;
    this.getAmmountOfTargetsSelected = getAmmountOfTargetsSelected;
    this.collisionSystem = collisionSystem;
    this.isEditorMode = isEditorMode;

    const VALORANT_M_YAW = 0.07; 
    const DEG_TO_RAD = Math.PI / 180;
    const valorantMultiplier = VALORANT_M_YAW * DEG_TO_RAD;

    // Initialize sensitivity from localStorage, fallback to default
    const saved = localStorage.getItem("mouseSensitivity");
    if (saved !== null) {
      const v = parseFloat(saved);
      if (!Number.isNaN(v)) {
        this.sensitivity = v * valorantMultiplier;
      }
    }
    // Bind input changes (works even if slider mounts later)
    const onSensitivityInput = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      if (target && target.id === "sensitivityRange") {
        const value = parseFloat(target.value);
        if (!Number.isNaN(value)) {
          this.sensitivity = value * valorantMultiplier;
        }
      }
    };
    document.addEventListener("input", onSensitivityInput, true);
    
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.pitchObject.position.y = this.standHeight;  // Start camera at eye level
    this.pitchObject.add(this.camera);
    this.yawObject.add(this.pitchObject);
    this.lastYawPos.copy(this.yawObject.position);
    this.lastYawRot.copy(this.yawObject.rotation);
    this.lastPitchRot.copy(this.pitchObject.rotation);

    this.initPointerLock();
    this.initKeyboardListeners();
  }

  get object() {
    return this.yawObject;
  }
  // Util: delta angular normalized [-PI, PI]
  private angleDelta(a: number, b: number) {
    const TWO_PI = Math.PI * 2;
    let d = (a - b) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    return d;
  }

  // Util: cuantizar
  private quantize(n: number, step: number) {
    return Math.round(n / step) * step;
  }

  // ====== checkChanges optimized ======
  private checkChanges() {
    const now = performance.now();
    if (now < this.nextSendAt) return; // 20 Hz cap

    const pos = this.yawObject.position;
    const rotX = this.yawObject.rotation.y; // yaw
    const rotY = this.pitchObject?.rotation.z ?? 0; // pitch (si tienes pitchObject)

    // Calcular cambios significativos
    const movedSq =
      this.lastSentPos.x === this.lastSentPos.x // NaN check
        ? pos.distanceToSquared(this.lastSentPos)
        : Number.POSITIVE_INFINITY;

    const moved = movedSq > this.posThreshold * this.posThreshold;

    const rotYDelta =
      this.lastSentRotY === this.lastSentRotY
        ? Math.abs(this.angleDelta(rotY, this.lastSentRotY))
        : Number.POSITIVE_INFINITY;

    const rotXDelta =
      this.lastSentRotX === this.lastSentRotX
        ? Math.abs(this.angleDelta(rotX, this.lastSentRotX))
        : Number.POSITIVE_INFINITY;

    // Rotación "relevante" solo si supera el umbral
    const rotatedRelevantly =
      rotYDelta > this.rotThreshold || rotXDelta > this.rotThreshold;

    // Si no hay movimiento ni rotación relevante, no enviamos
    if (!moved && !rotatedRelevantly) return;

    // Cuantizar para evitar ruido
    const qx = this.quantize(pos.x, this.posQuant);
    const qy = this.quantize(pos.y, this.posQuant);
    const qz = this.quantize(pos.z, this.posQuant);
    const qRotX = this.quantize(rotX, this.rotQuant);
    const qRotY = this.quantize(rotY, this.rotQuant);

    this.wsManager.sendPlayerUpdate({
      id: this.wsManager.getMe()!.id,
      local_player_position_x: qx,
      local_player_position_y: qy,
      local_player_position_z: qz,
      player_rotation_x: qRotX,
      player_rotation_y: qRotY,
      targetsInfo: buildTargetsInfo(
        this.targets,
        this.getAmmountOfTargetsSelected()
      ),
    });

    // Update last sent states
    this.lastSentPos.set(qx, qy, qz);
    this.lastSentRotX = qRotX;
    this.lastSentRotY = qRotY;

    // Next send not before 1/20s
    this.nextSendAt = now + 1000 / 20;
  }

  private initKeyboardListeners() {
    document.addEventListener("keydown", (e) => {
      if (this.paused) return;

      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;

      if (key === "c") {
        this.isCrouching = true;
      }

      if (e.code === "Space") {
        this.lastJumpPressedTime = performance.now() / 1000;
      }
    });

    document.addEventListener("keyup", (e) => {
      if (this.paused) return;

      const key = e.key.toLowerCase();
      this.keysPressed[key] = false;

      if (key === "c") {
        this.isCrouching = false;
      }
    });
  }

  public initPointerLock() {
    const onMouseMove = (event: MouseEvent) => {
      if (this.paused) return;
      if (document.pointerLockElement === this.domElement) {
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.yawObject.rotation.y -= movementX * this.sensitivity;
        this.pitchObject.rotation.z -= movementY * this.sensitivity;

        this.pitchObject.rotation.z = Math.max(
          -this.PI_2,
          Math.min(this.PI_2, this.pitchObject.rotation.z)
        );
      }
    };

    document.addEventListener("mousemove", onMouseMove, false);
  }
  // Update room information without moving the player
  public initPlayerRoom(x: number, z: number, size: number = 20) {
    this.roomCoordX = x;
    this.roomCoordZ = z;
    this.roomSize = size;
  }

  /**
   * Set paused state
   */
  public setPaused(paused: boolean) {
    this.paused = paused;
  }

  /**
   * Reset player physics state (velocity)
   * Call when level starts/ends
   */
  public resetPhysicsState() {
    this.velocityY = 0;
    this.velocity.set(0, 0, 0);
    this.onGround = false;
  }

  // Safe teleport (moves the parent, not the camera)
  public teleportTo(x: number, y: number, z: number, yawRad: number = 0) {
    this.initPlayerRoom(x, z, this.roomSize);
    this.yawObject.position.set(x, y, z);
    this.yawObject.rotation.set(0, yawRad, 0);
    this.pitchObject.rotation.set(0, 0, 0); // resetea pitch
    
    // CRITICAL: Sync physics body position after teleport
    if (this.collisionSystem) {
      this.collisionSystem.setPlayerPosition(this.yawObject.position);
      console.log("[Controls] Teleported to:", this.yawObject.position, "- physics body synced");
    }
    
    // resetea últimos estados para evitar falso positivo
    this.lastYawPos.copy(this.yawObject.position);
    this.lastYawRot.copy(this.yawObject.rotation);
    this.lastPitchRot.copy(this.pitchObject.rotation);
  }
  public update(deltaTime: number) {
    if (this.paused) {
      // Ensure no drift while paused
      this.velocity.set(0, 0, 0);
      this.velocityY = 0;
      return;
    }
    const targetDirection = new THREE.Vector3();

    if (this.keysPressed["a"]) targetDirection.z -= 1;
    if (this.keysPressed["d"]) targetDirection.z += 1;
    if (this.keysPressed["s"]) targetDirection.x -= 1;
    if (this.keysPressed["w"]) targetDirection.x += 1;

    // Only clamp position in normal game mode, not in editor
    if (!this.isEditorMode) {
      const halfRoom = this.roomSize / 2;
      this.yawObject.position.x = THREE.MathUtils.clamp(
        this.yawObject.position.x,
        this.roomCoordX - halfRoom,
        this.roomCoordX + halfRoom
      );
      this.yawObject.position.z = THREE.MathUtils.clamp(
        this.yawObject.position.z,
        this.roomCoordZ - halfRoom,
        this.roomCoordZ + halfRoom
      );
    }
    const effectiveSpeed =
      this.moveSpeed *
      (this.isCrouching ? this.crouchSpeedFactor : 1) *
      (this.onGround ? 1 : this.airControlFactor);

    targetDirection.normalize();
    targetDirection.applyQuaternion(this.yawObject.quaternion);
    targetDirection.y = 0;

    const desiredVel = targetDirection.clone().multiplyScalar(effectiveSpeed);
    const bothLateralPressed = !!this.keysPressed["a"] && !!this.keysPressed["d"];

    if (bothLateralPressed) {
      this.velocity.set(0, 0, 0)
    } else {
      this.velocity.lerp(desiredVel, this.acceleration);
    }
   
    this.velocity.multiplyScalar(Math.pow(this.damping, deltaTime));

    const now = performance.now() / 1000;
    const canUseBufferedJump =
      now - this.lastJumpPressedTime <= this.jumpBuffer;
    const isWithinCoyote =
      this.onGround || now - this.lastGroundedTime <= this.coyoteTime;
    const cooldownReady = now - this.lastJumpTime >= this.jumpCooldown;

    if (canUseBufferedJump && isWithinCoyote && cooldownReady) {
      this.velocityY = this.jumpStrength;
      this.lastJumpTime = now;
      this.onGround = false;
      this.isCrouching = false;

      this.lastJumpPressedTime = -Infinity;
    }

    // Apply gravity ONLY if physics is enabled (i.e., game has started)
    if (this.collisionSystem && this.collisionSystem.isPhysicsEnabled()) {
      if (!this.onGround) {
        this.velocityY += this.gravity * deltaTime;
        if (this.velocityY < this.terminalVelocity) {
          this.velocityY = this.terminalVelocity;
        }
      }
    }
    
    if (this.collisionSystem && this.collisionSystem.isPhysicsEnabled()) {
      // Include vertical movement in the movement vector for character controller
      const verticalMovement = new THREE.Vector3(0, this.velocityY * deltaTime, 0);
      const horizontalMovement = this.velocity.clone().multiplyScalar(deltaTime);
      const totalMovement = horizontalMovement.add(verticalMovement);
      
      // Let Rapier's character controller handle all physics
      const newPos = this.collisionSystem.slidePlayerAlongWalls(
        this.yawObject.position,
        totalMovement
      );
      
      // Check if we're grounded using Rapier's character controller
      const wasOnGround = this.onGround;
      this.onGround = this.collisionSystem.isGrounded();
      
      console.log("[Controls] Before update - yawObject Y:", this.yawObject.position.y.toFixed(3));
      console.log("[Controls] After physics - newPos Y:", newPos.y.toFixed(3));
      console.log("[Controls] Grounded:", this.onGround, "wasOnGround:", wasOnGround);
      
      // Character controller handles ground position, no manual snap needed
      // Removed manual ground snap to prevent vertical jitter
      
      // Update position
      const verticalChange = newPos.y - this.yawObject.position.y;
      this.yawObject.position.copy(newPos);
      
      console.log("[Controls] After copy - yawObject Y:", this.yawObject.position.y.toFixed(3));
      console.log("[Controls] Vertical change:", verticalChange.toFixed(3));
      
      // If we landed on ground
      if (this.onGround && !wasOnGround) {
        this.lastGroundedTime = now;
        this.velocityY = 0;
      }
      // If we hit something above while jumping
      else if (verticalChange < 0 && this.velocityY > 0) {
        this.velocityY = 0;
      }
      // If we're on ground, reset velocity
      else if (this.onGround) {
        this.velocityY = 0;
      }
    } else {
      // No collision system, just apply movement
      const desiredY = this.yawObject.position.y + this.velocityY * deltaTime;
      this.yawObject.position.y = desiredY;
    }

    const targetY = this.isCrouching ? this.crouchHeight : this.standHeight;
    const heightDiff = targetY - this.pitchObject.position.y;
    
    // Only adjust if difference is significant (prevents micro-jitter)
    if (Math.abs(heightDiff) > 0.005) {
      this.pitchObject.position.y += heightDiff * this.heightLerp * deltaTime;
    } else {
      this.pitchObject.position.y = targetY; // Snap to target if very close
    }

    // Periodic check (you already had it)
    this.changeCheckAccumulator += deltaTime;
    if (this.changeCheckAccumulator >= this.changeCheckInterval) {
      this.checkChanges(); // <- optimized below
      this.changeCheckAccumulator = 0;
    }
  }
}
