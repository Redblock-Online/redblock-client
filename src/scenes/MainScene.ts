// Main scene setup
import * as THREE from "three";
import RandomCubeGenerator from "../objects/RandomCubeGenerator";
import Light from "../objects/Light";
import Cube from "../objects/Cube";
import type { PlayerCore } from "../utils/ws/WSManager";
import WSManager from "../utils/ws/WSManager";
export default class MainScene extends THREE.Scene {
  private neighborRooms: Map<string, { x: number; z: number }> = new Map();
  public targets: Cube[] = [];
  public me: PlayerCore;
  public wsManager: WSManager;

  // Shared geometry and materials for room meshes
  private static roomGeometry = new THREE.BoxGeometry(1, 1, 1);
  private static roomMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private static roomEdgesGeometry = new THREE.EdgesGeometry(MainScene.roomGeometry);
  private static roomEdgesMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
  });
  private static roomPrototype = (() => {
    const group = new THREE.Group();
    const cubeMesh = new THREE.Mesh(
      MainScene.roomGeometry,
      MainScene.roomMaterial
    );
    const edgeLines = new THREE.LineSegments(
      MainScene.roomEdgesGeometry,
      MainScene.roomEdgesMaterial
    );
    group.add(cubeMesh);
    group.add(edgeLines);
    return group;
  })();
  constructor(targets: Cube[], me: PlayerCore, wsManager: WSManager) {
    super();
    const white = new THREE.Color(0xffffff);
    this.background = white;
    this.targets = targets;
    this.me = me;
    this.wsManager = wsManager;
    const light = new Light();
    this.add(light);
  }

  public initPlayerRoom(playerCore: PlayerCore) {
    this.me = playerCore;
    console.log(this.me, "me", this.wsManager.getNeighbors(), "neighbors");
    this.generateRoom(playerCore.room_coord_x, playerCore.room_coord_z);
  }
  private generateRoom(x: number, z: number) {
    const room = MainScene.roomPrototype.clone();
    room.position.set(x, 0, z);
    room.scale.set(15, 7, 15);
    this.add(room);
  }

  public level(level: number) {
    if (level === 1) {
      this.generateCubes(3, this.me.room_coord_x, this.me.room_coord_z);
      return;
    }
    if (level === 2) {
      this.generateCubes(8, this.me.room_coord_x, this.me.room_coord_z);
      return;
    }
    if (level === 3) {
      this.generateCubes(50, this.me.room_coord_x, this.me.room_coord_z);
      return;
    }
    this.generateCubes(3, this.me.room_coord_x, this.me.room_coord_z);

    this.wsManager.getNeighbors().forEach((neighbor) => {
      this.generateRoom(neighbor.room_coord_x, neighbor.room_coord_z);
      this.neighborRooms.set(neighbor.id, {
        x: neighbor.room_coord_x,
        z: neighbor.room_coord_z,
      });
    });
  }

  public generateCubes(amount: number, roomCoordX: number, roomCoordZ: number) {
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
    this.targets.forEach((target) => {
      target.position.set(
        target.position.x + roomCoordX,
        target.position.y,
        target.position.z + roomCoordZ
      );
      this.add(target);
    });
  }

  public update() {
    const neighbors = this.wsManager.getNeighbors();
    const currentIds = new Set<string>();

    neighbors.forEach((neighbor) => {
      currentIds.add(neighbor.id);
      const stored = this.neighborRooms.get(neighbor.id);
      if (
        !stored ||
        stored.x !== neighbor.room_coord_x ||
        stored.z !== neighbor.room_coord_z
      ) {
        this.generateRoom(neighbor.room_coord_x, neighbor.room_coord_z);
        this.neighborRooms.set(neighbor.id, {
          x: neighbor.room_coord_x,
          z: neighbor.room_coord_z,
        });
      }
    });

    Array.from(this.neighborRooms.keys()).forEach((id) => {
      if (!currentIds.has(id)) {
        this.neighborRooms.delete(id);
      }
    });
  }
}
