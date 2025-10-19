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
  private lastRenderTime: number = 0;
  private readonly minFrameTime = 1000 / 144; // Cap at 144fps to save resources
  
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
    
    // Frame rate limiter - skip frame if too soon (save CPU/GPU on high-refresh displays)
    if (now - this.lastRenderTime < this.minFrameTime) {
      requestAnimationFrame(this.animate);
      return;
    }
    
    this.deltaTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.lastRenderTime = now;
    this.frameCount++;
    
    // Clean up completed GSAP tweens every 1200 frames (~20 seconds at 60fps)
    // Reduced frequency from 600 to 1200 for less overhead
    if (this.frameCount % 1200 === 0) {
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
