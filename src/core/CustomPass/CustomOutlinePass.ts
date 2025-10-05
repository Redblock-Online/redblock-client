import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

type Uniforms = { [key: string]: THREE.IUniform };

function getCameraNearFar(camera: THREE.Camera): { near: number; far: number } {
  const asAny = camera as unknown as { near?: number; far?: number };
  const near = typeof asAny.near === "number" ? asAny.near : 0.1;
  const far = typeof asAny.far === "number" ? asAny.far : 1000;
  return { near, far };
}

export default class CustomOutlinePass extends Pass {
  scene: THREE.Scene;
  camera: THREE.Camera;

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
      edgeStrength?: number;
      edgeThreshold?: number;
      thickness?: number;
      normalThreshold?: number;
      normalStrength?: number;
      outlineColor?: THREE.Color | number | string;
    }
  ) {
    super();

    this.scene = scene;
    this.camera = camera;

    const width = Math.max(1, Math.floor(size.x));
    const height = Math.max(1, Math.floor(size.y));

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

    this.normalMaterial = new THREE.MeshNormalMaterial({ flatShading: true });
    this.normalMaterial.depthTest = true;
    this.normalMaterial.depthWrite = true;
    this.normalMaterial.transparent = false;

    const outlineColor = new THREE.Color(options?.outlineColor ?? 0x000000);

    const { near: initNear, far: initFar } = getCameraNearFar(this.camera);
    this.uniforms = {
      tDiffuse: { value: null },
      tDepth: { value: this.depthTexture },
      tNormal: { value: this.rtNormalsDepth.texture },
      cameraNear: { value: initNear },
      cameraFar: { value: initFar },
      resolution: { value: new THREE.Vector2(width, height) },
      edgeThreshold: { value: options?.edgeThreshold ?? 0.0025 },
      edgeStrength: { value: options?.edgeStrength ?? 1.0 },
      thickness: { value: options?.thickness ?? 1.0 },
      normalThreshold: { value: options?.normalThreshold ?? 0.15 },
      normalStrength: { value: options?.normalStrength ?? 1.0 },
      outlineColor: {
        value: new THREE.Vector3(outlineColor.r, outlineColor.g, outlineColor.b),
      },
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

        uniform float edgeThreshold;
        uniform float edgeStrength;
        uniform float thickness;

        uniform float normalThreshold;
        uniform float normalStrength;

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
            float ndelta = 1.0 - nDot;
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

    const prevBG = this.scene.background;
    const prevOM = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.normalMaterial;
    this.scene.background = null;

    renderer.setRenderTarget(this.rtNormalsDepth);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    this.scene.overrideMaterial = prevOM;
    this.scene.background = prevBG;

    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.tDepth.value = this.depthTexture;
    this.uniforms.tNormal.value = this.rtNormalsDepth.texture;
    const { near, far } = getCameraNearFar(this.camera);
    this.uniforms.cameraNear.value = near;
    this.uniforms.cameraFar.value = far;

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
    this.rtNormalsDepth.depthTexture = this.depthTexture;

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
