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
    color: 0xd0d0d0,
    depthWrite: true,
    depthTest: true,
  });
  private static edgeRadius = 0.02; // Slightly thicker lines

  private static roomPrototype = (() => {
    const group = new THREE.Group();

    // Add a solid prism for the ground: top face stays at y=0, volume extrudes downward
    const prismDepth = 50; // world units; extrude downward to make side faces 20x50
    const groundGeometry = new THREE.BoxGeometry(1, prismDepth, 1);
    // Use standard material with high emissive to stay white but allow subtle shadows
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.3  // Subtle emissive glow to stay white
    });
    const groundPrism = new THREE.Mesh(groundGeometry, groundMaterial);
    // Align top face with previous square ground level (world y ≈ -2)
    // room.position.y = -0.5, so local top must be -1.5
    // For a box centered at its position, topLocal = position.y + prismDepth/2
    // Solve position.y = topLocal - prismDepth/2 = -1.5 - prismDepth/2
    groundPrism.position.y = -1.5 - prismDepth / 2;
    groundPrism.castShadow = true;  // Enable shadow casting
    groundPrism.receiveShadow = true;
    group.add(groundPrism);

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
    const prev = this.neighborTargetInfos.get(neighborId) ?? [];
    if (!targetsInfoChanged(prev, targetsInfo)) return;

    this.neighborTargetInfos.set(neighborId, targetsInfo);

    const rendered = this.neighborTargetsRendered.get(neighborId) ?? [];
    while (rendered.length < targetsInfo.length) {
      const t = new Target(0xffffff); 
      rendered.push(t);
      this.add(t);
    }
    while (rendered.length > targetsInfo.length) {
      const t = rendered.pop()!;
      t.visible = false;
    }

    for (let i = 0; i < targetsInfo.length; i++) {
      const info = targetsInfo[i];
      const t = rendered[i];
      if (!info || info.disabled) {
        t.visible = false;
        continue;
      }
      t.visible = true;
      t.position.set(info.x, info.y, info.z);

      const desiredColor = info.shootable ? 0xff0000 : 0xffffff;
      t.setColor(desiredColor);
    }

    this.neighborTargetsRendered.set(neighborId, rendered);
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
