// Main scene setup
import * as THREE from "three";
import Light from "@/objects/Light";
import Target from "@/objects/Target";
import type { PlayerCore } from "@/utils/ws/WSManager";
import WSManager from "@/utils/ws/WSManager";
import type { PhysicsSystem } from "@/features/game/physics";
import { TargetManager } from "@/features/game/targets";
import RemotePlayers from "@/features/game/multiplayer/RemotePlayers";
import type { PlayerShotMessage } from "@/features/game/multiplayer/shotProtocol";
import { AudioManager } from "@/utils/AudioManager";
export type TargetInfo = {
  x: number;
  y: number;
  z: number;
  shootable: boolean;
  disabled: boolean;
};

/** Max distance between a remote shot's hit point and the neighbour target it claims to break. */
const REMOTE_HIT_TARGET_TOLERANCE = 1.5;

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
  /** Neighbour avatars, remote shot effects and audio. */
  public remotePlayers: RemotePlayers;
  private unsubscribePlayerShot: (() => void) | null = null;
  private neighborRoomMeshes: Map<string, THREE.Group> = new Map();
  public neighborTargetInfos: Map<string, TargetInfo[]> = new Map();
  public neighborTargetsRendered: Map<string, Target[]> = new Map();
  private clock = new THREE.Clock();
  private physicsSystem?: PhysicsSystem;
  private isEditorMode: boolean = false;
  private currentGroundCollider: { min: THREE.Vector3; max: THREE.Vector3 } | null = null;
  private currentRoomMesh: THREE.Group | null = null;
  private frameCount = 0;
  private readonly neighborUpdateInterval = 2; // Update neighbors every N frames for performance
  
  // Reusable objects for neighbor updates to avoid allocations
  private _tempTargetPos = new THREE.Vector3();

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

    this.remotePlayers = new RemotePlayers(this, typeof window !== "undefined" ? AudioManager.getInstance() : null);
    // Shots are applied on receipt (not on the 20 Hz neighbour poll) so they feel immediate
    this.unsubscribePlayerShot = wsManager.onPlayerShot((shot) => this.onPlayerShot(shot));
    // The outline pass re-renders this scene with a normals override material; keep shot effects
    // out of that pass so tracers stay coloured instead of turning into black edge lines.
    this.onBeforeRender = () => this.remotePlayers.syncEffectsVisibility(this);
  }

  /** Sets the object used as audio listener for positional remote sounds (the camera). */
  public setAudioListener(listener: THREE.Object3D | null) {
    this.remotePlayers.setListener(listener);
  }

  private onPlayerShot(shot: PlayerShotMessage) {
    if (this.isEditorMode) return;
    const resolved = this.remotePlayers.handleShot(shot);
    if (resolved.hit && typeof shot.hitTargetIndex === "number") {
      this.breakNeighborTarget(shot.id, shot.hitTargetIndex, resolved.end);
    }
  }

  /**
   * Plays the break animation on a neighbour's target right away instead of waiting for
   * their next `targetsInfo` (which only travels with movement updates).
   */
  private breakNeighborTarget(neighborId: string, index: number, hitPoint: THREE.Vector3) {
    const target = this.neighborTargetsRendered.get(neighborId)?.[index];
    if (!target || !target.visible || target.animating) return;
    // Guard against stale indices (e.g. the neighbour changed scenario meanwhile)
    if (target.position.distanceTo(hitPoint) > REMOTE_HIT_TARGET_TOLERANCE) return;
    target.absorbAndDisappear(() => {
      // Re-apply the latest known state once the animation ends
      const latest = this.neighborTargetInfos.get(neighborId);
      if (latest) this.updateNeighborTargets(neighborId, latest, true);
    });
  }

  /** Restores a neighbour target after a locally played break animation. */
  private resetNeighborTarget(t: Target) {
    t.activeTweens.forEach((tween) => tween.kill());
    t.activeTweens = [];
    t.scale.setScalar(t.baseScale);
    t.rotation.set(0, 0, 0);
    t.setOpacity(1);
    t.edgesGroup.children.forEach((edge) => {
      ((edge as THREE.Mesh).material as THREE.Material).opacity = 1;
    });
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

  private updateNeighborTargets(neighborId: string, targetsInfo: TargetInfo[], force = false) {
    if (!Array.isArray(targetsInfo)) return;
    const prev = this.neighborTargetInfos.get(neighborId) ?? [];
    if (!force && !targetsInfoChanged(prev, targetsInfo)) return;

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
      // A break triggered by a remote shot is playing: let it finish (re-applied on completion)
      if (t.animating) continue;
      if (!info || info.disabled) {
        t.visible = false;
        continue;
      }
      if (t.scale.x !== t.baseScale) this.resetNeighborTarget(t);
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

  private cleanupDisconnectedNeighbors(currentIds: Set<string>) {
    const known = new Set([...this.remotePlayers.ids(), ...this.neighborTargetsRendered.keys()]);
    known.forEach((id) => {
      if (currentIds.has(id)) return;
      this.remotePlayers.remove(id);
      this.neighborRooms.delete(id);
      const roomMesh = this.neighborRoomMeshes.get(id);
      if (roomMesh) {
        this.remove(roomMesh);
        this.neighborRoomMeshes.delete(id);
      }
      const targets = this.neighborTargetsRendered.get(id);
      if (targets) {
        targets.forEach((t) => {
          this.remove(t);
          t.dispose();
        });
        this.neighborTargetsRendered.delete(id);
      }
      this.neighborTargetInfos.delete(id);
    });
  }

  public update() {
    this.frameCount++;
    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Avatars interpolate and shot effects animate every frame (effects may outlive a neighbour)
    this.remotePlayers.update(dt);

    const neighbors = this.wsManager.getNeighbors();

    // Early exit if no neighbors (common in offline mode)
    if (neighbors.length === 0) {
      // Still cleanup if we had neighbors before (but only occasionally)
      const hasRemoteState = this.remotePlayers.ids().length + this.neighborTargetsRendered.size > 0;
      if (hasRemoteState && this.frameCount % 60 === 0) {
        this.cleanupDisconnectedNeighbors(new Set());
      }
      return;
    }

    // Update neighbor data less frequently to reduce overhead
    if (this.frameCount % this.neighborUpdateInterval !== 0) {
      return;
    }

    const currentIds = new Set<string>();

    for (const n of neighbors) {
      currentIds.add(n.id);

      this.updateNeighborTargets(n.id, n.targetsInfo);
      const roomChanged = this.checkNeighborRoomChange(n.id, n.room_coord_x, n.room_coord_z);

      // Positions are world-space already (see multiplayer/shotProtocol.ts for the frame notes)
      this._tempTargetPos.set(
        n.local_player_position_x ?? n.room_coord_x,
        n.local_player_position_y ?? 0,
        n.local_player_position_z ?? n.room_coord_z
      );
      // Network rotation: player_rotation_x is yaw (about Y), player_rotation_y is pitch (about Z)
      this.remotePlayers.upsert(
        n.id,
        this._tempTargetPos,
        n.player_rotation_x ?? 0,
        n.player_rotation_y ?? 0,
        roomChanged
      );
    }

    this.cleanupDisconnectedNeighbors(currentIds);
  }

  /** Releases network subscriptions and remote player resources. */
  public disposeMultiplayer() {
    this.unsubscribePlayerShot?.();
    this.unsubscribePlayerShot = null;
    this.remotePlayers.dispose();
  }
}
