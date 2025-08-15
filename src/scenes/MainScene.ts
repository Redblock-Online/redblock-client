// Main scene setup
import * as THREE from "three";
import RandomCubeGenerator from "../objects/RandomCubeGenerator";
import Light from "../objects/Light";
import Cube from "../objects/Cube";
import type { PlayerCore } from "../utils/ws/WSManager";
import WSManager from "../utils/ws/WSManager";
export default class MainScene extends THREE.Scene {
  public targets: Cube[] = [];
  public neighbors: PlayerCore[] = [];
  public me: PlayerCore;
  public wsManager: WSManager;
  constructor(
    targets: Cube[],
    neighbors: PlayerCore[],
    me: PlayerCore,
    wsManager: WSManager
  ) {
    super();
    const white = new THREE.Color(0xffffff);
    this.background = white;
    this.neighbors = neighbors;
    this.targets = targets;
    this.me = me;
    this.wsManager = wsManager;
    const light = new Light();
    this.add(light);
  }

  public initPlayerRoom(playerCore: PlayerCore) {
    this.me = playerCore;
    console.log(this.me, "me", this.neighbors, "neighbors");
    this.generateRoom(playerCore.room_coord_x, playerCore.room_coord_z);
  }
  private generateRoom(x: number, z: number) {
    const room = new Cube(false, false, false, true);
    room.position.set(x, 0, z);

    room.scale.set(15, 7, 15);
    this.add(room);
  }

  public level(level: number) {
    if (level === 1) {
      this.generateCubes(3);
      return;
    }
    if (level === 2) {
      this.generateCubes(8);
      return;
    }
    if (level === 3) {
      this.generateCubes(50);
      return;
    }
    this.generateCubes();

    this.neighbors.forEach((neighbor) => {
      this.generateRoom(neighbor.room_coord_x, neighbor.room_coord_z);
    });
  }

  public generateCubes(amount: number = 3) {
    const rcg = new RandomCubeGenerator(
      this.targets,
      this,
      false,
      this.wsManager
    );
    rcg.generate(true);
    for (let i = 0; i < amount - 1; i++) {
      rcg.generate();
    }
  }
}
