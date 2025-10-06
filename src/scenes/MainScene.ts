// Main scene setup
import * as THREE from "three";
import RandomCubeGenerator from "@/objects/RandomCubeGenerator";
import Light from "@/objects/Light";
import Target from "@/objects/Target";
import type { PlayerCore } from "@/utils/ws/WSManager";
import WSManager from "@/utils/ws/WSManager";
export type TargetInfo = {
  x: number;
  y: number;
  z: number;
  shootable: boolean;
  disabled: boolean;
};

type NeighborState = {
  target: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  lastPacketTs: number;
};
// Helpers fuera de la clase
function quatFromPitchYaw(pitchRad: number, yawRad: number): THREE.Quaternion {
  // YXZ: primero yaw (Y), después pitch (X)
  const e = new THREE.Euler(0, yawRad, pitchRad, "YXZ");
  const q = new THREE.Quaternion();
  q.setFromEuler(e);
  return q.normalize();
}

type NetRotationPayload = Pick<Partial<PlayerCore>, "player_rotation_x" | "player_rotation_y">;

function getTargetQuatFromNet(n: NetRotationPayload): THREE.Quaternion {
  // Swap: usamos player_rotation_y como pitch y player_rotation_x como yaw
  const yaw = typeof n.player_rotation_x === "number" ? n.player_rotation_x : 0; // eje Y
  const pitch =
    typeof n.player_rotation_y === "number" ? n.player_rotation_y : 0; // eje X

  // Clamp para evitar flips extremos
  const halfPi = Math.PI / 2;
  const pitchClamped = Math.max(-halfPi + 1e-3, Math.min(halfPi - 1e-3, pitch));

  return quatFromPitchYaw(pitchClamped, yaw);
}

/**
 * Compares two arrays of TargetInfo to check if there are any changes.
 * Returns true if changed, false otherwise.
 */
function targetsInfoChanged(prev: TargetInfo[], next: TargetInfo[]): boolean {
  if (prev.length !== next.length) return true;

  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.x !== b.x ||
      a.y !== b.y ||
      a.z !== b.z ||
      a.shootable !== b.shootable ||
      a.disabled !== b.disabled
    ) {
      return true;
    }
  }

  return false;
}

export default class MainScene extends THREE.Scene {
  private neighborRooms: Map<string, { x: number; z: number }> = new Map();
  public targets: Target[] = [];
  public me: PlayerCore;
  public wsManager: WSManager;
  public neighborMeshes: Map<string, THREE.Group> = new Map();
  public neighborTargetInfos: Map<string, TargetInfo[]> = new Map();
  public neighborTargetsRendered: Map<string, Target[]> = new Map();
  private clock = new THREE.Clock();
  private neighborStates = new Map<string, NeighborState>();

