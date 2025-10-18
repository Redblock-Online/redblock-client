import * as THREE from "three";
import Target from "./Target";
import WSManager from "@/utils/ws/WSManager";

export default class RandomCubeGenerator {
  private scene: THREE.Scene;
  private targets: Target[] = [];
  private randomColors: boolean;
  private wsManager: WSManager;
  
  // Reusable Box3 for collision detection
  private _tempBox1 = new THREE.Box3();
  private _tempBox2 = new THREE.Box3();

  constructor(
    targets: Target[],
    scene: THREE.Scene,
    randomColors: boolean = false,
    wsManager: WSManager
  ) {
    this.targets = targets;
    this.scene = scene;
    this.randomColors = randomColors;
    this.wsManager = wsManager;
    void this.scene;
    void this.wsManager;
  }

  public generate(shootable: boolean = false, halfSize: boolean = false) {
    const maxAttempts = 50;
    let target: Target | null = null;
    let attempt = 0;
    let isReusing = false;

    while (attempt < maxAttempts) {
      const color = this.randomColors ? Math.random() * 0xffffff : 0xffffff;
      
      // Try to reuse an invisible target first
      const invisibleTarget = this.targets.find(t => !t.visible && !t.animating);
      if (invisibleTarget) {
        // Reusing invisible target
        target = invisibleTarget;
        isReusing = true;
        
        // Kill any active tweens from previous animations
        const activeTweens = (target as { activeTweens?: Array<{ kill: () => void }> }).activeTweens;
        if (activeTweens && Array.isArray(activeTweens)) {
          activeTweens.forEach((t) => t.kill());
          activeTweens.length = 0;
        }
        
        target.setColor(color);
        target.baseScale = halfSize ? 0.2 : 0.4;
        target.animating = false;
        // Don't set shootable here - will be set later
      } else {
        // Creating new target
        isReusing = false;
        // Only create new target if no invisible ones available
        target = new Target(color, true, shootable, halfSize);
      }

      const randomY = Math.random() * 3 - 1.5;
      const randomZ = Math.random() * 5.8 - 2.7;
      const randomX = 6 - Math.random() * 2;
      target.position.set(randomX, randomY, randomZ);

      // Reuse Box3 instead of creating new ones
      this._tempBox1.setFromObject(target);

      const collides = this.targets.some((existingTarget) => {
        // Skip collision check with invisible targets (including itself if reusing)
        if (!existingTarget.visible) return false;
        this._tempBox2.setFromObject(existingTarget);
        return this._tempBox1.intersectsBox(this._tempBox2);
      });

      if (!collides) break;

      target = null; // discard and try again
      attempt++;
    }

    if (target) {
      if (!isReusing) {
        // Adding new target to array
        this.targets.push(target);
      } else {
        // If reusing, make it appear instantly
        // Making reused target visible instantly
        target.visible = true;
        target.scale.set(target.baseScale, target.baseScale, target.baseScale);
        target.rotation.set(0, 0, 0);
        const cubeMaterial = target.cubeMesh.material as THREE.Material & { opacity?: number };
        const outlineMaterial = (target as { outlineMesh?: THREE.Mesh }).outlineMesh?.material as THREE.Material & { opacity?: number } | undefined;
        if (cubeMaterial) cubeMaterial.opacity = 1;
        if (outlineMaterial) outlineMaterial.opacity = 1;
        
        // Make it shootable if needed
        if (shootable) {
          // Making reused target shootable
          target.makeShootable();
        }
      }
    } else {
      console.warn(
        "⚠️ Failed to place target without collision after max attempts."
      );
    }
  }
}
