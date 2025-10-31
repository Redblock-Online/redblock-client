// src/systems/Controls.ts
import * as THREE from "three";
import type WSManager from "@/utils/ws/WSManager";
import type Target from "@/objects/Target";
import type { PhysicsSystem } from "@/features/game/physics";
import { buildTargetsInfo } from "@/utils/targetsInfo";
import { AudioManager } from "@/utils/AudioManager";
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

  // Head bobbing variables
  private headBobbingTime = 0;
  private headBobbingAmplitude = 0.065; // Amplitud del movimiento vertical (más notorio)
  private headBobbingFrequency = 3.8; // Frecuencia del movimiento (más dinámico)
  private headBobbingSideAmplitude = 0.038; // Amplitud del movimiento lateral (más notorio)
  private isMoving = false;
  private lastMovementTime = 0;
  private headBobbingDamping = 7.5; // Velocidad de transición balanceada

  // Audio variables (using AudioManager)
  private audioManager: AudioManager;
  private stepsAudioId: string | null = null;
  private wasOnGroundLastFrame = false;
  private footstepsPlaying = false;
  private timeSinceStoppedMoving = 0;

  private keysPressed: Record<string, boolean> = {};
  private wsManager: WSManager;
  private getAmmountOfTargetsSelected: () => number;
  private collisionSystem?: PhysicsSystem;
  private lastYawPos = new THREE.Vector3();
  private lastYawRot = new THREE.Euler();
  private lastPitchRot = new THREE.Euler();
  
  // Reusable vectors for update loop to avoid allocations
  private _tempTargetDir = new THREE.Vector3();
  private _tempDesiredVel = new THREE.Vector3();
  private _tempVerticalMovement = new THREE.Vector3();
  private _tempHorizontalMovement = new THREE.Vector3();
  private _tempTotalMovement = new THREE.Vector3();

  // Keybindings
  private keybindings = {
    forward: "w",
    backward: "s",
    left: "a",
    right: "d",
    jump: "space",
    crouch: "c",
  };

  // Room tracking
  private roomCoordX = 0;
  private roomCoordZ = 0;
  private roomSize = 200; // default room size (width/depth) - increased for larger play area
  private isEditorMode = false; // If true, disable movement limits

  // Spawn point and fall detection
  private spawnPoint = new THREE.Vector3(0, 0, 0);
  private spawnYaw = 0;
  private lowestBlockY = -Infinity; // Y position of the lowest block in the scene
  private fallThreshold = 20; // Distance below lowest block before respawn
  private onRespawnCallback: (() => void) | null = null; // Callback for respawn visual effects

  private changeCheckAccumulator = 0;
  private changeCheckInterval = 1 / 20; // Reduced from 24 to 20 Hz for less network overhead

  private lastSentPos = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  private lastSentRotX = Number.NaN; // pitch
  private lastSentRotY = Number.NaN; // yaw

  private posThreshold = 0.08; // Increased from 5cm to 8cm - less network spam
  private rotThreshold = THREE.MathUtils.degToRad(1.5); // Increased from 0.9° to 1.5°
  private posQuant = 0.02; // Increased from 1cm to 2cm quantization
  private rotQuant = THREE.MathUtils.degToRad(0.2); // Increased from 0.1° to 0.2°

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
    this.audioManager = AudioManager.getInstance();

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

    // Initialize keybindings from localStorage
    const savedKeybindings = localStorage.getItem("keybindings");
    if (savedKeybindings) {
      try {
        this.keybindings = { ...this.keybindings, ...JSON.parse(savedKeybindings) };
      } catch {
        // Keep defaults
      }
    }

    // Listen for keybinding changes
    const onKeybindingsChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        this.keybindings = { ...this.keybindings, ...customEvent.detail };
      }
    };
    window.addEventListener("keybindingsChanged", onKeybindingsChanged);
    
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
    // Early exit if paused or no WS manager
    if (this.paused || !this.wsManager.getMe()) return;
    
    const now = performance.now();
    if (now < this.nextSendAt) return; // Rate limited

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

    const targetsInfo = buildTargetsInfo(
      this.targets,
      this.getAmmountOfTargetsSelected()
    );
    
    // Temporary diagnostic log
    if (Math.random() < 0.05) { // Log 5% of updates to avoid spam
      console.log('[Controls] Sending player update:', {
        targetsCount: this.targets.length,
        selectedCount: this.getAmmountOfTargetsSelected(),
        sentTargetsInfo: targetsInfo.length
      });
    }
    
    this.wsManager.sendPlayerUpdate({
      id: this.wsManager.getMe()!.id,
      local_player_position_x: qx,
      local_player_position_y: qy,
      local_player_position_z: qz,
      player_rotation_x: qRotX,
      player_rotation_y: qRotY,
      targetsInfo: targetsInfo,
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
      const code = e.code.toLowerCase();
      this.keysPressed[key] = true;
      this.keysPressed[code] = true;

      // Check for crouch
      if (key === this.keybindings.crouch) {
        this.isCrouching = true;
      }

      // Check for jump
      if (key === this.keybindings.jump || code === this.keybindings.jump) {
        this.lastJumpPressedTime = performance.now() / 1000;
      }
    });

    document.addEventListener("keyup", (e) => {
      if (this.paused) return;

      const key = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      this.keysPressed[key] = false;
      this.keysPressed[code] = false;

      // Check for crouch release
      if (key === this.keybindings.crouch) {
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
   * Set the lowest block Y position for fall detection
   * @param lowestY - Y position of the lowest block in the scene
   */
  public setLowestBlockY(lowestY: number) {
    this.lowestBlockY = lowestY;
    console.log("[Controls] Lowest block Y set to:", lowestY, "- fall threshold:", lowestY - this.fallThreshold);
  }

  /**
   * Set callback for respawn visual effects
   * @param callback - Function to call when player respawns
   */
  public setOnRespawnCallback(callback: () => void) {
    this.onRespawnCallback = callback;
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
  public teleportTo(x: number, y: number, z: number, yawRad: number = 0, saveAsSpawn: boolean = true) {
    this.initPlayerRoom(x, z, this.roomSize);
    this.yawObject.position.set(x, y, z);
    this.yawObject.rotation.set(0, yawRad, 0);
    this.pitchObject.rotation.set(0, 0, 0); // resetea pitch
    
    // Save as spawn point for respawn after falling
    if (saveAsSpawn) {
      this.spawnPoint.set(x, y, z);
      this.spawnYaw = yawRad;
      console.log("[Controls] Spawn point saved:", this.spawnPoint, "yaw:", yawRad);
    }
    
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
    // Reuse vector instead of creating new one
    this._tempTargetDir.set(0, 0, 0);

    if (this.keysPressed[this.keybindings.left]) this._tempTargetDir.z -= 1;
    if (this.keysPressed[this.keybindings.right]) this._tempTargetDir.z += 1;
    if (this.keysPressed[this.keybindings.backward]) this._tempTargetDir.x -= 1;
    if (this.keysPressed[this.keybindings.forward]) this._tempTargetDir.x += 1;

    // Movement restrictions removed - player can move freely in X and Z
    const effectiveSpeed =
      this.moveSpeed *
      (this.isCrouching ? this.crouchSpeedFactor : 1) *
      (this.onGround ? 1 : this.airControlFactor);

    this._tempTargetDir.normalize();
    this._tempTargetDir.applyQuaternion(this.yawObject.quaternion);
    this._tempTargetDir.y = 0;

    // Reuse vector instead of cloning
    this._tempDesiredVel.copy(this._tempTargetDir).multiplyScalar(effectiveSpeed);
    const bothLateralPressed = !!this.keysPressed[this.keybindings.left] && !!this.keysPressed[this.keybindings.right];

    // Si no hay teclas presionadas, detener inmediatamente
    if (this._tempTargetDir.length() === 0) {
      this.velocity.set(0, 0, 0);
    } else if (bothLateralPressed) {
      this.velocity.set(0, 0, 0);
    } else {
      this.velocity.lerp(this._tempDesiredVel, this.acceleration);
      this.velocity.multiplyScalar(Math.pow(this.damping, deltaTime));
    }
    // Only pre-apply horizontal movement when physics are disabled.
    // When physics are enabled, the character controller will compute and return the corrected position.
    const physicsActive = !!this.collisionSystem && this.collisionSystem.isPhysicsEnabled();
    if (!physicsActive) {
      this.yawObject.position.addScaledVector(this.velocity, deltaTime);
    }

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
    if (physicsActive) {
      if (!this.onGround) {
        this.velocityY += this.gravity * deltaTime;
        if (this.velocityY < this.terminalVelocity) {
          this.velocityY = this.terminalVelocity;
        }
      }
    }
    
    if (this.collisionSystem && this.collisionSystem.isPhysicsEnabled()) {
      // Include vertical movement in the movement vector for character controller
      // Reuse vectors instead of creating new ones
      this._tempVerticalMovement.set(0, this.velocityY * deltaTime, 0);
      this._tempHorizontalMovement.copy(this.velocity).multiplyScalar(deltaTime);
      this._tempTotalMovement.copy(this._tempHorizontalMovement).add(this._tempVerticalMovement);
      
      // Let Rapier's character controller handle all physics
      const newPos = this.collisionSystem.slidePlayerAlongWalls(
        this.yawObject.position,
        this._tempTotalMovement
      );
      
      // Check if we're grounded using Rapier's character controller
      const wasOnGround = this.onGround;
      this.onGround = this.collisionSystem.isGrounded();
      
      // console.log("[Controls] Before update - yawObject Y:", this.yawObject.position.y.toFixed(3));
      // console.log("[Controls] After physics - newPos Y:", newPos.y.toFixed(3));
      // console.log("[Controls] Grounded:", this.onGround, "wasOnGround:", wasOnGround);
      
      // Character controller handles ground position, no manual snap needed
      // Removed manual ground snap to prevent vertical jitter
      
      // Update position
      const verticalChange = newPos.y - this.yawObject.position.y;
      this.yawObject.position.copy(newPos);
      
      // console.log("[Controls] After copy - yawObject Y:", this.yawObject.position.y.toFixed(3));
      // console.log("[Controls] Vertical change:", verticalChange.toFixed(3));
      
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
      // And also apply horizontal movement if it wasn't already applied above (covered by !physicsActive)
    }

    const targetY = this.isCrouching ? this.crouchHeight : this.standHeight;
    const heightDiff = targetY - this.pitchObject.position.y;
    
    // Only adjust if difference is significant (prevents micro-jitter)
    if (Math.abs(heightDiff) > 0.005) {
      this.pitchObject.position.y += heightDiff * this.heightLerp * deltaTime;
    } else {
      this.pitchObject.position.y = targetY; // Snap to target if very close
    }

    // Head bobbing logic
    this.updateHeadBobbing(deltaTime);

    // Fall detection - respawn if player falls below lowest block
    if (this.lowestBlockY !== -Infinity) {
      const fallLimit = this.lowestBlockY - this.fallThreshold;
      if (this.yawObject.position.y < fallLimit) {
        console.log("[Controls] Player fell below fall limit:", this.yawObject.position.y, "< ", fallLimit);
        console.log("[Controls] Respawning at spawn point:", this.spawnPoint);
        
        // Trigger respawn visual effect
        if (this.onRespawnCallback) {
          this.onRespawnCallback();
        }
        
        this.teleportTo(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z, this.spawnYaw, false);
        this.resetPhysicsState();
      }
    }

    // Periodic check (you already had it)
    this.changeCheckAccumulator += deltaTime;
    if (this.changeCheckAccumulator >= this.changeCheckInterval) {
      this.checkChanges(); // <- optimized below
      this.changeCheckAccumulator = 0;
    }
    
    // Track ground state for next frame (to detect landing)
    this.wasOnGroundLastFrame = this.onGround;
  }

  private updateHeadBobbing(deltaTime: number) {
    // Considerar movimiento real (velocidad) en lugar de solo teclas presionadas
    // Además, cancelar si hay teclas opuestas presionadas (A+D o W+S)
    const leftPressed = !!this.keysPressed["a"];
    const rightPressed = !!this.keysPressed["d"];
    const forwardPressed = !!this.keysPressed["w"];
    const backwardPressed = !!this.keysPressed["s"];
    const opposingPressed = (leftPressed && rightPressed) || (forwardPressed && backwardPressed);
    const isCurrentlyMoving = this.onGround && !opposingPressed && (this.velocity.lengthSq() > 1e-6);
    
    // Debug: show movement state
    if (isCurrentlyMoving && !this.isMoving) {
      console.log('Movement detected');
    }
    
    if (isCurrentlyMoving) {
      this.isMoving = true;
      this.lastMovementTime = performance.now();
      this.headBobbingTime += deltaTime * this.headBobbingFrequency;
      this.timeSinceStoppedMoving = 0;
      
      // Play footsteps audio when moving (only if not already playing)
      if (!this.footstepsPlaying) {
        // Detect landing: just touched ground this frame while moving
        const justLanded = this.onGround && !this.wasOnGroundLastFrame;
        // Use startAtMs: 0 when landing for immediate sound, otherwise skip initial silence
        const offset = justLanded ? 0 : 70;
        this.stepsAudioId = this.audioManager.play('steps', { volume: 0.4, loop: true, startAtMs: offset });
        this.footstepsPlaying = true;
      }
    } else {
      // If not moving, immediately stop head bobbing
      this.timeSinceStoppedMoving += deltaTime;
      if (this.timeSinceStoppedMoving > 0.1) { // Small delay to avoid rapid toggles
        if (this.isMoving) {
          this.isMoving = false;
          this.headBobbingTime = 0;
          
          // Stop footsteps audio when stopping
          if (this.stepsAudioId) {
            this.audioManager.stop(this.stepsAudioId);
            this.stepsAudioId = null;
          }
          this.footstepsPlaying = false;
          // Safety: force-stop all 'steps' sounds in case ID was lost
          this.audioManager.stopAllByName('steps');
        }
      }
    }

    if (this.isMoving && this.onGround && !this.isCrouching) {
      // Detect movement direction
      const _forwardMovement = this.keysPressed["w"];
      const backwardMovement = this.keysPressed["s"];
      const leftMovement = this.keysPressed["a"];
      const rightMovement = this.keysPressed["d"];
      
      // Calculate amplitude based on direction
      let verticalAmplitude = this.headBobbingAmplitude;
      let sideAmplitude = this.headBobbingSideAmplitude;
      
      // Increase movement for lateral and backward directions
      if (leftMovement || rightMovement || backwardMovement) {
        verticalAmplitude *= 1.4; // 40% more for lateral and backward
        sideAmplitude *= 1.6; // 60% more for lateral and backward
      }
      
      // Calculate head bobbing movement
      const verticalBob = Math.sin(this.headBobbingTime * Math.PI * 2) * verticalAmplitude;
      const sideBob = Math.sin(this.headBobbingTime * Math.PI * 2 * 0.5) * sideAmplitude;
      
      // Apply movement to camera smoothly
      this.camera.position.y += (verticalBob - this.camera.position.y) * 5 * deltaTime;
      this.camera.position.x += (sideBob - this.camera.position.x) * 5 * deltaTime;
    } else {
      // Smoothly return to original position
      this.camera.position.y += (0 - this.camera.position.y) * this.headBobbingDamping * deltaTime;
      this.camera.position.x += (0 - this.camera.position.x) * this.headBobbingDamping * deltaTime;
    }
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      // Clear active inputs and motion to avoid continued movement
      this.keysPressed = {};
      this.isCrouching = false;
      this.velocity.set(0, 0, 0);
      this.velocityY = 0;
      this.lastJumpPressedTime = -Infinity;
      
      // Stop footsteps when paused
      if (this.stepsAudioId) {
        this.audioManager.stop(this.stepsAudioId);
        this.stepsAudioId = null;
      }
      this.footstepsPlaying = false;
      // Safety: force-stop all 'steps' sounds in case ID was lost
      this.audioManager.stopAllByName('steps');
    }
  }

  /**
   * Update the targets array reference (called when scenario loads new targets)
   */
  public updateTargets(targets: Target[]) {
    this.targets = targets;
    console.log(`[Controls] Targets updated: ${targets.length} targets`);
  }
}
