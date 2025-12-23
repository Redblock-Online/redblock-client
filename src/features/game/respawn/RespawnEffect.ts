import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * Respawn visual effect with bloom and noise
 * Creates a fade in/out effect with bloom and noise when player respawns
 */
export class RespawnEffect {
  private composer: EffectComposer;
  private respawnPass: ShaderPass;
  private isActive = false;
  private startTime = 0;
  private duration = 0.4; // 0.4 seconds
  
  /**
   * Custom shader for respawn effect
   * Creates a glitch/distortion effect simulating spatial reconstruction
   */
  private static RespawnShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uIntensity: { value: 0 }, // 0 to 1, controls effect strength
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      
      // Hash function for better randomness
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.13);
        p3 += dot(p3, p3.yzx + 3.333);
        return fract((p3.x + p3.y) * p3.z);
      }
      
      // Smooth noise
      float noise(vec2 x) {
        vec2 i = floor(x);
        vec2 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      
      // Fractal Brownian Motion for organic distortion
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for(int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      void main() {
        vec2 uv = vUv;
        
        if (uIntensity > 0.0) {
          // Radial distance from center for vignette effect
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(uv, center);
          
          // Chromatic aberration (RGB split) - stronger at edges
          float aberration = uIntensity * 0.015 * dist;
          vec2 direction = normalize(uv - center);
          
          // Sample RGB channels separately for chromatic effect
          float r = texture2D(tDiffuse, uv + direction * aberration).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv - direction * aberration).b;
          
          // Glitch distortion - horizontal displacement
          float glitchNoise = noise(vec2(uv.y * 20.0, uTime * 10.0));
          float glitchStrength = step(0.85, glitchNoise) * uIntensity;
          float displacement = (hash(vec2(floor(uv.y * 30.0), uTime * 5.0)) - 0.5) * glitchStrength * 0.1;
          
          // Apply glitch displacement
          if (glitchStrength > 0.0) {
            r = texture2D(tDiffuse, vec2(uv.x + displacement, uv.y) + direction * aberration).r;
            g = texture2D(tDiffuse, vec2(uv.x + displacement, uv.y)).g;
            b = texture2D(tDiffuse, vec2(uv.x + displacement, uv.y) - direction * aberration).b;
          }
          
          vec3 color = vec3(r, g, b);
          
          // Scanlines effect
          float scanline = sin(uv.y * 800.0 + uTime * 10.0) * 0.5 + 0.5;
          scanline = mix(1.0, scanline, uIntensity * 0.15);
          color *= scanline;
          
          // Pixelation/mosaic effect at peak intensity
          if (uIntensity > 0.6) {
            float pixelSize = 200.0 - (uIntensity * 150.0); // More pixelation at higher intensity
            vec2 pixelatedUV = floor(uv * pixelSize) / pixelSize;
            color = texture2D(tDiffuse, pixelatedUV).rgb;
          }
          
          // Vignette darkening at edges
          float vignette = 1.0 - dist * 0.8;
          vignette = mix(1.0, vignette, uIntensity * 0.5);
          color *= vignette;
          
          // Subtle color shift (cyan/magenta tint)
          vec3 tint = vec3(0.5 + sin(uTime * 3.0) * 0.3, 0.5, 0.5 + cos(uTime * 3.0) * 0.3);
          color = mix(color, color * tint, uIntensity * 0.2);
          
          // Digital noise overlay
          float digitalNoise = hash(uv * 1000.0 + uTime * 100.0);
          color += (digitalNoise - 0.5) * uIntensity * 0.08;
          
          gl_FragColor = vec4(color, 1.0);
        } else {
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      }
    `,
  };
  
  constructor(composer: EffectComposer) {
    this.composer = composer;
    
    // Create the respawn shader pass
    this.respawnPass = new ShaderPass(RespawnEffect.RespawnShader);
    this.respawnPass.enabled = false; // Disabled by default
    
    // Add to composer (should be added near the end, before final passes)
    this.composer.addPass(this.respawnPass);
    
    console.log("[RespawnEffect] Initialized");
  }
  
  /**
   * Trigger the respawn effect
   * @param duration - Duration of the effect in seconds (default: 0.4)
   */
  public trigger(duration: number = 0.4): void {
    this.isActive = true;
    this.startTime = performance.now() / 1000; // Convert to seconds
    this.duration = duration;
    this.respawnPass.enabled = true;
    
    console.log("[RespawnEffect] Triggered - duration:", duration);
  }
  
  /**
   * Update the effect (call every frame)
   * @param currentTime - Current time in seconds
   */
  public update(currentTime: number): void {
    if (!this.isActive) return;
    
    const elapsed = currentTime - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1.0);
    
    // Ease in-out curve for smooth fade
    // Peak at 0.5 (middle of animation)
    let intensity: number;
    if (progress < 0.5) {
      // Fade in (0 to 1)
      intensity = progress * 2.0;
    } else {
      // Fade out (1 to 0)
      intensity = (1.0 - progress) * 2.0;
    }
    
    // Apply easing for smoother animation
    intensity = this.easeInOutCubic(intensity);
    
    // Update shader uniforms
    this.respawnPass.uniforms.uIntensity.value = intensity;
    this.respawnPass.uniforms.uTime.value = currentTime;
    
    // Disable effect when complete
    if (progress >= 1.0) {
      this.isActive = false;
      this.respawnPass.enabled = false;
      console.log("[RespawnEffect] Completed");
    }
  }
  
  /**
   * Cubic ease in-out function for smooth animation
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  /**
   * Check if effect is currently active
   */
  public isPlaying(): boolean {
    return this.isActive;
  }
  
  /**
   * Force stop the effect
   */
  public stop(): void {
    this.isActive = false;
    this.respawnPass.enabled = false;
    this.respawnPass.uniforms.uIntensity.value = 0;
  }
  
  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stop();
    // Remove pass from composer
    const passIndex = this.composer.passes.indexOf(this.respawnPass);
    if (passIndex !== -1) {
      this.composer.passes.splice(passIndex, 1);
    }
    console.log("[RespawnEffect] Disposed");
  }
}
