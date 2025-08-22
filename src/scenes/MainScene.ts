// Main scene setup
import * as THREE from "three";
import RandomCubeGenerator from "../objects/RandomCubeGenerator";
import Light from "../objects/Light";
import Cube from "../objects/Cube";
import type { PlayerCore } from "../utils/ws/WSManager";
import WSManager from "../utils/ws/WSManager";

// Helpers fuera de la clase
function quatFromPitchYaw(pitchRad: number, yawRad: number): THREE.Quaternion {
  // YXZ: primero yaw (Y), después pitch (X)
  const e = new THREE.Euler(0, yawRad, pitchRad, "YXZ");
  const q = new THREE.Quaternion();
  q.setFromEuler(e);
  return q.normalize();
}

function getTargetQuatFromNet(n: any): THREE.Quaternion {
  // Swap: usamos player_rotation_y como pitch y player_rotation_x como yaw
  const yaw = typeof n.player_rotation_x === "number" ? n.player_rotation_x : 0; // eje Y
  const pitch =
    typeof n.player_rotation_y === "number" ? n.player_rotation_y : 0; // eje X

  // Clamp para evitar flips extremos
  const halfPi = Math.PI / 2;
  const pitchClamped = Math.max(-halfPi + 1e-3, Math.min(halfPi - 1e-3, pitch));

  return quatFromPitchYaw(pitchClamped, yaw);
}

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

  private static floorGeom = new THREE.PlaneGeometry(1, 1);
  private static floorEdgesGeom = new THREE.EdgesGeometry(MainScene.floorGeom);
  private static floorEdgesMat = new THREE.LineBasicMaterial({
    color: 0x000000,
  });

  private static roomPrototype = (() => {
    const group = new THREE.Group();

    const floorEdges = new THREE.LineSegments(
      MainScene.floorEdgesGeom,
      MainScene.floorEdgesMat
    );
    floorEdges.rotation.x = -Math.PI / 2;
    floorEdges.position.y = -2;
    group.add(floorEdges);
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
    room.position.set(x, -0.5, z);
    room.scale.set(20, 1, 20);
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

      const stored = this.neighborRooms.get(n.id);
      const roomChanged =
        !stored || stored.x !== n.room_coord_x || stored.z !== n.room_coord_z;

      if (roomChanged) {
        this.generateRoom(n.room_coord_x, n.room_coord_z);
        this.neighborRooms.set(n.id, { x: n.room_coord_x, z: n.room_coord_z });
      }

      let mesh = this.neighborMeshes.get(n.id);
      if (!mesh) {
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        mesh = new THREE.Mesh(geom, mat);
        this.neighborMeshes.set(n.id, mesh);
        this.add(mesh);
      }

      // Objetivos desde red
      const targetPos = new THREE.Vector3(
        n.local_player_position_x,
        n.local_player_position_y ?? 0,
        n.local_player_position_z
      );
      const targetQuat = getTargetQuatFromNet(n);

      // Estado por vecino
      let st = this.neighborStates.get(n.id) as any;
      if (!st) {
        st = {
          target: new THREE.Vector3(),
          targetQuat: new THREE.Quaternion(),
          lastPacketTs: performance.now(),
        };
        this.neighborStates.set(n.id, st);
      }

      st.target.copy(targetPos);
      st.targetQuat.copy(targetQuat);
      st.lastPacketTs = performance.now();

      if (roomChanged) {
        // Si cambió de room, salta directo para evitar "desliz"
        mesh.position.copy(targetPos);
        mesh.quaternion.copy(targetQuat);
      }
    });

    // Interpolación suave
    const responsiveness = 12; // sube/baja para más/menos reactividad
    const alpha = 1 - Math.exp(-responsiveness * dt);
    const alphaRot = alpha; // puedes usar otro valor si quieres distinta suavidad

    this.neighborMeshes.forEach((mesh, id) => {
      const st = this.neighborStates.get(id) as any;
      if (!st) return;

      // Posición
      mesh.position.lerp(st.target, alpha);
      // Rotación (quaternion)
      mesh.quaternion.slerp(st.targetQuat, alphaRot);
    });

    // Limpieza de desconectados
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
