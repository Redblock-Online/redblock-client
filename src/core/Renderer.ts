import * as THREE from "three";
import { EffectComposer, RenderPass, ShaderPass } from "three/examples/jsm/Addons.js";
import CustomOutlinePass from "./CustomPass/CustomOutlinePass";

const minPixelRatio = 1;
const maxPixelRatio = 2; // Reduced from 4 to 2 for better performance (still sharp on retina)
const pixelRatio = Math.min(maxPixelRatio, Math.max(minPixelRatio, window.devicePixelRatio));

export default class Renderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  private fxaaPass?: ShaderPass;
  private outlinePass?: CustomOutlinePass;

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

    // 2) Custom outline pass
    this.outlinePass = new CustomOutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      scene,
      camera,
      {
        edgeStrength: 1.0,
        edgeThreshold: 0.0025,
        thickness: 1.0,
        normalThreshold: 0.15,
        normalStrength: 1.0,
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
