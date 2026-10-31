import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import RemotePlayerAvatar, { shortestAngle } from '@/features/game/multiplayer/RemotePlayerAvatar';
import RemoteShotEffects from '@/features/game/multiplayer/RemoteShotEffects';
import RemotePlayers from '@/features/game/multiplayer/RemotePlayers';
import {
  computeRemoteShotAudio,
  REMOTE_SHOT_BASE_VOLUME,
  REMOTE_SHOT_SOUND,
  RemoteShotAudio,
} from '@/features/game/multiplayer/remoteShotAudio';
import { directionFromYawPitch, type PlayerShotMessage } from '@/features/game/multiplayer/shotProtocol';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('RemotePlayerAvatar', () => {
  it('faces the network yaw and pitches the head (forward is local +X)', () => {
    const avatar = new RemotePlayerAvatar();
    avatar.setTarget(v(10, 0, 5), Math.PI / 2, 0.3);
    avatar.updateMatrixWorld(true);
    const forward = v(1, 0, 0).transformDirection(avatar.matrixWorld);
    expect(forward.distanceTo(directionFromYawPitch(Math.PI / 2, 0, v(0, 0, 0)))).toBeLessThan(1e-6);
    expect(avatar.head.rotation.z).toBeCloseTo(0.3);
    expect(avatar.position.toArray()).toEqual([10, 0, 5]);
  });

  it('fire() aims the gun barrel exactly at the shot end point and recoils', () => {
    const avatar = new RemotePlayerAvatar();
    avatar.setTarget(v(0, 0, 0), 0, 0);
    const end = v(8, 2.5, 3);
    const dir = end.clone().sub(v(0, 0.8, 0)).normalize();
    avatar.fire(Math.atan2(-dir.z, dir.x), Math.asin(dir.y), end);
    expect(avatar.isRecoiling).toBe(true);

    // The aim pivot's +X (barrel axis before the recoil kick) points from the pivot at the end point
    const pivotWorld = avatar.gunPivot.getWorldPosition(v(0, 0, 0));
    const barrel = v(1, 0, 0).transformDirection(avatar.gunPivot.matrixWorld);
    const toEnd = end.clone().sub(pivotWorld).normalize();
    expect(barrel.angleTo(toEnd)).toBeLessThan(1e-6);

    // Recoil decays back to rest
    avatar.update(0.5);
    expect(avatar.isRecoiling).toBe(false);
  });

  it('interpolates yaw along the shortest arc', () => {
    expect(shortestAngle(3.0, -3.0)).toBeCloseTo(2 * Math.PI - 6, 9);
    const avatar = new RemotePlayerAvatar();
    avatar.setTarget(v(0, 0, 0), 3.0, 0);
    avatar.setTarget(v(0, 0, 0), -3.0 + 2 * Math.PI * 5, 0); // unbounded network yaw
    avatar.update(0.05);
    const yaw = avatar.rotation.y;
    expect(yaw).toBeGreaterThan(3.0); // went "up" through PI, not back down through 0
  });
});

