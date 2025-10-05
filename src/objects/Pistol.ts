import { Group, Mesh, MeshToonMaterial, MeshBasicMaterial, Camera, Euler, Vector3, BoxGeometry, CylinderGeometry } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
  
  // Configurable edge thickness (radius of edge cylinders)
  public static EDGE_THICKNESS = 0.03;
  
  // Inertia/sway config
  private readonly SWAY_AMOUNT = 0.02;
  private readonly SWAY_DURATION = 0.3;
  private readonly SWAY_CLAMP = 0.05;
  private readonly SWAY_MULTIPLIERS = {
    bobbing: 2,
    jump: 3,
    lateral: 2,
    forwardBack: 0.5,
  };
  
  private currentSway = new Vector3();
  private targetSway = new Vector3();
  private prevCameraPos = new Vector3();
  private velocity = new Vector3();
  private swayTween?: gsap.core.Tween;

  constructor(camera: Camera, callback?: (pistol: Pistol) => void) {
    super();
    this.camera = camera;
    this.prevRotationY = camera.rotation.y;

    // set initial transform
    this.position.copy(this.basePos);
    this.rotation.copy(this.baseRot);
    this.scale.set(0.1, 0.1, 0.1);

    // Load GLTF model
    const loader = new GLTFLoader();
    loader.load(
      "/models/pistol.glb",
      (gltf) => {
        // Add the loaded model to this group
        const model = gltf.scene;
        
        // Paint all meshes white
        model.traverse((child) => {
          if (child instanceof Mesh) {
            child.material = new MeshToonMaterial({ color: 0xffffff });
          }
        });
        
        this.add(model);
        
        // Initialize previous camera position
        camera.getWorldPosition(this.prevCameraPos);
        
        if (callback) {
          callback(this);
        }
      },
      undefined,
      (error) => {
        console.error("Error loading pistol model:", error);
        // Fallback to low poly if model fails to load
        this.createLowPolyPistol();
        camera.getWorldPosition(this.prevCameraPos);
        if (callback) {
          callback(this);
        }
      }
    );
  }

  private createLowPolyPistol() {
    const material = new MeshToonMaterial({ color: 0xffffff });
    const edgeMaterial = new MeshBasicMaterial({ color: 0x000000 });

    // Helper function to add cylindrical edges to a box
    const addEdgesToBox = (parent: Group, width: number, height: number, depth: number, posX: number, posY: number, posZ: number) => {
      const box = new Mesh(new BoxGeometry(width, height, depth), material);
      box.position.set(posX, posY, posZ);
      parent.add(box);

      const r = Pistol.EDGE_THICKNESS;
      const edges = [
        // Bottom edges
        { len: width, pos: [posX, posY - height/2, posZ - depth/2], rot: [0, 0, Math.PI/2] },
        { len: width, pos: [posX, posY - height/2, posZ + depth/2], rot: [0, 0, Math.PI/2] },
        { len: depth, pos: [posX - width/2, posY - height/2, posZ], rot: [0, 0, Math.PI/2], rotY: Math.PI/2 },
        { len: depth, pos: [posX + width/2, posY - height/2, posZ], rot: [0, 0, Math.PI/2], rotY: Math.PI/2 },
        // Top edges
        { len: width, pos: [posX, posY + height/2, posZ - depth/2], rot: [0, 0, Math.PI/2] },
        { len: width, pos: [posX, posY + height/2, posZ + depth/2], rot: [0, 0, Math.PI/2] },
        { len: depth, pos: [posX - width/2, posY + height/2, posZ], rot: [0, 0, Math.PI/2], rotY: Math.PI/2 },
        { len: depth, pos: [posX + width/2, posY + height/2, posZ], rot: [0, 0, Math.PI/2], rotY: Math.PI/2 },
        // Vertical edges
        { len: height, pos: [posX - width/2, posY, posZ - depth/2], rot: [0, 0, 0] },
        { len: height, pos: [posX + width/2, posY, posZ - depth/2], rot: [0, 0, 0] },
        { len: height, pos: [posX - width/2, posY, posZ + depth/2], rot: [0, 0, 0] },
        { len: height, pos: [posX + width/2, posY, posZ + depth/2], rot: [0, 0, 0] },
      ];

      edges.forEach(({ len, pos, rot, rotY }) => {
        const cyl = new Mesh(new CylinderGeometry(r, r, len, 8), edgeMaterial);
        cyl.position.set(pos[0], pos[1], pos[2]);
        cyl.rotation.set(rot[0], rotY || 0, rot[2]);
        parent.add(cyl);
      });
    };

    // Grip (handle) - vertical
    addEdgesToBox(this, 1.2, 3, 1, 0, 0, 0);

    // Slide (top part) - horizontal
    addEdgesToBox(this, 4, 1.5, 1.2, 2.5, 2, 0);

    // Barrel - extending forward
    addEdgesToBox(this, 1.5, 0.8, 0.8, 5.2, 2, 0);

    // Trigger guard
    addEdgesToBox(this, 0.8, 1.5, 0.3, 0.8, 0.5, 0);
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
    this.updateVelocity(camera);
    this.calculateTargetSway();
    this.animateSway();
    this.applySwayToPosition(delta, camera);
  }

  private updateVelocity(camera: Camera): void {
    const currentCameraPos = new Vector3();
    camera.getWorldPosition(currentCameraPos);
    this.velocity.copy(currentCameraPos).sub(this.prevCameraPos);
    this.prevCameraPos.copy(currentCameraPos);
  }

  private calculateTargetSway(): void {
    const horizontalSpeed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z
    );

    // Bobbing up/down when walking
    this.targetSway.y = -Math.abs(horizontalSpeed) * this.SWAY_AMOUNT * this.SWAY_MULTIPLIERS.bobbing;

    // Jump/fall creates vertical movement
    this.targetSway.y += -this.velocity.y * this.SWAY_AMOUNT * this.SWAY_MULTIPLIERS.jump;

    // Lateral movement (strafe left/right)
    this.targetSway.x = this.velocity.x * this.SWAY_AMOUNT * this.SWAY_MULTIPLIERS.lateral;

    // Forward/backward movement
    this.targetSway.z = -this.velocity.z * this.SWAY_AMOUNT * this.SWAY_MULTIPLIERS.forwardBack;

    // Clamp to prevent extreme positions
    this.targetSway.clamp(
      new Vector3(-this.SWAY_CLAMP, -this.SWAY_CLAMP, -this.SWAY_CLAMP),
      new Vector3(this.SWAY_CLAMP, this.SWAY_CLAMP, this.SWAY_CLAMP)
    );
  }

  private animateSway(): void {
    this.swayTween?.kill();
    
    this.swayTween = gsap.to(this.currentSway, {
      x: this.targetSway.x,
      y: this.targetSway.y,
      z: this.targetSway.z,
      duration: this.SWAY_DURATION,
      ease: "power1.out",
    });
  }

  private applySwayToPosition(delta: number, camera: Camera): void {
    const targetRotationY = camera.rotation.y;
    const rotationDiff = targetRotationY - this.prevRotationY;
    const offsetX = rotationDiff * 5;
    const smoothing = 10;
    const targetX = this.basePos.x + offsetX;

    if (!this.firing) {
      // Combine rotation sway with movement sway
      this.position.x += (targetX + this.currentSway.x - this.position.x) * smoothing * delta;
      this.position.y = this.basePos.y + this.currentSway.y;
      this.position.z = this.basePos.z + this.currentSway.z;
      this.rotation.z = this.baseRot.z - this.currentSway.x * 0.5;
    } else {
      // When firing, only apply rotation sway
      this.position.x += (targetX - this.position.x) * smoothing * delta;
    }

    this.prevRotationY = targetRotationY;
  }

  public dispose() {
    this.tl?.kill();
    this.swayTween?.kill();
  }
}
