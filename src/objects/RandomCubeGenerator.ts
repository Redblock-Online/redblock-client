import * as THREE from "three";
import Target from "./Target";
import WSManager from "@/utils/ws/WSManager";

export default class RandomCubeGenerator {
  private scene: THREE.Scene;
  private targets: Target[] = [];
  private randomColors: boolean;
  private wsManager: WSManager;
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

    while (attempt < maxAttempts) {
      const color = this.randomColors ? Math.random() * 0xffffff : 0xffffff;
      
      target = new Target(color, true, shootable, halfSize);

      const randomY = Math.random() * 3 - 1.5;
      const randomZ = Math.random() * 5.8 - 2.7;
      const randomX = 6 - Math.random() * 2;
      target.position.set(randomX, randomY, randomZ);

      const newBox = new THREE.Box3().setFromObject(target);

      const collides = this.targets.some((existingTarget) => {
        const existingBox = new THREE.Box3().setFromObject(existingTarget);
        return newBox.intersectsBox(existingBox);
      });

      if (!collides) break;

      target = null; // discard and try again
      attempt++;
    }

    if (target) {
      this.targets.push(target);
    } else {
      console.warn(
        "⚠️ Failed to place target without collision after max attempts."
      );
    }
  }
}
