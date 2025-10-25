// Main scene setup
import * as THREE from "three";
import Light from "@/objects/Light";
import Target from "@/objects/Target";
import type { PlayerCore } from "@/utils/ws/WSManager";
import WSManager from "@/utils/ws/WSManager";
import type { PhysicsSystem } from "@/systems/PhysicsSystem";
import TargetManager from "@/systems/TargetManager";
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
// Reusable objects for quatFromPitchYaw to avoid allocations
const _helperEuler = new THREE.Euler();
const _helperQuat = new THREE.Quaternion();

function quatFromPitchYaw(pitchRad: number, yawRad: number): THREE.Quaternion {
  // YXZ: primero yaw (Y), después pitch (X)
  _helperEuler.set(0, yawRad, pitchRad, "YXZ");
  _helperQuat.setFromEuler(_helperEuler);
  return _helperQuat.normalize();
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
  public targets: Target[] = []; // Legacy array kept for compatibility
  public targetManager: TargetManager; // New optimized target management
  public me: PlayerCore;
  public wsManager: WSManager;
  private neighborMeshes: Map<string, THREE.Group> = new Map();
  private neighborRoomMeshes: Map<string, THREE.Group> = new Map();
  public neighborTargetInfos: Map<string, TargetInfo[]> = new Map();
  public neighborTargetsRendered: Map<string, Target[]> = new Map();
  private clock = new THREE.Clock();
  private neighborStates = new Map<string, NeighborState>();
  private physicsSystem?: PhysicsSystem;
  private isEditorMode: boolean = false;
  private currentGroundCollider: { min: THREE.Vector3; max: THREE.Vector3 } | null = null;
  private currentRoomMesh: THREE.Group | null = null;
  private frameCount = 0;
  private readonly neighborUpdateInterval = 2; // Update neighbors every N frames for performance
  
  // Reusable objects for neighbor updates to avoid allocations
  private _tempTargetPos = new THREE.Vector3();
  private _tempEuler = new THREE.Euler();
  private _tempQuat = new THREE.Quaternion();

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
    // Use basic material for maximum performance (no lighting calculations)
    const groundMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff
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

  constructor(targets: Target[], me: PlayerCore, wsManager: WSManager, physicsSystem?: PhysicsSystem, isEditorMode: boolean = false) {
    super();
    const white = new THREE.Color(0xffffff);
    this.background = white;
    this.targets = targets; // Legacy array kept for compatibility
    this.me = me;
    this.wsManager = wsManager;
    this.physicsSystem = physicsSystem;
    this.isEditorMode = isEditorMode;
    
    // Initialize target manager for optimized target generation
    this.targetManager = new TargetManager(this);
    
    const light = new Light();
    this.add(light);
  }

  public initPlayerRoom(playerCore: PlayerCore) {
    this.me = playerCore;
    this.generateRoom(playerCore.room_coord_x, playerCore.room_coord_z);
  }

  private generateRoom(x: number, z: number) {
    // Skip room generation in editor mode
    if (this.isEditorMode) {
      console.log("[MainScene] Skipping generateRoom in editor mode");
      return;
    }
    console.log("[MainScene] Generating room at:", x, z);
    
    // Remove old room mesh if it exists
    if (this.currentRoomMesh) {
      console.log("[MainScene] 🗑️ Removing old room mesh");
      this.remove(this.currentRoomMesh);
    }
    
    const room = MainScene.roomPrototype.clone();
    room.position.set(x, -0.5, z);
    room.scale.set(20, 1, 20);
    this.add(room);
    this.currentRoomMesh = room;
    
    // Add physics collider for the ground (matches visual mesh position)
    if (this.physicsSystem) {
      // Remove old ground collider if it exists
      if (this.currentGroundCollider) {
        console.log("[MainScene] 🗑️ Removing old ground collider");
        this.physicsSystem.removeCollider(this.currentGroundCollider);
      }
      
      // Visual mesh is at Y:-0.5 with scale 1, so it goes from Y:-1 to Y:0
      const floorY = 0; // Top of the ground plane (matches visual ground surface)
      const floorThickness = 1; // Matches visual mesh thickness
      const floorSize = 20; // 20x20 room
      
      const groundCollider = {
        min: new THREE.Vector3(x - floorSize / 2, floorY - floorThickness, z - floorSize / 2),
        max: new THREE.Vector3(x + floorSize / 2, floorY, z + floorSize / 2),
      };
      
      this.physicsSystem.addCollider(groundCollider);
      this.currentGroundCollider = groundCollider;
      console.log("[MainScene] ✅ Ground physics added at (X:", x, "Z:", z, ") - top Y:", floorY);
      
      // Add visual debug box for the collider (wireframe) - OPTIONAL
      if (false) { // Set to true to see collider bounds
        const colliderSize = new THREE.Vector3().subVectors(groundCollider.max, groundCollider.min);
        const colliderCenter = new THREE.Vector3().addVectors(groundCollider.min, groundCollider.max).multiplyScalar(0.5);
        const debugBox = new THREE.BoxGeometry(colliderSize.x, colliderSize.y, colliderSize.z);
        const debugMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x00ff00, 
          wireframe: true,
          transparent: true,
          opacity: 0.5
        });
        const debugMesh = new THREE.Mesh(debugBox, debugMaterial);
        debugMesh.position.copy(colliderCenter);
        this.add(debugMesh);
      }
    }
  }

  /**
   * Load scenario with optimized target generation
   * @param targetCount - Number of targets to spawn
   * @param halfSize - Use half-size targets (0.2 scale)
   * @param playerYaw - Player's yaw rotation in radians (targets spawn in front of player)
   */
  public loadScenario(targetCount: number, halfSize: boolean = false, playerYaw?: number) {
    const amount = Math.max(1, Math.floor(targetCount));
    const scale = halfSize ? 0.2 : 0.4;
    
    // Reset previous targets
    this.targetManager.resetAllTargets();
    
    // Generate new targets using optimized manager
    // Use me coordinates if available, otherwise default to (0, 0)
    const roomX = this.me?.room_coord_x ?? 0;
    const roomZ = this.me?.room_coord_z ?? 0;
    
    const newTargets = this.targetManager.generateTargets(
      amount,
      roomX,
      roomZ,
      scale,
      undefined,
      playerYaw
    );
    
    // Update legacy targets array for compatibility with existing code
    this.targets = newTargets;
    
    console.log(`[MainScene] Loaded scenario with ${newTargets.length} targets`);
  }

  /**
   * Legacy method kept for backwards compatibility
   * @deprecated Use loadScenario() instead
   */
  public generateCubes(amount: number, roomCoordX: number, roomCoordZ: number, halfSize: boolean = false) {
    console.warn('[MainScene] generateCubes is deprecated, use loadScenario instead');
    this.loadScenario(amount, halfSize);
  }

  private updateNeighborTargets(neighborId: string, targetsInfo: TargetInfo[]) {
    const prev = this.neighborTargetInfos.get(neighborId) ?? [];
    if (!targetsInfoChanged(prev, targetsInfo)) return;

    console.log(`[MainScene] 🎯 Updating neighbor ${neighborId} targets:`, targetsInfo.length, 'targets');
    this.neighborTargetInfos.set(neighborId, targetsInfo);

    const rendered = this.neighborTargetsRendered.get(neighborId) ?? [];
    while (rendered.length < targetsInfo.length) {
      const t = new Target(0xcccccc); // Light gray for neighbor targets (visible on white background)
      console.log(`[MainScene] 🎯 Created new neighbor target, total:`, rendered.length + 1);
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

      const desiredColor = info.shootable ? 0xff0000 : 0xcccccc; // Light gray for non-shootable neighbor targets
      t.setColor(desiredColor);
      
      console.log(`[MainScene] 🎯 Target ${i} for neighbor ${neighborId}:`, {
        pos: `(${info.x.toFixed(1)}, ${info.y.toFixed(1)}, ${info.z.toFixed(1)})`,
        visible: t.visible,
        shootable: info.shootable,
        disabled: info.disabled,
        color: desiredColor.toString(16)
      });
    }

    this.neighborTargetsRendered.set(neighborId, rendered);
  }

  private checkNeighborRoomChange(neighborId: string, roomX: number, roomZ: number): boolean {
    // Skip room generation in editor mode
    if (this.isEditorMode) {
      return false;
    }
    
    const stored = this.neighborRooms.get(neighborId);
    const roomChanged = !stored || stored.x !== roomX || stored.z !== roomZ;
    
    if (roomChanged) {
      this.neighborRooms.set(neighborId, { x: roomX, z: roomZ });
      // Create/update a dedicated room mesh for this neighbor without touching the local ground
      const existing = this.neighborRoomMeshes.get(neighborId);
      if (existing) {
        this.remove(existing);
        this.neighborRoomMeshes.delete(neighborId);
      }
      const neighborRoom = MainScene.roomPrototype.clone();
      neighborRoom.position.set(roomX, -0.5, roomZ);
      neighborRoom.scale.set(20, 1, 20);
      this.add(neighborRoom);
      this.neighborRoomMeshes.set(neighborId, neighborRoom);
    }
    
    return roomChanged;
  }

  private getOrCreateNeighborMesh(neighborId: string): THREE.Group {
    let mesh = this.neighborMeshes.get(neighborId);
    
    if (!mesh) {
      mesh = new Target(0xcccccc); // Light gray for neighbor avatar (visible on white background)
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
        const roomMesh = this.neighborRoomMeshes.get(id);
        if (roomMesh) {
          this.remove(roomMesh);
          this.neighborRoomMeshes.delete(id);
        }
      }
    });
  }

  public update() {
    this.frameCount++;
    
    const neighbors = this.wsManager.getNeighbors();
    
    // Early exit if no neighbors (common in offline mode)
    if (neighbors.length === 0) {
      // Still cleanup if we had neighbors before (but only occasionally)
      if (this.neighborMeshes.size > 0 && this.frameCount % 60 === 0) {
        this.cleanupDisconnectedNeighbors(new Set());
      }
      return;
    }
    
    const dt = this.clock.getDelta();
    
    // Always interpolate for smooth movement
    this.interpolateNeighborMeshes(dt);
    
    // Update neighbor data less frequently to reduce overhead
    if (this.frameCount % this.neighborUpdateInterval !== 0) {
      return;
    }
    
    const currentIds = new Set<string>();

    for (const n of neighbors) {
      currentIds.add(n.id);

      console.log(`[MainScene] 👥 Processing neighbor ${n.id}:`, {
        room: `(${n.room_coord_x}, ${n.room_coord_z})`,
        pos: `(${n.local_player_position_x?.toFixed(1)}, ${n.local_player_position_y?.toFixed(1)}, ${n.local_player_position_z?.toFixed(1)})`,
        targetsCount: n.targetsInfo?.length ?? 0
      });
      this.updateNeighborTargets(n.id, n.targetsInfo);
      const roomChanged = this.checkNeighborRoomChange(n.id, n.room_coord_x, n.room_coord_z);
      const mesh = this.getOrCreateNeighborMesh(n.id);

      // Reuse vector instead of creating new one
      this._tempTargetPos.set(
        n.local_player_position_x,
        n.local_player_position_y ?? 0,
        n.local_player_position_z
      );
      const targetQuat = getTargetQuatFromNet(n);

      this.updateNeighborState(n.id, this._tempTargetPos, targetQuat);

      if (roomChanged) {
        mesh.position.copy(this._tempTargetPos);
        mesh.quaternion.copy(targetQuat);
      }
    }

    this.cleanupDisconnectedNeighbors(currentIds);
  }
}
