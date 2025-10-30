// Animation/render loop
import * as THREE from "three";
import ControlsWithMovement from "@/systems/ControlsWithMovement";
import Pistol from "@/objects/Pistol";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import MainScene from "@/scenes/MainScene";
import { PhysicsSystem } from "@/systems/PhysicsSystem";
import Camera from "./Camera";
import type Renderer from "./Renderer";

export default class Loop {
  renderer: EffectComposer;
  rendererClass: Renderer | null = null; // Reference to Renderer class for respawn effect
  scene: MainScene;
  camera: THREE.Camera;
  cameraClass: Camera | null = null; // Reference to Camera class for weapon camera sync
  active: boolean;
  public deltaTime: number;
  public lastTime: number;
  controls: ControlsWithMovement;
  pistol: Pistol;
  physicsSystem: PhysicsSystem;
  private frameCount: number = 0;
  private lastRenderTime: number = 0;
  private targetFPS: number = 60; // Will be auto-detected from monitor
  private minFrameTime: number = 1000 / 60; // Dynamic based on targetFPS
  private vsyncEnabled: boolean = true; // VSync enabled by default
  private detectedRefreshRate: number = 60; // Detected monitor refresh rate
  private frameTimeAccumulator: number = 0; // Accumulates time for precise frame limiting
  
  // FPS counter tracking
  private fpsFrameCount: number = 0;
  private lastFPSUpdateTime: number = 0;
  private currentFPS: number = 0;
  
  constructor(
    renderer: EffectComposer,
    scene: MainScene,
    camera: THREE.Camera,
    controls: ControlsWithMovement,
    pistol: Pistol,
    physicsSystem: PhysicsSystem,
    cameraClass?: Camera, // Optional Camera class for weapon camera sync
    rendererClass?: Renderer // Optional Renderer class for respawn effect
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.pistol = pistol;
    this.physicsSystem = physicsSystem;
    this.cameraClass = cameraClass || null;
    this.rendererClass = rendererClass || null;
    this.active = false;

    this.deltaTime = 0;
    this.lastTime = performance.now();
    this.lastFPSUpdateTime = performance.now();
    
    // Detect monitor refresh rate
    this.detectRefreshRate();
    
    // Load VSync settings from localStorage (will override if user has custom settings)
    this.loadVSyncSettings();
  }
  
  /**
   * Detect monitor refresh rate using requestAnimationFrame timing
   */
  private detectRefreshRate(): void {
    // Try to get refresh rate from screen API (modern browsers)
    if (typeof window !== 'undefined' && window.screen) {
      // @ts-ignore - screen.refreshRate is not in all type definitions
      const screenRefreshRate = window.screen.refreshRate;
      if (screenRefreshRate && screenRefreshRate > 0) {
        this.detectedRefreshRate = Math.round(screenRefreshRate);
        console.log(`[Loop] Detected monitor refresh rate: ${this.detectedRefreshRate}Hz`);
        return;
      }
    }
    
    // Fallback: Measure frame timing to estimate refresh rate
    let frameCount = 0;
    let lastTime = performance.now();
    const samples: number[] = [];
    
    const measureFrame = () => {
      const now = performance.now();
      const delta = now - lastTime;
      
      if (delta > 0) {
        samples.push(1000 / delta); // Convert to FPS
      }
      
      lastTime = now;
      frameCount++;
      
      if (frameCount < 60) {
        requestAnimationFrame(measureFrame);
      } else {
        // Calculate average FPS from samples
        const avgFPS = samples.reduce((a, b) => a + b, 0) / samples.length;
        
        // Round to common refresh rates
        if (avgFPS >= 235) this.detectedRefreshRate = 240;
        else if (avgFPS >= 140) this.detectedRefreshRate = 144;
        else if (avgFPS >= 115) this.detectedRefreshRate = 120;
        else if (avgFPS >= 90) this.detectedRefreshRate = 100;
        else if (avgFPS >= 72) this.detectedRefreshRate = 75;
        else this.detectedRefreshRate = 60;
        
        console.log(`[Loop] Estimated monitor refresh rate: ${this.detectedRefreshRate}Hz (measured: ${avgFPS.toFixed(1)}fps)`);
      }
    };
    
    requestAnimationFrame(measureFrame);
  }
  
