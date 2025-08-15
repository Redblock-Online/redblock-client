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
  private changeCheckInterval = 1 / 24; // 24 veces por segundo (~0.04166s)

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

  private checkChanges() {
    let moved = !this.lastYawPos.equals(this.yawObject.position);
    let yawRotated = !this.lastYawRot.equals(this.yawObject.rotation);
    let pitchRotated = !this.lastPitchRot.equals(this.pitchObject.rotation);

    if (this.wsManager.getMe() && (moved || yawRotated || pitchRotated)) {
      this.wsManager.sendPlayerUpdate({
        id: this.wsManager.getMe()!.id,
        player_rotation_x: this.yawObject.rotation.x,
        player_rotation_y: this.yawObject.rotation.y,
        local_player_position_x: this.yawObject.position.x,
        local_player_position_y: this.yawObject.position.y,
        local_player_position_z: this.yawObject.position.z,
      });

      this.lastYawPos.copy(this.yawObject.position);
      this.lastYawRot.copy(this.yawObject.rotation);
      this.lastPitchRot.copy(this.pitchObject.rotation);
    }
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
  // Teletransporte seguro (mueve el padre, no la cámara)
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

    this.changeCheckAccumulator += deltaTime;
    if (this.changeCheckAccumulator >= this.changeCheckInterval) {
      this.checkChanges();
      this.changeCheckAccumulator = 0;
    }
  }
}
