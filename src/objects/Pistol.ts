import { Group, Mesh, MeshBasicMaterial, Camera, Euler, Vector3 } from "three";
import GLTFLoader from "../loaders/GLTFLoader";
import gsap from "gsap";

export default class Pistol extends Group {
  camera: Camera;
  prevRotationY: number;

  // recoil config
  private baseRot = new Euler(0, Math.PI / 2, 0);
  private basePos = new Vector3(0.4, -0.3, -0.9);
  private firing: boolean = false; // cooldown flag
  private fireRate = 8; // shots per second
  private tl?: gsap.core.Timeline;

  constructor(camera: Camera, callback?: (pistol: Pistol) => void) {
    super();
    this.camera = camera;
    this.prevRotationY = 0;

    // set initial transform
    this.position.copy(this.basePos);
    this.rotation.copy(this.baseRot);
    this.scale.set(0.1, 0.1, 0.1);

    const loader = new GLTFLoader();
    loader.load("/models/pistol.glb", (gltf) => {
      const model = gltf.scene;

      // Flat white style so the outline pass reads clean normals/depth
      model.traverse((child) => {
        if ((child as Mesh).isMesh) {
          const mesh = child as Mesh;
          mesh.material = new MeshBasicMaterial({ color: "white" });
        }
      });

      this.add(model);
      callback?.(this);
    });
  }

  public shoot() {
    if (this.firing) return;

    // lock by fire rate
    this.firing = true;
    const cooldown = 1 / this.fireRate;

    this.tl?.kill();

    const kickZ = -0.07;
    const tiltX = 0.18;
    const twistZ = 0.06;

    this.position.copy(this.basePos);
    this.rotation.copy(this.baseRot);
    this.tl = gsap
      .timeline({ defaults: { ease: "power2.out" } })
      .to(
        this.position,
        { z: this.basePos.z + kickZ, duration: 0.06, ease: "power3.in" },
        0
      )
      .to(
        this.rotation,
        {
          x: this.baseRot.x + tiltX,
          z: this.baseRot.z + twistZ,
          duration: 0.06,
          ease: "power3.in",
        },
        0
      )
      .to(this.position, { z: this.basePos.z + kickZ * 0.25, duration: 0.05 })
      .to(
        this.rotation,
        {
          x: this.baseRot.x + tiltX * 0.35,
          z: this.baseRot.z + twistZ * 0.35,
          duration: 0.05,
        },
        "<"
      )
      .to(this.position, { z: this.basePos.z, duration: 0.08 })
      .to(
        this.rotation,
        { x: this.baseRot.x, z: this.baseRot.z, duration: 0.08 },
        "<"
      );

    gsap.delayedCall(cooldown, () => (this.firing = false));
  }

  public update(delta: number, camera: Camera) {
    const targetRotationY = camera.rotation.y;
    const rotationDiff = targetRotationY - this.prevRotationY;
    const offsetX = rotationDiff * 5;
    const smoothing = 10;

    if (this.prevRotationY === null || this.prevRotationY === undefined) {
      this.position.x = offsetX + this.basePos.x;
    } else {
      const targetX = this.basePos.x + offsetX;
      this.position.x += (targetX - this.position.x) * smoothing * delta;
    }

    this.prevRotationY = targetRotationY;
  }

  public dispose() {
    this.tl?.kill();
  }
}