  /**
   * Load VSync settings from localStorage
   */
  private loadVSyncSettings(): void {
    try {
      const settings = localStorage.getItem('graphicsSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this.vsyncEnabled = parsed.vsync ?? true;
        // Use saved targetFPS if exists, otherwise use detected refresh rate
        this.targetFPS = parsed.targetFPS ?? this.detectedRefreshRate;
        this.minFrameTime = 1000 / this.targetFPS;
        console.log(`[Loop] Loaded VSync settings: ${this.vsyncEnabled ? this.targetFPS + 'fps' : 'unlimited'}`);
      } else {
        // No saved settings, use detected refresh rate as default
        this.targetFPS = this.detectedRefreshRate;
        this.minFrameTime = 1000 / this.targetFPS;
        console.log(`[Loop] Using detected refresh rate as default: ${this.targetFPS}fps`);
      }
    } catch (e) {
      console.warn('Failed to load VSync settings:', e);
      // Fallback to detected refresh rate
      this.targetFPS = this.detectedRefreshRate;
      this.minFrameTime = 1000 / this.targetFPS;
    }
  }
  
  /**
   * Set target FPS (VSync)
   * @param fps - Target frames per second (30, 60, 75, 120, 144, 240, or 0 for unlimited)
   */
  public setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.minFrameTime = fps > 0 ? 1000 / fps : 0;
    this.vsyncEnabled = fps > 0;
    
    // Save to localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('graphicsSettings') || '{}');
      settings.vsync = this.vsyncEnabled;
      settings.targetFPS = this.targetFPS;
      localStorage.setItem('graphicsSettings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save VSync settings:', e);
    }
  }
  
  /**
   * Get current target FPS
   */
  public getTargetFPS(): number {
    return this.targetFPS;
  }
  
  /**
   * Get detected monitor refresh rate
   */
  public getDetectedRefreshRate(): number {
    return this.detectedRefreshRate;
  }
  
  /**
   * Check if VSync is enabled
   */
  public isVSyncEnabled(): boolean {
    return this.vsyncEnabled;
  }
  
  /**
   * Update FPS counter and emit event
   */
  private updateFPSCounter(): void {
    this.fpsFrameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFPSUpdateTime;
    
    // Update FPS every second
    if (deltaTime >= 1000) {
      this.currentFPS = Math.round((this.fpsFrameCount * 1000) / deltaTime);
      this.fpsFrameCount = 0;
      this.lastFPSUpdateTime = currentTime;
      
      // Emit FPS update event
      window.dispatchEvent(new CustomEvent('fpsUpdate', { 
        detail: { fps: this.currentFPS } 
      }));
    }
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
    const elapsed = now - this.lastRenderTime;
    
    // Accumulate frame time for precise limiting
    this.frameTimeAccumulator += elapsed;
    
    // VSync: Frame rate limiter - skip frame if accumulated time is less than target
    // This provides more accurate frame timing than simple threshold check
    if (this.vsyncEnabled && this.frameTimeAccumulator < this.minFrameTime) {
      requestAnimationFrame(this.animate);
      this.lastRenderTime = now;
      return; // Skip this frame - don't count it in FPS
    }
    
    // Reset accumulator (subtract minFrameTime to carry over any excess)
    if (this.vsyncEnabled) {
      this.frameTimeAccumulator -= this.minFrameTime;
      // Clamp accumulator to prevent spiral of death
      if (this.frameTimeAccumulator > this.minFrameTime) {
        this.frameTimeAccumulator = 0;
      }
    }
    
    // Frame is being rendered - count it for FPS
    this.updateFPSCounter();
    
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
    
    // Sync weapon camera with main camera (for separate FOV)
    if (this.cameraClass) {
      this.cameraClass.syncWeaponCamera();
    }
    
    this.pistol.update(this.deltaTime, this.camera);
    this.scene.update();
    
    // Update respawn effect if available
    if (this.rendererClass?.respawnEffect) {
      this.rendererClass.respawnEffect.update(now / 1000); // Convert to seconds
    }
    
    requestAnimationFrame(this.animate);
    this.renderer.render(this.deltaTime);
  };
}
