import * as THREE from "three";
import { gsap } from "gsap";

/**
 * Target object with thick 3D edge borders that protrude from the cube.
 * Used for both player targets and neighbor targets.
 */
export default class Target extends THREE.Group {
  public cubeMesh: THREE.Mesh;
  public edgesGroup: THREE.Group;
  public visible: boolean;
  public animating: boolean;
  public shootable: boolean;
  public shootableActivatedAt: number | null;
  public baseScale: number;
  public scenarioPortal: "next" | "prev" | null;
  public activeTweens: gsap.core.Tween[] = [];
  
  private static cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  private static edgeMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x000000,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  constructor(
    color: THREE.Color | number = 0xffffff,
    isTarget: boolean = false,
    shootable: boolean = false,
    halfSize: boolean = false
  ) {
    super();

    // Main cube mesh (slightly smaller to make room for edges)
    const cubeMaterial = new THREE.MeshToonMaterial({ color });
    cubeMaterial.transparent = true;
    this.cubeMesh = new THREE.Mesh(Target.cubeGeometry, cubeMaterial);
    this.cubeMesh.scale.set(1, 1, 1);
    this.cubeMesh.name = isTarget ? "Target" : "";
    this.cubeMesh.renderOrder = 0; // Render cube first

    // Create 3D edges as cylinders (with scale compensation for half-size)
    this.edgesGroup = this.createEdges(halfSize ? 0.5 : 1);

    this.add(this.cubeMesh);
    this.add(this.edgesGroup);

    // Initialize properties
    this.position.set(6, 0, 0);
    this.baseScale = halfSize ? 0.2 : 0.4; // Half size = 0.2, normal = 0.4
    this.scale.set(this.baseScale, this.baseScale, this.baseScale);
    this.visible = true;
    this.animating = false;
    this.shootable = false;
    this.shootableActivatedAt = null;
    this.scenarioPortal = null;
    
    if (shootable) this.makeShootable();
  }

  /**
   * Creates 12 cylindrical edges for the cube
   * @param targetScale - The scale of the target (0.5 for half-size, 1 for normal)
   */
  private createEdges(targetScale: number = 1): THREE.Group {
    const group = new THREE.Group();
    const edgeRadius = 0.025; // Thickness of the edge (constant regardless of scale)
    const edgeLength = 1.0; // Length of each edge

    // Cylinder geometry for edges (default: vertical along Y axis)
    // More segments (16) for smoother appearance at distance
    // Scale the radius inversely to maintain constant visual thickness
    const scaledRadius = edgeRadius / targetScale;
    const cylinderGeometry = new THREE.CylinderGeometry(scaledRadius, scaledRadius, edgeLength, 16);

    // Define the 12 edges of a cube with correct positions and rotations
    const edges = [
      // Bottom face (4 horizontal edges along Z and X axes)
      { pos: [0, -0.5, -0.5], rot: [0, 0, Math.PI / 2] },      // front bottom (X axis)
      { pos: [0, -0.5, 0.5], rot: [0, 0, Math.PI / 2] },       // back bottom (X axis)
      { pos: [-0.5, -0.5, 0], rot: [0, 0, Math.PI / 2], rotY: Math.PI / 2 },  // left bottom (Z axis)
      { pos: [0.5, -0.5, 0], rot: [0, 0, Math.PI / 2], rotY: Math.PI / 2 },   // right bottom (Z axis)
      
      // Top face (4 horizontal edges along Z and X axes)
      { pos: [0, 0.5, -0.5], rot: [0, 0, Math.PI / 2] },       // front top (X axis)
      { pos: [0, 0.5, 0.5], rot: [0, 0, Math.PI / 2] },        // back top (X axis)
      { pos: [-0.5, 0.5, 0], rot: [0, 0, Math.PI / 2], rotY: Math.PI / 2 },   // left top (Z axis)
      { pos: [0.5, 0.5, 0], rot: [0, 0, Math.PI / 2], rotY: Math.PI / 2 },    // right top (Z axis)
      
      // Vertical edges (4 edges along Y axis - no rotation needed)
      { pos: [-0.5, 0, -0.5], rot: [0, 0, 0] },                // front left
      { pos: [0.5, 0, -0.5], rot: [0, 0, 0] },                 // front right
      { pos: [-0.5, 0, 0.5], rot: [0, 0, 0] },                 // back left
      { pos: [0.5, 0, 0.5], rot: [0, 0, 0] },                  // back right
    ];

    edges.forEach(({ pos, rot, rotY }) => {
      const edge = new THREE.Mesh(cylinderGeometry, Target.edgeMaterial);
      edge.position.set(pos[0], pos[1], pos[2]);
      edge.rotation.set(rot[0], rotY || 0, rot[2]);
      edge.renderOrder = 1; // Render edges after the cube
      group.add(edge);
    });

    return group;
  }

