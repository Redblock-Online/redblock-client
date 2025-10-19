// src/systems/Controls.ts
import * as THREE from "three";
import type WSManager from "@/utils/ws/WSManager";
import type Target from "@/objects/Target";
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
  private standHeight = 0;
  private crouchHeight = -0.4;
  private heightLerp = 10;
  private crouchSpeedFactor = 0.6;

  private velocityY = 0;
  private groundY = 0;
  private maxY = 2.2;
  private gravity = -24;
  private jumpStrength = 8;
  private terminalVelocity = -50;
  private airControlFactor = 1;
  private onGround = true;
  private lastGroundedTime = -Infinity;
  private lastJumpPressedTime = -Infinity;
  private jumpBuffer = 0.12;
  private coyoteTime = 0.1;
  private lastJumpTime = -Infinity;
  private jumpCooldown = 0.15;

  // Head bobbing variables
  private headBobbingTime = 0;
  private headBobbingAmplitude = 0.065; // Amplitud del movimiento vertical (más notorio)
  private headBobbingFrequency = 3.8; // Frecuencia del movimiento (más dinámico)
  private headBobbingSideAmplitude = 0.038; // Amplitud del movimiento lateral (más notorio)
  private isMoving = false;
  private lastMovementTime = 0;
  private headBobbingDamping = 7.5; // Velocidad de transición balanceada

  // Audio variables
  private stepsAudio: HTMLAudioElement | null = null;
  private isStepsPlaying = false;

  private keysPressed: Record<string, boolean> = {};
  private wsManager: WSManager;
  private getAmmountOfTargetsSelected: () => number;
  private lastYawPos = new THREE.Vector3();
  private lastYawRot = new THREE.Euler();
  private lastPitchRot = new THREE.Euler();

  // Room tracking
  private roomCoordX = 0;
  private roomCoordZ = 0;
  private roomSize = 20; // default room size (width/depth)

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
    getAmmountOfTargetsSelected: () => number
  ) {
    this.targets = targets;
    this.camera = camera;
    this.domElement = domElement;
    this.wsManager = wsManager;
    this.getAmmountOfTargetsSelected = getAmmountOfTargetsSelected;

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
    this.pitchObject.add(this.camera);
    this.yawObject.add(this.pitchObject);
    this.lastYawPos.copy(this.yawObject.position);
    this.lastYawRot.copy(this.yawObject.rotation);
    this.lastPitchRot.copy(this.pitchObject.rotation);

    this.initStepsAudio();
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
  // Safe teleport (moves the parent, not the camera)
  public teleportTo(x: number, y: number, z: number, yawRad: number = 0) {
    this.initPlayerRoom(x, z, this.roomSize);
    this.yawObject.position.set(x, y, z);
    this.yawObject.rotation.set(0, yawRad, 0);
    this.pitchObject.rotation.set(0, 0, 0); // resetea pitch
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
    const effectiveSpeed =
      this.moveSpeed *
      (this.isCrouching ? this.crouchSpeedFactor : 1) *
      (this.onGround ? 1 : this.airControlFactor);

    targetDirection.normalize();
    targetDirection.applyQuaternion(this.yawObject.quaternion);
    targetDirection.y = 0;

    const desiredVel = targetDirection.clone().multiplyScalar(effectiveSpeed);
    const bothLateralPressed = !!this.keysPressed["a"] && !!this.keysPressed["d"];

    // Si no hay teclas presionadas, detener inmediatamente
    if (targetDirection.length() === 0) {
      this.velocity.set(0, 0, 0);
    } else if (bothLateralPressed) {
      this.velocity.set(0, 0, 0);
    } else {
      this.velocity.lerp(desiredVel, this.acceleration);
      this.velocity.multiplyScalar(Math.pow(this.damping, deltaTime));
    }
    this.yawObject.position.addScaledVector(this.velocity, deltaTime);

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

    this.velocityY += this.gravity * deltaTime;
    if (this.velocityY < this.terminalVelocity)
      this.velocityY = this.terminalVelocity;
    this.yawObject.position.y += this.velocityY * deltaTime;

    if (this.yawObject.position.y <= this.groundY) {
      this.yawObject.position.y = this.groundY;
      if (!this.onGround) {
        this.onGround = true;
        this.lastGroundedTime = now;
      } else {
        this.lastGroundedTime = now;
      }
      this.velocityY = 0;
    } else {
      this.onGround = false;
    }

    if (this.yawObject.position.y > this.maxY) {
      this.yawObject.position.y = this.maxY;
      if (this.velocityY > 0) this.velocityY = 0;
    }

    const targetY = this.isCrouching ? this.crouchHeight : this.standHeight;
    this.pitchObject.position.y +=
      (targetY - this.pitchObject.position.y) * this.heightLerp * deltaTime;

    // Head bobbing logic
    this.updateHeadBobbing(deltaTime);

    // Periodic check (you already had it)
    this.changeCheckAccumulator += deltaTime;
    if (this.changeCheckAccumulator >= this.changeCheckInterval) {
      this.checkChanges(); // <- optimized below
      this.changeCheckAccumulator = 0;
    }
  }

  private updateHeadBobbing(deltaTime: number) {
    // Detectar si el jugador está presionando teclas de movimiento
    const isKeyPressed = this.keysPressed["w"] || this.keysPressed["a"] || this.keysPressed["s"] || this.keysPressed["d"];
    const isCurrentlyMoving = isKeyPressed && this.onGround;
    
    // Debug: mostrar estado del movimiento
    if (isCurrentlyMoving && !this.isMoving) {
      console.log('Movimiento detectado - teclas presionadas');
    }
    
    if (isCurrentlyMoving) {
      this.isMoving = true;
      this.lastMovementTime = performance.now();
      this.headBobbingTime += deltaTime * this.headBobbingFrequency;
      // Reproducir audio de pasos cuando se está moviendo
      this.playStepsAudio();
    } else {
      // Si no se está moviendo, detener inmediatamente el head bobbing
      if (this.isMoving) {
        this.isMoving = false;
        this.headBobbingTime = 0;
        // Detener audio de pasos cuando se deja de mover
        this.stopStepsAudio();
      }
    }

    if (this.isMoving && this.onGround && !this.isCrouching) {
      // Detectar dirección del movimiento
      const forwardMovement = this.keysPressed["w"];
      const backwardMovement = this.keysPressed["s"];
      const leftMovement = this.keysPressed["a"];
      const rightMovement = this.keysPressed["d"];
      
      // Calcular amplitud basada en la dirección
      let verticalAmplitude = this.headBobbingAmplitude;
      let sideAmplitude = this.headBobbingSideAmplitude;
      
      // Aumentar movimiento para direcciones laterales y hacia atrás
      if (leftMovement || rightMovement || backwardMovement) {
        verticalAmplitude *= 1.4; // 40% más para laterales y atrás
        sideAmplitude *= 1.6; // 60% más para laterales y atrás
      }
      
      // Calcular el movimiento de head bobbing
      const verticalBob = Math.sin(this.headBobbingTime * Math.PI * 2) * verticalAmplitude;
      const sideBob = Math.sin(this.headBobbingTime * Math.PI * 2 * 0.5) * sideAmplitude;
      
      // Aplicar el movimiento a la cámara de forma más suave
      this.camera.position.y += (verticalBob - this.camera.position.y) * 5 * deltaTime;
      this.camera.position.x += (sideBob - this.camera.position.x) * 5 * deltaTime;
    } else {
      // Suavemente regresar a la posición original
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
      this.stopStepsAudio();
    }
  }

  private initStepsAudio() {
    // Intentar diferentes rutas para el archivo de audio
    const audioPaths = [
      '/music/steps.mp3',
      './music/steps.mp3',
      '/public/music/steps.mp3'
    ];
    
    this.stepsAudio = new Audio(audioPaths[0]);
    this.stepsAudio.loop = true;
    this.stepsAudio.volume = 0.5; // Aumentar volumen para mejor audibilidad
    this.stepsAudio.preload = 'auto';
    
    // Agregar listeners para debug
    this.stepsAudio.addEventListener('loadstart', () => {
      console.log('Audio de pasos: Iniciando carga...');
    });
    
    this.stepsAudio.addEventListener('canplaythrough', () => {
      console.log('Audio de pasos: Listo para reproducir');
    });
    
    this.stepsAudio.addEventListener('error', (e) => {
      console.error('Error cargando audio de pasos:', e);
      // Intentar con rutas alternativas
      this.tryAlternativeAudioPaths(audioPaths.slice(1));
    });
  }
  
  private tryAlternativeAudioPaths(paths: string[]) {
    if (paths.length === 0) {
      console.error('No se pudo cargar el audio de pasos con ninguna ruta');
      return;
    }
    
    console.log('Intentando ruta alternativa:', paths[0]);
    this.stepsAudio = new Audio(paths[0]);
    this.stepsAudio.loop = true;
    this.stepsAudio.volume = 0.5;
    this.stepsAudio.preload = 'auto';
    
    this.stepsAudio.addEventListener('error', (e) => {
      console.error('Error con ruta alternativa:', paths[0], e);
      this.tryAlternativeAudioPaths(paths.slice(1));
    });
    
    this.stepsAudio.addEventListener('canplaythrough', () => {
      console.log('Audio de pasos cargado exitosamente con ruta:', paths[0]);
    });
  }

  private playStepsAudio() {
    if (this.stepsAudio && !this.isStepsPlaying && !this.paused) {
      console.log('Intentando reproducir audio de pasos...');
      this.stepsAudio.play().then(() => {
        console.log('Audio de pasos reproducido exitosamente');
        this.isStepsPlaying = true;
      }).catch((error) => {
        console.error('No se pudo reproducir el audio de pasos:', error);
        // Intentar cargar el audio nuevamente si hay error
        this.stepsAudio?.load();
      });
    }
  }

  private stopStepsAudio() {
    if (this.stepsAudio && this.isStepsPlaying) {
      console.log('Deteniendo audio de pasos...');
      this.stepsAudio.pause();
      this.stepsAudio.currentTime = 0;
      this.isStepsPlaying = false;
    }
  }
}
