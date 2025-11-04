import * as THREE from "three";
import { EffectComposer, RenderPass, ShaderPass } from "three/examples/jsm/Addons.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import CustomOutlinePass from "./CustomPass/CustomOutlinePass";
import { RespawnEffect } from "@/features/game/respawn";

const minPixelRatio = 1;
const maxPixelRatio = 2.0; // Increased for better antialiasing quality
const pixelRatio = Math.min(maxPixelRatio, Math.max(minPixelRatio, window.devicePixelRatio));

export default class Renderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  private fxaaPass: ShaderPass;
  private smaaPass: SMAAPass;
  private outlinePass: CustomOutlinePass;
  private fxaaEnabled: boolean = true;
  private smaaEnabled: boolean = true;
  public respawnEffect: RespawnEffect | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, canvas?: HTMLCanvasElement) {
    this.camera = camera;

    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: true, // Native MSAA enabled for better quality
      alpha: false,
      powerPreference: "high-performance",
      precision: "highp" // High precision for better antialiasing
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    
    // Shadows disabled for maximum performance (visual style doesn't require them)
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Load graphics settings
    const savedSettings = localStorage.getItem("graphicsSettings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        this.fxaaEnabled = settings.fxaa !== false; // Default true
        this.smaaEnabled = settings.smaa !== false; // Default true
      } catch {
        this.fxaaEnabled = true;
        this.smaaEnabled = true;
      }
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(window.innerWidth, window.innerHeight);

    // 1) Base render
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // 2) Custom outline pass (simplified settings for performance)
    this.outlinePass = new CustomOutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      scene,
      camera,
      {
        edgeStrength: 0.8,
        edgeThreshold: 0.005,
        thickness: 0.8,
        normalThreshold: 0.2,
        normalStrength: 0.8,
        outlineColor: 0x000000,
      }
    );
    this.composer.addPass(this.outlinePass);
    
    // 2.5) Respawn effect (bloom + noise) - Added before AA passes
    this.respawnEffect = new RespawnEffect(this.composer);
    
    // 3) SMAA (Subpixel Morphological Anti-Aliasing) - High quality AA
    this.smaaPass = new SMAAPass();
    this.smaaPass.enabled = this.smaaEnabled;
    this.composer.addPass(this.smaaPass);
    
    // 4) FXAA (Fast Approximate Anti-Aliasing) - Additional smoothing pass
    this.fxaaPass = new ShaderPass(FXAAShader);
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.fxaaPass.material.uniforms["resolution"].value.set(
      1 / (resolution.x * pixelRatio),
      1 / (resolution.y * pixelRatio)
    );
    this.fxaaPass.enabled = this.fxaaEnabled;
    this.fxaaPass.renderToScreen = true;
    this.composer.addPass(this.fxaaPass);
    
    // Listen for graphics settings changes
    window.addEventListener("graphicsSettingsChanged", ((e: CustomEvent) => {
      if (e.detail) {
        if (e.detail.fxaa !== undefined) {
          this.setFXAA(e.detail.fxaa);
        }
        if (e.detail.smaa !== undefined) {
          this.setSMAA(e.detail.smaa);
        }
      }
    }) as EventListener);
    
    // Handle resize
    window.addEventListener("resize", () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);

      // update passes
      this.outlinePass.setSize(width, height);
      // SMAA handles resolution internally
      this.fxaaPass.material.uniforms["resolution"].value.set(
        1 / (width * pixelRatio),
        1 / (height * pixelRatio)
      );
    });
  }

  get instance() {
    // Return composer so your Loop uses composer.render()
    return this.composer;
  }
  
  /**
   * Enable or disable FXAA antialiasing
   */
  public setFXAA(enabled: boolean): void {
    this.fxaaEnabled = enabled;
    this.fxaaPass.enabled = enabled;
    console.log(`[Renderer] FXAA ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Enable or disable SMAA antialiasing
   */
  public setSMAA(enabled: boolean): void {
    this.smaaEnabled = enabled;
    this.smaaPass.enabled = enabled;
    console.log(`[Renderer] SMAA ${enabled ? 'enabled' : 'disabled'}`);
  }
}
