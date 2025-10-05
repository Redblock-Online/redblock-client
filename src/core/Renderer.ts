import * as THREE from "three";
import { EffectComposer, FXAAShader, RenderPass, ShaderPass } from "three/examples/jsm/Addons.js";

const minPixelRatio = 1;
const maxPixelRatio = 4; // Increased for better edge rendering
const pixelRatio = Math.min(maxPixelRatio, Math.max(minPixelRatio, window.devicePixelRatio));

export default class Renderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  private fxaaPass?: ShaderPass;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, canvas?: HTMLCanvasElement) {
    this.camera = camera;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(window.innerWidth, window.innerHeight);

    // 1) Base render
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);
    
    // Handle resize
    window.addEventListener("resize", () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);

      // update passes
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
