import * as THREE from "three";
import RemotePlayerAvatar from "./RemotePlayerAvatar";
import RemoteShotEffects from "./RemoteShotEffects";
import { RemoteShotAudio } from "./remoteShotAudio";
import { EYE_HEIGHT, resolveShotWorld, yawPitchFromDirection, type PlayerShotMessage } from "./shotProtocol";
import type { AudioManager } from "@/utils/AudioManager";

export type ResolvedShot = {
  id: string;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  /** Hit point, or origin + direction × max range when nothing was hit. */
  end: THREE.Vector3;
  /** Where the tracer starts (the avatar's muzzle). */
  muzzle: THREE.Vector3;
  hit: boolean;
};

/** Corrections smaller than this keep the interpolated avatar position on a shot. */
const SHOT_POSITION_SNAP_DISTANCE = 0.75;

/**
 * Renders neighbours: one {@link RemotePlayerAvatar} per player plus pooled shot effects
 * and positional shot audio. Owned by MainScene; fed from WSManager.
 *
 * @example
 * ```typescript
 * const remote = new RemotePlayers(scene, AudioManager.getInstance());
 * remote.setListener(camera);
 * remote.upsert(id, position, yaw, pitch);
 * wsManager.onPlayerShot((msg) => remote.handleShot(msg));
 * remote.update(dt); // every frame
 * ```
 */
export default class RemotePlayers {
  private readonly parent: THREE.Object3D;
  private readonly avatars = new Map<string, RemotePlayerAvatar>();
  public readonly effects: RemoteShotEffects;
  /**
   * Holds all shot effects. Hidden while the renderer's outline pass draws the scene with an
   * override material, otherwise thin tracers come out as solid black edge lines.
   */
  public readonly effectsGroup = new THREE.Group();
  private readonly audio: RemoteShotAudio;
  private listener: THREE.Object3D | null = null;

  private readonly _origin = new THREE.Vector3();
  private readonly _direction = new THREE.Vector3();
  private readonly _end = new THREE.Vector3();
  private readonly _muzzle = new THREE.Vector3();
  private readonly _feet = new THREE.Vector3();
  private readonly _listenerPos = new THREE.Vector3();
  private readonly _listenerRight = new THREE.Vector3();
  private readonly resolved: ResolvedShot;

  constructor(parent: THREE.Object3D, audio: Pick<AudioManager, "play" | "loadSound"> | null = null) {
    this.parent = parent;
    this.effectsGroup.name = "remote-shot-effects";
    parent.add(this.effectsGroup);
    this.effects = new RemoteShotEffects(this.effectsGroup);
    this.audio = new RemoteShotAudio(audio);
    this.resolved = {
      id: "",
      origin: this._origin,
      direction: this._direction,
      end: this._end,
      muzzle: this._muzzle,
      hit: false,
    };
  }

  /** Object whose world transform is the audio listener (the local camera). */
  public setListener(listener: THREE.Object3D | null) {
    this.listener = listener;
  }

  public get(id: string): RemotePlayerAvatar | undefined {
    return this.avatars.get(id);
  }

  public ids(): string[] {
    return Array.from(this.avatars.keys());
  }

  /**
   * Creates or updates a neighbour's avatar pose.
   *
   * @param snap - Jump to the pose instead of interpolating (e.g. room change)
   */
  public upsert(id: string, position: THREE.Vector3, yaw: number, pitch: number, snap = false) {
    let avatar = this.avatars.get(id);
    if (!avatar) {
      avatar = new RemotePlayerAvatar();
      avatar.name = `remote-player:${id}`;
      this.avatars.set(id, avatar);
      this.parent.add(avatar);
      this.audio.preload();
    }
    avatar.setTarget(position, yaw, pitch);
    if (snap) avatar.snap();
  }

  /** Removes a neighbour's avatar (shared geometry/materials stay cached). */
  public remove(id: string) {
    const avatar = this.avatars.get(id);
    if (!avatar) return;
    this.parent.remove(avatar);
    this.avatars.delete(id);
  }

  /**
   * Plays a neighbour's shot immediately: aims and kicks the avatar, spawns muzzle flash,
   * tracer (muzzle → hit point or max range) and impact, and plays a positional sound.
   *
   * @returns World-space shot data (vectors are reused; copy them to keep them)
   */
  public handleShot(msg: PlayerShotMessage): ResolvedShot {
    const { hit } = resolveShotWorld(msg, { origin: this._origin, direction: this._direction, end: this._end });
    const { yaw, pitch } = yawPitchFromDirection(this._direction);

    let avatar = this.avatars.get(msg.id);
    this._feet.set(this._origin.x, this._origin.y - EYE_HEIGHT, this._origin.z);
    if (!avatar) {
      // Shot from a player whose first update has not been applied yet
      this.upsert(msg.id, this._feet, yaw, pitch, true);
      avatar = this.avatars.get(msg.id)!;
    } else if (avatar.position.distanceTo(this._feet) > SHOT_POSITION_SNAP_DISTANCE) {
      avatar.setTarget(this._feet, yaw, pitch);
      avatar.snap();
    }

    avatar.fire(yaw, pitch, this._end);
    avatar.getMuzzleWorldPosition(this._muzzle);

    this.effects.spawnFlash(this._muzzle);
    this.effects.spawnTracer(this._muzzle, this._end);
    if (hit) this.effects.spawnImpact(this._end);

    if (this.listener) {
      this.listener.updateMatrixWorld();
      this.listener.getWorldPosition(this._listenerPos);
      this._listenerRight.setFromMatrixColumn(this.listener.matrixWorld, 0).normalize();
      this.audio.play(this._listenerPos, this._listenerRight, this._muzzle);
    }

    this.resolved.id = msg.id;
    this.resolved.hit = hit;
    return this.resolved;
  }

  /**
   * Call from the scene's onBeforeRender: shows effects in the colour pass and hides them in
   * passes that render the scene with an override material (normals/depth for outlines).
   */
  public syncEffectsVisibility(scene: THREE.Scene) {
    this.effectsGroup.visible = scene.overrideMaterial === null;
  }

  /** Advances avatars and effects. Call every frame, even with no neighbours. */
  public update(dt: number) {
    this.avatars.forEach((avatar) => avatar.update(dt));
    this.effects.update(dt);
  }

  public dispose() {
    this.ids().forEach((id) => this.remove(id));
    this.effects.dispose();
    this.parent.remove(this.effectsGroup);
  }
}
