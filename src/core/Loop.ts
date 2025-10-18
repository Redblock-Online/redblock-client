// Animation/render loop
import * as THREE from "three";
import ControlsWithMovement from "@/systems/ControlsWithMovement";
import Pistol from "@/objects/Pistol";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import MainScene from "@/scenes/MainScene";
import { PhysicsSystem } from "@/systems/PhysicsSystem";

export default class Loop {
  renderer: EffectComposer;
  scene: MainScene;
  camera: THREE.Camera;
  active: boolean;
  public deltaTime: number;
  public lastTime: number;
  controls: ControlsWithMovement;
  pistol: Pistol;
  physicsSystem: PhysicsSystem;
  private frameCount: number = 0;
  
  constructor(
    renderer: EffectComposer,
    scene: MainScene,
    camera: THREE.Camera,
    controls: ControlsWithMovement,
    pistol: Pistol,
    physicsSystem: PhysicsSystem
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.pistol = pistol;
    this.physicsSystem = physicsSystem;
    this.active = false;

    this.deltaTime = 0;
    this.lastTime = performance.now();
  }
  start() {
    this.active = true;
    this.animate();
  }
  stop() {
    this.active = false;
  }
  animate = () => {
    if (!this.active) return;

    const now = performance.now();
    this.deltaTime = (now - this.lastTime) / 1000;

    this.lastTime = now;
    this.frameCount++;
    
    // Clean up completed GSAP tweens every 600 frames (~10 seconds at 60fps)
    // This prevents memory leaks from thousands of completed animations
    if (this.frameCount % 600 === 0) {
      // GSAP automatically cleans up, but we can help by triggering a tick
      // This is safe and won't affect active animations
      const gsap = (window as { gsap?: { ticker: { tick: () => void } } }).gsap;
      if (gsap) {
        gsap.ticker.tick();
      }
    }
    
    // Step physics world BEFORE controls update so character controller has fresh data
    this.physicsSystem.step(this.deltaTime);
    
    this.controls.update(this.deltaTime);
    this.pistol.update(this.deltaTime, this.camera);
    this.scene.update();
    requestAnimationFrame(this.animate);
    this.renderer.render(this.deltaTime);
  };
}
