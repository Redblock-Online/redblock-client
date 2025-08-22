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
  public neighborMeshes: Map<string, THREE.Mesh> = new Map();
  private clock = new THREE.Clock();
  private neighborStates = new Map<
    string,
    { target: THREE.Vector3; lastPacketTs: number }
  >();

  // Shared geometry and materials for room meshes
  private static roomGeometry = new THREE.BoxGeometry(1, 1, 1);

  private static roomEdgesGeometry = new THREE.EdgesGeometry(
    MainScene.roomGeometry
  );
  private static roomEdgesMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
  });
  private static roomPrototype = (() => {
    const group = new THREE.Group();

    const edgeLines = new THREE.LineSegments(
      MainScene.roomEdgesGeometry,
      MainScene.roomEdgesMaterial
    );
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
  private generateRoom(
    x: number,
    z: number,
    isNeighbor: boolean = false,
    neighborId?: string
  ) {
    const neighborGeometry = new THREE.BoxGeometry(1, 1, 1);
    const neighborMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(0xffffff),
      opacity: 0,
      transparent: true,
    });
    if (isNeighbor) {
      const neighborMesh = new THREE.Mesh(neighborGeometry, neighborMaterial);
      neighborMesh.position.set(x, 0, z);
      this.neighborMeshes.set(neighborId!, neighborMesh);
      this.add(neighborMesh);
    }

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
    const dt = this.clock.getDelta();
    const neighbors = this.wsManager.getNeighbors();
    const currentIds = new Set<string>();

    neighbors.forEach((n) => {
      currentIds.add(n.id);

      // 1) Rooms: crear/actualizar si cambió la room
      const stored = this.neighborRooms.get(n.id);
      const roomChanged =
        !stored || stored.x !== n.room_coord_x || stored.z !== n.room_coord_z;

      if (roomChanged) {
        // solo la habitación (outlined), sin crear mesh del vecino aquí
        this.generateRoom(n.room_coord_x, n.room_coord_z, false);
        this.neighborRooms.set(n.id, { x: n.room_coord_x, z: n.room_coord_z });
      }

      // 2) Asegurar el mesh del vecino (peón) si no existe
      let mesh = this.neighborMeshes.get(n.id);
      if (!mesh) {
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        mesh = new THREE.Mesh(geom, mat);
        this.neighborMeshes.set(n.id, mesh);
        this.add(mesh);
      }

      // 3) Target global = room_coord + local_player_position
      const target = new THREE.Vector3(
        n.local_player_position_x,
        0,
        n.local_player_position_z
      );

      // 4) Guardar estado y hacer snap si cambió la room
      let st = this.neighborStates.get(n.id);
      if (!st) {
        st = { target: new THREE.Vector3(), lastPacketTs: performance.now() };
        this.neighborStates.set(n.id, st);
      }
      st.target.copy(target);

      if (roomChanged) {
        // evitar que “cruce todo el mapa” cuando cambia de habitación
        mesh.position.copy(target);
      }
    });

    // 5) Suavizado exponencial hacia el target
    const responsiveness = 12; // 6–20
    const alpha = 1 - Math.exp(-responsiveness * dt);
    this.neighborMeshes.forEach((mesh, id) => {
      const st = this.neighborStates.get(id);
      if (!st) return;
      mesh.position.lerp(st.target, alpha);
    });

    // 6) Limpieza de vecinos que ya no están
    Array.from(this.neighborMeshes.keys()).forEach((id) => {
      if (!currentIds.has(id)) {
        const m = this.neighborMeshes.get(id)!;
        this.remove(m);
        this.neighborMeshes.delete(id);
        this.neighborStates.delete(id);
        this.neighborRooms.delete(id);
      }
    });
  }
}
