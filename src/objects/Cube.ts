import * as THREE from "three";
import { gsap } from "gsap";
import { createAbsorbShaderMaterial } from "@/shaders/ShaderMaterial";

export default class Cube extends THREE.Group {
  public visible: boolean;
  public animating: boolean;
  public shootable: boolean;
  public shaderMaterial: THREE.ShaderMaterial;
  constructor(
    randomColor: boolean = false,
    isTarget: boolean = false,
    shootable: boolean = false,
    isRoom: boolean = false
  ) {
    super();

    const geometry = new THREE.BoxGeometry(1, 1, 1);

    const material = createAbsorbShaderMaterial(randomColor ? Math.random() * 0xffffff : 0xffffff);
    this.shaderMaterial = material;
    const cubeMesh = new THREE.Mesh(geometry, material);

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    const edgeLines = new THREE.LineSegments(edges, lineMaterial);

    this.position.set(6, 0, 0);
    this.scale.set(0.4, 0.4, 0.4);
    cubeMesh.name = isTarget ? "Target" : "";
    this.add(cubeMesh);
    if (isRoom) this.add(edgeLines);
    this.visible = true;
    this.animating = false;
    this.shootable = false;
    if (shootable) this.makeShootable();
  }

  public makeShootable(color: THREE.Color | number = 0xff0000) {
    this.shootable = true;

    const cubeMesh = this.children.find(
      (child) => child instanceof THREE.Mesh
    ) as THREE.Mesh;

    this.layers.enable(1); 

    if (cubeMesh && cubeMesh.material instanceof THREE.ShaderMaterial) {
      cubeMesh.material.uniforms.uColor.value.set(color);
    }
  }

  public absorbAndDisappear(callback?: () => void) {
    if (this.animating) return;
    const duration = 1;
    this.animating = true;
    this.shaderMaterial.uniforms.uAbsorbing.value = 1;
    gsap.to(this.shaderMaterial.uniforms.uTime, {
      value: 1,
      duration,
      ease: "power3.in",
      onComplete: () => {
        this.shaderMaterial.uniforms.uAbsorbing.value = 0;
        this.shaderMaterial.uniforms.uTime.value = 0;
        this.visible = false;
        this.animating = false;
        if (callback) callback();
      },
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
    this.visible = true;
    this.shaderMaterial.uniforms.uAppearing.value = 1;
    this.shaderMaterial.uniforms.uTime.value = 0;

    gsap.to(this.shaderMaterial.uniforms.uTime, {
      value: 1,
      duration,
      ease: "back.out(2)",
      onComplete: () => {
        this.shaderMaterial.uniforms.uAppearing.value = 0;
        this.shaderMaterial.uniforms.uTime.value = 0;
        this.animating = false;
        if (callback) callback();
      },
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
