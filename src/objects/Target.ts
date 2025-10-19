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
  
  // Shared geometries and materials (static to avoid creating duplicates)
  private static cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  
  // Edge material pool (each target needs independent edge materials for animations)
  private static edgeMaterialPool: THREE.MeshBasicMaterial[] = [];
  private static edgeMaterialPoolSize = 1200; // 100 targets * 12 edges each
  
  private static getEdgeMaterial(): THREE.MeshBasicMaterial {
    Target.initializeMaterialPool(); // Ensure pool is ready
    
    if (Target.edgeMaterialPool.length > 0) {
      return Target.edgeMaterialPool.pop()!;
    }
    
    // Pool exhausted - create new (should rarely happen)
    console.warn('[Target] Edge material pool exhausted! Creating new material.');
    return new THREE.MeshBasicMaterial({ 
      color: 0x000000,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      transparent: true,
      opacity: 1
    });
  }
  
  private static returnEdgeMaterial(material: THREE.MeshBasicMaterial) {
    if (Target.edgeMaterialPool.length < Target.edgeMaterialPoolSize) {
      material.opacity = 1;
      material.transparent = true;
      Target.edgeMaterialPool.push(material);
    } else {
      material.dispose();
    }
  }
  
  // Material pool for efficient reuse (pre-create a fixed number)
  private static materialPool: THREE.MeshToonMaterial[] = [];
  private static materialPoolSize = 100; // Max simultaneous targets expected
  private static materialPoolInitialized = false;
  
  /**
   * Pre-warm material pool to avoid runtime allocations
   */
  private static initializeMaterialPool() {
    if (Target.materialPoolInitialized) return;
    
    console.log('[Target] Pre-warming material pools...');
    
    // Pre-create cube materials
    for (let i = 0; i < Target.materialPoolSize; i++) {
      const mat = new THREE.MeshToonMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 1
      });
      Target.materialPool.push(mat);
    }
    
    // Pre-create edge materials (12 per target)
    for (let i = 0; i < Target.edgeMaterialPoolSize; i++) {
      const mat = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        transparent: true,
        opacity: 1
      });
      Target.edgeMaterialPool.push(mat);
    }
    
    Target.materialPoolInitialized = true;
    console.log(`[Target] Material pools initialized: ${Target.materialPool.length} cube + ${Target.edgeMaterialPool.length} edge materials`);
  }
  
  private static getMaterial(): THREE.MeshToonMaterial {
    Target.initializeMaterialPool(); // Ensure pool is ready
    
    if (Target.materialPool.length > 0) {
      return Target.materialPool.pop()!;
    }
    
    // Pool exhausted - create new (should rarely happen)
    console.warn('[Target] Cube material pool exhausted! Creating new material.');
    return new THREE.MeshToonMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 1
    });
  }
  
  private static returnMaterial(material: THREE.MeshToonMaterial) {
    // Reset to default state and return to pool
    if (Target.materialPool.length < Target.materialPoolSize) {
      material.color.set(0xffffff);
      material.opacity = 1;
      Target.materialPool.push(material);
    } else {
      // Pool is full, dispose instead
      material.dispose();
    }
  }
  
  // Shared cylinder geometries for edges (keyed by scale)
  private static cylinderGeometryCache = new Map<number, THREE.CylinderGeometry>();
  
  private static getCylinderGeometry(targetScale: number): THREE.CylinderGeometry {
    // Round to avoid cache misses from floating point precision
    const key = Math.round(targetScale * 1000) / 1000;
    
    if (!Target.cylinderGeometryCache.has(key)) {
      const edgeRadius = 0.025;
      const edgeLength = 1.0;
      const scaledRadius = edgeRadius / targetScale;
      // Reduced from 16 to 6 segments for 60% fewer vertices (massive performance gain)
      const geom = new THREE.CylinderGeometry(scaledRadius, scaledRadius, edgeLength, 6);
      Target.cylinderGeometryCache.set(key, geom);
    }
    
    return Target.cylinderGeometryCache.get(key)!;
  }

  constructor(
    color: THREE.Color | number = 0xffffff,
    isTarget: boolean = false,
    shootable: boolean = false,
    halfSize: boolean = false
  ) {
    super();

    // Main cube mesh - get material from pool
    const material = Target.getMaterial();
    material.color.set(color);
    material.transparent = true;
    this.cubeMesh = new THREE.Mesh(Target.cubeGeometry, material);
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
    
    // Get shared cylinder geometry from cache
    const cylinderGeometry = Target.getCylinderGeometry(targetScale);

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
      // Get independent edge material from pool for proper animation support
      const edgeMaterial = Target.getEdgeMaterial();
      const edge = new THREE.Mesh(cylinderGeometry, edgeMaterial);
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

    const cubeMaterial = this.cubeMesh.material as THREE.MeshBasicMaterial;
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
    const material = this.cubeMesh.material as THREE.MeshBasicMaterial;
    material.color.set(color);
  }

  /**
   * Sets the opacity of the target (mesh only, edges remain solid)
   */
  public setOpacity(opacity: number) {
    const cubeMaterial = this.cubeMesh.material as THREE.Material;
    cubeMaterial.opacity = opacity;
  }

  /**
   * Properly dispose of target resources and return materials to pool
   */
  public dispose() {
    // Kill any active tweens
    this.activeTweens.forEach(t => t.kill());
    this.activeTweens = [];
    
    // Return cube material to pool (geometry is shared, don't dispose)
    const cubeMaterial = this.cubeMesh.material as THREE.MeshToonMaterial;
    Target.returnMaterial(cubeMaterial);
    
    // Return edge materials to pool
    this.edgesGroup.children.forEach((edge) => {
      const mesh = edge as THREE.Mesh;
      if (mesh.material) {
        Target.returnEdgeMaterial(mesh.material as THREE.MeshBasicMaterial);
      }
    });
    
    // Clear references (geometries are shared, don't dispose)
    this.cubeMesh.geometry = null as unknown as THREE.BufferGeometry;
    this.cubeMesh.material = null as unknown as THREE.Material;
  }
}