  private static edgeMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x000000,
    depthWrite: true,
    depthTest: true,
  });
  private static edgeRadius = 0.01; // Increased for better visibility at distance

  private static roomPrototype = (() => {
    const group = new THREE.Group();

    // Create 4 cylindrical edges for the floor (square perimeter)
    // Make them slightly longer to overlap at corners for perfect angles
    const floorSize = 1.02; // Slightly longer than 1 to overlap at corners
    const cylinderGeometry = new THREE.CylinderGeometry(
      MainScene.edgeRadius,
      MainScene.edgeRadius,
      floorSize,
      16
    );

    // Define the 4 edges of the floor square
    const edges = [
      { pos: [0, -2, -0.5], rot: [0, 0, Math.PI / 2] },      // front edge (along X)
      { pos: [0, -2, 0.5], rot: [0, 0, Math.PI / 2] },       // back edge (along X)
      { pos: [-0.5, -2, 0], rot: [0, 0, Math.PI / 2], rotY: Math.PI / 2 },  // left edge (along Z)
      { pos: [0.5, -2, 0], rot: [0, 0, Math.PI / 2], rotY: Math.PI / 2 },   // right edge (along Z)
    ];

    edges.forEach(({ pos, rot, rotY }) => {
      const edge = new THREE.Mesh(cylinderGeometry, MainScene.edgeMaterial);
      edge.position.set(pos[0], pos[1], pos[2]);
      edge.rotation.set(rot[0], rotY || 0, rot[2]);
      group.add(edge);
    });

    return group;
  })();

  constructor(targets: Target[], me: PlayerCore, wsManager: WSManager) {
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
    this.generateRoom(playerCore.room_coord_x, playerCore.room_coord_z);
  }

  private generateRoom(x: number, z: number) {
    const room = MainScene.roomPrototype.clone();
    room.position.set(x, -0.5, z);
    room.scale.set(20, 1, 20);
    this.add(room);
  }

  public loadScenario(targetCount: number, halfSize: boolean = false) {
    const amount = Math.max(1, Math.floor(targetCount));
    this.generateCubes(amount, this.me.room_coord_x, this.me.room_coord_z, halfSize);
  }

  public generateCubes(amount: number, roomCoordX: number, roomCoordZ: number, halfSize: boolean = false) {
    const rcg = new RandomCubeGenerator(
      this.targets,
      this,
      false,
      this.wsManager
    );
    rcg.generate(true, halfSize);
    for (let i = 0; i < amount - 1; i++) {
      rcg.generate(false, halfSize);
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

  private updateNeighborTargets(neighborId: string, targetsInfo: TargetInfo[]) {
    const targetInfoChanged = targetsInfoChanged(
      this.neighborTargetInfos.get(neighborId) ?? [],
      targetsInfo
    );
    
    if (!targetInfoChanged) return;

    this.neighborTargetInfos.set(neighborId, targetsInfo);
    this.neighborTargetsRendered.get(neighborId)?.forEach((target) => {
      this.remove(target);
    });
    this.neighborTargetsRendered.set(neighborId, []);
    
    targetsInfo.forEach((targetInfo) => {
      if (targetInfo.disabled) return;
      
      const target = new Target(targetInfo.shootable ? 0xff0000 : 0xffffff);
      target.position.set(targetInfo.x, targetInfo.y, targetInfo.z);

      this.neighborTargetsRendered.get(neighborId)?.push(target);
      this.add(target);
    });
  }

  private checkNeighborRoomChange(neighborId: string, roomX: number, roomZ: number): boolean {
    const stored = this.neighborRooms.get(neighborId);
    const roomChanged = !stored || stored.x !== roomX || stored.z !== roomZ;
    
    if (roomChanged) {
      this.generateRoom(roomX, roomZ);
      this.neighborRooms.set(neighborId, { x: roomX, z: roomZ });
    }
    
    return roomChanged;
  }

  private getOrCreateNeighborMesh(neighborId: string): THREE.Group {
    let mesh = this.neighborMeshes.get(neighborId);
    
    if (!mesh) {
      mesh = new Target(0xffffff);
      this.neighborMeshes.set(neighborId, mesh);
      this.add(mesh);
    }
    
    return mesh;
  }

  private updateNeighborState(
    neighborId: string,
    targetPos: THREE.Vector3,
    targetQuat: THREE.Quaternion
  ): NeighborState {
    let state = this.neighborStates.get(neighborId);
    
    if (!state) {
      state = {
        target: new THREE.Vector3(),
        targetQuat: new THREE.Quaternion(),
        lastPacketTs: performance.now(),
      };
      this.neighborStates.set(neighborId, state);
    }

    state.target.copy(targetPos);
    state.targetQuat.copy(targetQuat);
    state.lastPacketTs = performance.now();
    
    return state;
  }

  private interpolateNeighborMeshes(dt: number) {
    const responsiveness = 12;
    const alpha = 1 - Math.exp(-responsiveness * dt);
    const alphaRot = alpha;

    this.neighborMeshes.forEach((mesh, id) => {
      const state = this.neighborStates.get(id);
      if (!state) return;

      mesh.position.lerp(state.target, alpha);
      mesh.quaternion.slerp(state.targetQuat, alphaRot);
    });
  }

  private cleanupDisconnectedNeighbors(currentIds: Set<string>) {
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

  public update() {
    const dt = this.clock.getDelta();
    const neighbors = this.wsManager.getNeighbors();
    const currentIds = new Set<string>();

    neighbors.forEach((n) => {
      currentIds.add(n.id);

      this.updateNeighborTargets(n.id, n.targetsInfo);
      const roomChanged = this.checkNeighborRoomChange(n.id, n.room_coord_x, n.room_coord_z);
      const mesh = this.getOrCreateNeighborMesh(n.id);

      const targetPos = new THREE.Vector3(
        n.local_player_position_x,
        n.local_player_position_y ?? 0,
        n.local_player_position_z
      );
      const targetQuat = getTargetQuatFromNet(n);

      this.updateNeighborState(n.id, targetPos, targetQuat);

      if (roomChanged) {
        mesh.position.copy(targetPos);
        mesh.quaternion.copy(targetQuat);
      }
    });

    this.interpolateNeighborMeshes(dt);
    this.cleanupDisconnectedNeighbors(currentIds);
  }
}
