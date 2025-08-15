import * as THREE from "three";
import Cube from "./Cube";
import WSManager from "../utils/ws/WSManager";

export default class RandomCubeGenerator {
  private scene: THREE.Scene;
  private targets: Cube[] = [];
  private randomColors: boolean;
  private wsManager: WSManager;
  constructor(
    targets: Cube[],
    scene: THREE.Scene,
    randomColors: boolean = false,
    wsManager: WSManager
  ) {
    this.targets = targets;
    this.scene = scene;
    this.randomColors = randomColors;
    this.wsManager = wsManager;
  }

  public generate(shootable: boolean = false) {
    const maxAttempts = 50;
    let cube: Cube | null = null;
    let attempt = 0;

    while (attempt < maxAttempts) {
      cube = new Cube(this.randomColors, true, shootable);
      cube.scale.set(0.4, 0.4, 0.4);

      const randomY = Math.random() * 3 - 1.5;
      const randomZ = Math.random() * 5.8 - 2.7;
      const randomX = 6 - Math.random() * 2;
      cube.position.set(randomX, randomY, randomZ);

      const newBox = new THREE.Box3().setFromObject(cube);

      const collides = this.targets.some((existingCube) => {
        const existingBox = new THREE.Box3().setFromObject(existingCube);
        return newBox.intersectsBox(existingBox);
      });

      if (!collides) break;

      cube = null; // discard and try again
      attempt++;
    }

    if (cube) {
      this.targets.push(cube);
    } else {
      console.warn(
        "⚠️ Failed to place cube without collision after max attempts."
      );
    }
  }
}
