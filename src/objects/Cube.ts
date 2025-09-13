import * as THREE from "three";
import { gsap } from "gsap";
import { createAbsorbShaderMaterial } from "@/shaders/ShaderMaterial";


export default class Cube extends THREE.Group {
  public visible: boolean;
  public animating: boolean;
  public shootable: boolean;
  public cubeMesh: THREE.Mesh;
  public outlineMesh: THREE.Mesh;
  constructor(
    randomColor: boolean = false,
    isTarget: boolean = false,
    shootable: boolean = false,
    isRoom: boolean = false
  ) {
    super();

    const geometry = new THREE.BoxGeometry(1, 1, 1);

    const material = new THREE.MeshToonMaterial({
      color: randomColor ? Math.random() * 0xffffff : 0xffffff,
    });
    material.transparent = true;
    this.cubeMesh = new THREE.Mesh(geometry, material);

    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
    });
    outlineMaterial.transparent = true;
    this.outlineMesh = new THREE.Mesh(geometry.clone(), outlineMaterial);
    this.outlineMesh.scale.set(1.02, 1.02, 1.02);

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    const edgeLines = new THREE.LineSegments(edges, lineMaterial);

    this.position.set(6, 0, 0);
    this.scale.set(0.4, 0.4, 0.4);
    this.cubeMesh.name = isTarget ? "Target" : "";
    this.add(this.cubeMesh);
    this.add(this.outlineMesh);
    if (isRoom) this.add(edgeLines);
    this.visible = true;
    this.animating = false;
    this.shootable = false;
    if (shootable) this.makeShootable();
  }

  public makeShootable(color: THREE.Color | number = 0xff0000) {
    this.shootable = true;

    this.layers.enable(1);

    const cubeMaterial = this.cubeMesh
      .material as THREE.MeshToonMaterial | THREE.MeshBasicMaterial;
    cubeMaterial.color.set(color);
  }

  public absorbAndDisappear(callback?: () => void) {
    if (this.animating) return;
    const duration = 1;
    this.animating = true;

    const cubeMaterial = this.cubeMesh.material as THREE.Material;
    const outlineMaterial = this.outlineMesh.material as THREE.Material;
    gsap.to(cubeMaterial, {
      opacity: 0,
      duration,
      ease: "power3.in",
    });
    gsap.to(outlineMaterial, {
      opacity: 0,
      duration,
      ease: "power3.in",
    });

    gsap.to(this.rotation, {
      x: Math.PI * 4,
      y: Math.PI * 8,
      duration,
      ease: "power3.in",
    });

    gsap.to(this.scale, {
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
    });
  }
  public appearFromVoid(callback?: () => void) {
    if (this.animating) return;
    const duration = 1;
    this.animating = true;
    this.visible = true;
    this.scale.set(0, 0, 0);
    this.rotation.set(Math.PI * 2, Math.PI * 4, 0);

    const cubeMaterial = this.cubeMesh.material as THREE.Material;
    const outlineMaterial = this.outlineMesh.material as THREE.Material;
    cubeMaterial.opacity = 0;
    outlineMaterial.opacity = 0;

    gsap.to(cubeMaterial, {
      opacity: 1,
      duration,
      ease: "back.out(2)",
    });
    gsap.to(outlineMaterial, {
      opacity: 1,
      duration,
      ease: "back.out(2)",
    });

    gsap.to(this.rotation, {
      x: 0,
      y: 0,
      duration,
      ease: "power2.out",
    });

    gsap.to(this.scale, {
      x: 0.4,
      y: 0.4,
      z: 0.4,
      duration,
      ease: "back.out(2)",
      onComplete: () => {
        this.animating = false;
        if (callback) callback();
      },
    });
  }
}