  /**
   * Makes the target shootable
   */
  public makeShootable(color: THREE.Color | number = 0xff0000) {
    this.shootable = true;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.shootableActivatedAt = now;
    this.layers.enable(1);

    const cubeMaterial = this.cubeMesh.material as THREE.MeshToonMaterial;
    cubeMaterial.color.set(color);
  }

  /**
   * Absorb and disappear animation
   */
  public absorbAndDisappear(callback?: () => void) {
    if (this.animating) return;
    const duration = 1;
    this.animating = true;
    this.shootable = false;
    this.shootableActivatedAt = null;

    // Kill any existing tweens
    this.activeTweens.forEach(t => t.kill());
    this.activeTweens = [];

    const cubeMaterial = this.cubeMesh.material as THREE.Material;
    this.activeTweens.push(gsap.to(cubeMaterial, {
      opacity: 0,
      duration,
      ease: "power3.in",
    }));

    // Fade out edges
    this.edgesGroup.children.forEach((edge) => {
      const edgeMaterial = (edge as THREE.Mesh).material as THREE.Material;
      this.activeTweens.push(gsap.to(edgeMaterial, {
        opacity: 0,
        duration,
        ease: "power3.in",
      }));
    });

    this.activeTweens.push(gsap.to(this.rotation, {
      x: Math.PI * 4,
      y: Math.PI * 8,
      duration,
      ease: "power3.in",
    }));

    this.activeTweens.push(gsap.to(this.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration,
      ease: "back.in(2)",
      onComplete: () => {
        this.visible = false;
        this.animating = false;
        if (callback) callback();
      },
    }));
  }

  /**
   * Appear from void animation
   */
  public appearFromVoid(callback?: () => void) {
    if (this.animating) return;
    const duration = 1;
    this.animating = true;
    this.visible = true;
    this.scale.set(0, 0, 0);
    this.rotation.set(Math.PI * 2, Math.PI * 4, 0);

    const cubeMaterial = this.cubeMesh.material as THREE.Material;
    cubeMaterial.opacity = 0;

    // Set edges to transparent initially
    this.edgesGroup.children.forEach((edge) => {
      const edgeMaterial = (edge as THREE.Mesh).material as THREE.Material;
      edgeMaterial.transparent = true;
      edgeMaterial.opacity = 0;
    });

    gsap.to(cubeMaterial, {
      opacity: 1,
      duration,
      ease: "back.out(2)",
    });

    // Fade in edges
    this.edgesGroup.children.forEach((edge) => {
      const edgeMaterial = (edge as THREE.Mesh).material as THREE.Material;
      gsap.to(edgeMaterial, {
        opacity: 1,
        duration,
        ease: "back.out(2)",
      });
    });

    gsap.to(this.rotation, {
      x: 0,
      y: 0,
      duration,
      ease: "power2.out",
    });

    gsap.to(this.scale, {
      x: this.baseScale,
      y: this.baseScale,
      z: this.baseScale,
      duration,
      ease: "back.out(2)",
      onComplete: () => {
        this.animating = false;
        if (callback) callback();
      },
    });
  }

  /**
   * Updates the color of the target
   */
  public setColor(color: THREE.Color | number) {
    const material = this.cubeMesh.material as THREE.MeshToonMaterial;
    material.color.set(color);
  }

  /**
   * Sets the opacity of the target (mesh only, edges remain solid)
   */
  public setOpacity(opacity: number) {
    const cubeMaterial = this.cubeMesh.material as THREE.Material;
    cubeMaterial.opacity = opacity;
  }
}
