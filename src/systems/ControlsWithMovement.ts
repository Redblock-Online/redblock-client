// src/systems/Controls.ts
import * as THREE from "three";

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

  private keysPressed: Record<string, boolean> = {};

  constructor(camera: THREE.Camera, domElement: HTMLCanvasElement) {
    this.camera = camera;
    this.domElement = domElement;
    const sensitivitySlider = document.getElementById(
      "sensitivityRange"
    ) as HTMLInputElement;

    sensitivitySlider.addEventListener("input", () => {
      const value = parseFloat(sensitivitySlider.value);
      this.sensitivity = value * 0.0002;
    });

    this.pitchObject.add(this.camera);
    this.yawObject.add(this.pitchObject);

    this.initPointerLock();
    this.initKeyboardListeners();
  }

  get object() {
    return this.yawObject;
  }

  private initKeyboardListeners() {
    document.addEventListener("keydown", (e) => {
      this.keysPressed[e.key.toLowerCase()] = true;

      if (e.key.toLowerCase() === "c") {
        this.isCrouching = true;
      }

      if (e.code === "Space") {
        this.lastJumpPressedTime = performance.now() / 1000;
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keysPressed[e.key.toLowerCase()] = false;

      if (e.key.toLowerCase() === "c") {
        this.isCrouching = false;
      }
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

  public update(deltaTime: number) {
    const targetDirection = new THREE.Vector3();

    if (this.keysPressed["a"]) targetDirection.z -= 1;
    if (this.keysPressed["d"]) targetDirection.z += 1;
    if (this.keysPressed["s"]) targetDirection.x -= 1;
    if (this.keysPressed["w"]) targetDirection.x += 1;
    this.yawObject.position.x = THREE.MathUtils.clamp(
      this.yawObject.position.x,
      -6.2,
      8.2
    );

    this.yawObject.position.z = THREE.MathUtils.clamp(
      this.yawObject.position.z,
      -7.3,
      7.3
    );
    const effectiveSpeed =
      this.moveSpeed *
      (this.isCrouching ? this.crouchSpeedFactor : 1) *
      (this.onGround ? 1 : this.airControlFactor);

    targetDirection.normalize();
    targetDirection.applyQuaternion(this.yawObject.quaternion);
    targetDirection.y = 0;
    this.velocity.lerp(
      targetDirection.multiplyScalar(effectiveSpeed),
      this.acceleration
    );

    this.velocity.multiplyScalar(Math.pow(this.damping, deltaTime));

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
  }
}