describe('RemoteShotEffects', () => {
  it('reuses a bounded pool under rapid fire and retires effects after their life', () => {
    const scene = new THREE.Scene();
    const fx = new RemoteShotEffects(scene, 4);
    for (let i = 0; i < 50; i++) {
      fx.spawnTracer(v(0, 1, 0), v(10, 1, i));
      fx.spawnFlash(v(0, 1, 0));
      fx.spawnImpact(v(10, 1, i));
      fx.update(0.01);
    }
    expect(fx.pooledCount('tracer')).toBe(4);
    expect(fx.pooledCount('flash')).toBe(4);
    expect(fx.pooledCount('impact')).toBe(4);
    expect(scene.children.length).toBe(12);
    fx.update(1);
    expect(fx.activeCount()).toBe(0);
    fx.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('tracer spans from start to end', () => {
    const scene = new THREE.Scene();
    const fx = new RemoteShotEffects(scene);
    fx.spawnTracer(v(1, 1, 1), v(1, 1, -9));
    const tracer = scene.children[0] as THREE.Mesh;
    tracer.updateMatrixWorld(true);
    const far = v(0, 0, 1).applyMatrix4(tracer.matrixWorld);
    expect(far.distanceTo(v(1, 1, -9))).toBeLessThan(1e-6);
  });
});

describe('remote shot audio', () => {
  it('gets quieter with distance and pans towards the source', () => {
    const listener = v(0, 1, 0);
    const right = v(0, 0, 1);
    const near = computeRemoteShotAudio(listener, right, v(0, 1, 2));
    const far = computeRemoteShotAudio(listener, right, v(0, 1, 40));
    expect(near.volume).toBeLessThanOrEqual(REMOTE_SHOT_BASE_VOLUME);
    expect(far.volume).toBeLessThan(near.volume);
    expect(near.pan).toBeGreaterThan(0.5);
    expect(computeRemoteShotAudio(listener, right, v(0, 1, -5)).pan).toBeLessThan(-0.5);
    expect(computeRemoteShotAudio(listener, right, v(5, 1, 0)).pan).toBeCloseTo(0);
  });

  it('plays on the sfx channel under its own name once loaded (volume settings apply via AudioManager)', async () => {
    const audio = { play: vi.fn(() => 'id'), loadSound: vi.fn(() => Promise.resolve()) };
    const remote = new RemoteShotAudio(audio);
    expect(remote.play(v(0, 0, 0), v(0, 0, 1), v(1, 0, 0))).toBeNull(); // starts loading
    await Promise.resolve();
    await Promise.resolve();
    const opts = remote.play(v(0, 0, 0), v(0, 0, 1), v(0, 0, 3));
    expect(audio.loadSound).toHaveBeenCalledWith(REMOTE_SHOT_SOUND, expect.any(String), 'sfx');
    expect(audio.play).toHaveBeenCalledWith(REMOTE_SHOT_SOUND, expect.objectContaining({ channel: 'sfx' }));
    expect(opts!.volume).toBeLessThan(0.35);
    expect(opts!.pan).toBeGreaterThan(0);
  });
});

describe('RemotePlayers', () => {
  const shot = (patch: Partial<PlayerShotMessage> = {}): PlayerShotMessage => ({
    type: 'playerShot',
    id: 'p1',
    room_coord_x: 24,
    room_coord_z: 0,
    origin: [0, 0.8, 0],
    direction: [1, 0, 0],
    hit: [6, 0.8, 0],
    ...patch,
  });

  it('handles a shot: avatar aims/recoils, tracer from muzzle to hit, flash and impact', () => {
    const scene = new THREE.Scene();
    const remote = new RemotePlayers(scene);
    remote.upsert('p1', v(24, 0, 0), 0, 0);
    const r = remote.handleShot(shot());
    expect(r.hit).toBe(true);
    expect(r.origin.toArray()).toEqual([24, 0.8, 0]);
    expect(r.end.toArray()).toEqual([30, 0.8, 0]);
    // Muzzle sits in front of the avatar, between the shooter and the hit point
    expect(r.muzzle.x).toBeGreaterThan(24.3);
    expect(r.muzzle.x).toBeLessThan(30);
    expect(remote.get('p1')!.isRecoiling).toBe(true);
    expect(remote.effects.activeCount('tracer')).toBe(1);
    expect(remote.effects.activeCount('flash')).toBe(1);
    expect(remote.effects.activeCount('impact')).toBe(1);
  });

  it('keeps effects out of override-material passes (outline normals) but in the colour pass', () => {
    const scene = new THREE.Scene();
    const remote = new RemotePlayers(scene);
    scene.overrideMaterial = new THREE.MeshNormalMaterial();
    remote.syncEffectsVisibility(scene);
    expect(remote.effectsGroup.visible).toBe(false);
    scene.overrideMaterial = null;
    remote.syncEffectsVisibility(scene);
    expect(remote.effectsGroup.visible).toBe(true);
  });

  it('a miss gets no impact; a shot from an unknown player creates its avatar', () => {
    const scene = new THREE.Scene();
    const remote = new RemotePlayers(scene);
    const r = remote.handleShot(shot({ id: 'new', hit: undefined }));
    expect(r.hit).toBe(false);
    expect(remote.get('new')).toBeDefined();
    expect(remote.get('new')!.position.toArray()).toEqual([24, 0, 0]);
    expect(remote.effects.activeCount('impact')).toBe(0);
  });

  it('plays positional sound relative to the listener and cleans up on remove', async () => {
    const scene = new THREE.Scene();
    const audio = { play: vi.fn(() => 'id'), loadSound: vi.fn(() => Promise.resolve()) };
    const remote = new RemotePlayers(scene, audio);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(24, 0.8, -10);
    remote.setListener(camera);
    remote.upsert('p1', v(24, 0, 0), 0, 0); // preloads
    await Promise.resolve();
    await Promise.resolve();
    remote.handleShot(shot());
    expect(audio.play).toHaveBeenCalledTimes(1);

    const before = scene.children.length;
    remote.remove('p1');
    expect(remote.ids()).toEqual([]);
    expect(scene.children.length).toBe(before - 1);
  });
});
