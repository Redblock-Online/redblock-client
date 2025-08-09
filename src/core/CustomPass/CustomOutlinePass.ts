import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

type Uniforms = { [key: string]: THREE.IUniform };

export default class CustomOutlinePass extends Pass {
  scene: THREE.Scene;
  camera: THREE.Camera;

  // One RT that stores normals in color and depth in a depthTexture
  rtNormalsDepth: THREE.WebGLRenderTarget;
  depthTexture: THREE.DepthTexture;
  normalMaterial: THREE.MeshNormalMaterial;

  fsQuad: FullScreenQuad;
  uniforms: Uniforms;

  constructor(
    size: THREE.Vector2,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options?: {
      edgeStrength?: number;    // weight for depth edges
      edgeThreshold?: number;   // sensitivity for depth edges
      thickness?: number;       // kernel radius in pixels
      normalThreshold?: number; // sensitivity for normal edges
      normalStrength?: number;  // weight for normal edges
      outlineColor?: THREE.Color | number | string;
    }
  ) {
    super();

    this.scene = scene;
    this.camera = camera;

    const width = Math.max(1, Math.floor(size.x));
    const height = Math.max(1, Math.floor(size.y));

    // ---- RT for normals (color) + depth (depthTexture). This guarantees occlusion correctness.
    this.depthTexture = new THREE.DepthTexture(width, height);
    this.depthTexture.type = THREE.UnsignedShortType;
    this.depthTexture.format = THREE.DepthFormat;

    this.rtNormalsDepth = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: this.depthTexture,
      depthBuffer: true,
      stencilBuffer: false,
    });

    // Mesh normals (view-space). flatShading ayuda a marcar aristas internas.
    this.normalMaterial = new THREE.MeshNormalMaterial({ flatShading: true });
    this.normalMaterial.depthTest = true;   // ensure depth test is used
    this.normalMaterial.depthWrite = true;  // write depth so nearest fragments win
    this.normalMaterial.transparent = false;

    const outlineColor = new THREE.Color(options?.outlineColor ?? 0x000000);

    this.uniforms = {
      tDiffuse:   { value: null },                              // scene color
      tDepth:     { value: this.depthTexture },                  // depth from rtNormalsDepth
      tNormal:    { value: this.rtNormalsDepth.texture },        // normals color
      cameraNear: { value: (this.camera as any).near ?? 0.1 },
      cameraFar:  { value: (this.camera as any).far ?? 1000 },
      resolution: { value: new THREE.Vector2(width, height) },

      // Depth edges
      edgeThreshold:  { value: options?.edgeThreshold ?? 0.0025 },
      edgeStrength:   { value: options?.edgeStrength ?? 1.0 },
      thickness:      { value: options?.thickness ?? 1.0 },

      // Normal edges
      normalThreshold:{ value: options?.normalThreshold ?? 0.15 },
      normalStrength: { value: options?.normalStrength ?? 1.0 },

      outlineColor:   { value: new THREE.Vector3(outlineColor.r, outlineColor.g, outlineColor.b) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        precision highp sampler2D;

        varying vec2 vUv;

        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform sampler2D tNormal;

        uniform vec2  resolution;
        uniform float cameraNear;
        uniform float cameraFar;

        uniform float edgeThreshold;    // depth sensitivity
        uniform float edgeStrength;     // depth weight
        uniform float thickness;        // kernel radius in pixels

        uniform float normalThreshold;  // normal sensitivity
        uniform float normalStrength;   // normal weight

        uniform vec3  outlineColor;

        float readLinearDepth(sampler2D depthSampler, vec2 uv) {
          float z_b = texture2D(depthSampler, uv).x;
          float z_n = 2.0 * z_b - 1.0;
          return (2.0 * cameraNear) / (cameraFar + cameraNear - z_n * (cameraFar - cameraNear));
        }

        vec3 readNormal(sampler2D normalSampler, vec2 uv) {
          vec3 n = texture2D(normalSampler, uv).xyz * 2.0 - 1.0;
          return normalize(n);
        }

        void main() {
          vec2 texel = 1.0 / resolution;

          float d0 = readLinearDepth(tDepth, vUv);
          vec3  n0 = readNormal(tNormal, vUv);

          float t = thickness;
          vec2 offsets[8];
          offsets[0] = vec2(-t,  0.0) * texel;
          offsets[1] = vec2( t,  0.0) * texel;
          offsets[2] = vec2( 0.0,-t  ) * texel;
          offsets[3] = vec2( 0.0, t  ) * texel;
          offsets[4] = vec2(-t,-t) * texel;
          offsets[5] = vec2( t,-t) * texel;
          offsets[6] = vec2(-t, t) * texel;
          offsets[7] = vec2( t, t) * texel;

          float maxDepthDelta = 0.0;
          float maxNormalDelta = 0.0;

          for (int i = 0; i < 8; i++) {
            float di = readLinearDepth(tDepth, vUv + offsets[i]);
            maxDepthDelta = max(maxDepthDelta, abs(di - d0));

            vec3 ni = readNormal(tNormal, vUv + offsets[i]);
            float nDot = clamp(dot(n0, ni), -1.0, 1.0);
            float ndelta = 1.0 - nDot; // 0=same, 1=very different
            maxNormalDelta = max(maxNormalDelta, ndelta);
          }

          float edgeDepth  = step(edgeThreshold,   maxDepthDelta);
          float edgeNormal = step(normalThreshold, maxNormalDelta);

          float edge = max(edgeDepth  * edgeStrength,
                           edgeNormal * normalStrength);

          vec4 baseColor = texture2D(tDiffuse, vUv);
          vec3 outCol = mix(baseColor.rgb, outlineColor, edge);

          gl_FragColor = vec4(outCol, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.fsQuad = new FullScreenQuad(material);
    this.needsSwap = true;
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    const prevRT = renderer.getRenderTarget();

    // 1) Render normals+depth in ONE pass, so depth keeps nearest fragments only.
    const prevBG = this.scene.background;
    const prevOM = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.normalMaterial;
    this.scene.background = null;

    renderer.setRenderTarget(this.rtNormalsDepth);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    // Restore scene state
    this.scene.overrideMaterial = prevOM;
    this.scene.background = prevBG;

    // 2) Fullscreen composite
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.tDepth.value   = this.depthTexture;
    this.uniforms.tNormal.value  = this.rtNormalsDepth.texture;
    this.uniforms.cameraNear.value = (this.camera as any).near;
    this.uniforms.cameraFar.value  = (this.camera as any).far;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      this.fsQuad.render(renderer);
    }

    renderer.setRenderTarget(prevRT);
  }

  setSize(width: number, height: number) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));

    this.rtNormalsDepth.setSize(w, h);

    if (this.depthTexture) this.depthTexture.dispose();
    this.depthTexture = new THREE.DepthTexture(w, h);
    this.depthTexture.type = THREE.UnsignedShortType;
    this.depthTexture.format = THREE.DepthFormat;
    (this.rtNormalsDepth as any).depthTexture = this.depthTexture;

    this.uniforms.tDepth.value = this.depthTexture;
    (this.uniforms.resolution.value as THREE.Vector2).set(w, h);
  }

  dispose() {
    this.rtNormalsDepth.dispose();
    this.depthTexture.dispose();
    this.normalMaterial.dispose();
    this.fsQuad.dispose();
  }
}
