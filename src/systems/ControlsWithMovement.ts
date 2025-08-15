// src/systems/Controls.ts
import * as THREE from "three";
import type WSManager from "../utils/ws/WSManager";

export default class Controls {
  private camera: THREE.Camera;
  private domElement: HTMLCanvasElement;
  private pitchObject = new THREE.Object3D();
  private yawObject = new THREE.Object3D();

  private sensitivity = 0.0002;
  private PI_2 = Math.PI / 2;
  private moveSpeed = 8;
  private velocity = new THREE.Vector3();
  private acceleration = 0.07;
  private damping = 0.9;
  private keysPressed: Record<string, boolean> = {};
  private wsManager: WSManager;
  private lastYawPos = new THREE.Vector3();
  private lastYawRot = new THREE.Euler();
  private lastPitchRot = new THREE.Euler();

  // Room tracking
  private roomCoordX = 0;
  private roomCoordZ = 0;
  private roomSize = 15; // default room size (width/depth)

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
    camera: THREE.Camera,
    domElement: HTMLCanvasElement,
    wsManager: WSManager
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.wsManager = wsManager;
    const sensitivitySlider = document.getElementById(
      "sensitivityRange"
    ) as HTMLInputElement;

    sensitivitySlider.addEventListener("input", () => {
      const value = parseFloat(sensitivitySlider.value);
      this.sensitivity = value * 0.0002;
    });
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
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
    const rotY = this.yawObject.rotation.y; // yaw
    const rotX = this.pitchObject?.rotation.x ?? 0; // pitch (si tienes pitchObject)

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

    // Enviar update (ajusta al shape de tu red)
    this.wsManager.sendPlayerUpdate({
      id: this.wsManager.getMe()!.id,
      local_player_position_x: qx,
      local_player_position_y: qy,
      local_player_position_z: qz,
      player_rotation_x: qRotX,
      player_rotation_y: qRotY,
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
      this.keysPressed[e.key.toLowerCase()] = true;
    });

    document.addEventListener("keyup", (e) => {
      this.keysPressed[e.key.toLowerCase()] = false;
    });
  }

  public initPointerLock() {
    const onMouseMove = (event: MouseEvent) => {
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
  public initPlayerRoom(x: number, z: number, size: number = 15) {
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

    targetDirection.normalize();
    targetDirection.applyQuaternion(this.yawObject.quaternion);
    targetDirection.y = 0;

    this.velocity.lerp(
      targetDirection.multiplyScalar(this.moveSpeed),
      this.acceleration
    );
    this.velocity.multiplyScalar(Math.pow(this.damping, deltaTime));
    this.yawObject.position.addScaledVector(this.velocity, deltaTime);

    // Periodic check (you already had it)
    this.changeCheckAccumulator += deltaTime;
    if (this.changeCheckAccumulator >= this.changeCheckInterval) {
      this.checkChanges(); // <- optimized below
      this.changeCheckAccumulator = 0;
    }
  }
}
