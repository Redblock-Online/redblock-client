import * as THREE from "three";
import { EffectComposer, RenderPass, ShaderPass } from "three/examples/jsm/Addons.js";
import CustomOutlinePass from "./CustomPass/CustomOutlinePass";

const minPixelRatio = 1;
const maxPixelRatio = 1.25; // Aggressively reduced for toaster-level performance
const pixelRatio = Math.min(maxPixelRatio, Math.max(minPixelRatio, window.devicePixelRatio));

export default class Renderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  private fxaaPass?: ShaderPass;
  private outlinePass?: CustomOutlinePass;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, canvas?: HTMLCanvasElement) {
    this.camera = camera;

    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: false, // Disabled for performance - outline pass provides edge definition
      alpha: false,
      powerPreference: "high-performance",
      precision: "mediump" // Reduced from highp for better performance
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    
    // Shadows disabled for maximum performance (visual style doesn't require them)
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;

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
        edgeStrength: 0.8, // Reduced for faster processing
        edgeThreshold: 0.005, // Increased threshold = fewer edges detected
        thickness: 0.8, // Thinner edges = faster
        normalThreshold: 0.2, // Higher threshold = fewer edges
        normalStrength: 0.8,
        outlineColor: 0x000000,
      }
    );
    this.outlinePass.renderToScreen = true;
    this.composer.addPass(this.outlinePass);
    
    // Handle resize
    window.addEventListener("resize", () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);

      // update passes
      if (this.outlinePass) {
        this.outlinePass.setSize(width, height);
      }
      if (this.fxaaPass) {
        this.fxaaPass.material.uniforms["resolution"].value.set(
          1 / (width * pixelRatio),
          1 / (height * pixelRatio)
        );
      }
    });
  }

  get instance() {
    // Return composer so your Loop uses composer.render()
    return this.composer;
  }
}
