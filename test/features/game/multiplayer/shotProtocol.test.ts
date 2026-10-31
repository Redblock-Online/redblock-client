import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildShotPayload,
  directionFromYawPitch,
  isPlayerShotMessage,
  resolveShotWorld,
  roomLocalToWorld,
  SHOT_MAX_TRACER_RANGE,
  worldToRoomLocal,
  yawPitchFromDirection,
  type PlayerShotMessage,
} from '@/features/game/multiplayer/shotProtocol';

/** Rebuilds the local player's camera rig exactly like ControlsWithMovement + App do. */
function cameraRigDirection(yaw: number, pitch: number): THREE.Vector3 {
  const yawObject = new THREE.Object3D();
  const pitchObject = new THREE.Object3D();
  const camera = new THREE.PerspectiveCamera();
  pitchObject.add(camera);
  yawObject.add(pitchObject);
  camera.rotation.set(0, (Math.PI / 2) * 3, 0); // App constructor
  yawObject.rotation.y = yaw; // mouse X
  pitchObject.rotation.z = pitch; // mouse Y
  yawObject.updateMatrixWorld(true);
  return camera.getWorldDirection(new THREE.Vector3());
}

describe('shotProtocol frames', () => {
  it('directionFromYawPitch matches the real camera rig for many yaw/pitch pairs', () => {
    for (const yaw of [0, 0.7, -2.1, Math.PI, 7.5]) {
      for (const pitch of [0, 0.4, -1.2, 1.5]) {
        const expected = cameraRigDirection(yaw, pitch);
        const actual = directionFromYawPitch(yaw, pitch, new THREE.Vector3());
        expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
      }
    }
  });

  it('yawPitchFromDirection inverts directionFromYawPitch (yaw modulo 2π)', () => {
    for (const [yaw, pitch] of [[0.3, 0.2], [-2.5, -0.9], [3.0, 1.2]]) {
      const d = directionFromYawPitch(yaw, pitch, new THREE.Vector3());
      const r = yawPitchFromDirection(d);
      expect(r.pitch).toBeCloseTo(pitch, 9);
      expect(Math.cos(r.yaw)).toBeCloseTo(Math.cos(yaw), 9);
      expect(Math.sin(r.yaw)).toBeCloseTo(Math.sin(yaw), 9);
    }
  });

  it('room-local conversion round-trips', () => {
    const room = { room_coord_x: 48, room_coord_z: -24 };
    const world = new THREE.Vector3(50.25, 0.8, -30.5);
    const local = worldToRoomLocal(world, room);
    expect(local).toEqual([2.25, 0.8, -6.5]);
    expect(roomLocalToWorld(local, room, new THREE.Vector3()).distanceTo(world)).toBeLessThan(1e-9);
  });

  it('a shot fired in one room resolves to the same world points on a receiver', () => {
    // Shooter A owns room (48, -24); the server relays A's room coords with the shot
    const room = { room_coord_x: 48, room_coord_z: -24 };
    const origin = new THREE.Vector3(49.1, 0.8, -22.3);
    const direction = directionFromYawPitch(0.6, 0.1, new THREE.Vector3());
    const hit = origin.clone().addScaledVector(direction, 7.25);

    const payload = buildShotPayload(origin, direction, room, hit, 2, 123)!;
    expect(payload.origin.every((c) => Math.abs(c) < 64)).toBe(true); // small, room-local
    expect(payload.hitTargetIndex).toBe(2);
    expect(payload.t).toBe(123);

    const relayed: PlayerShotMessage = { type: 'playerShot', id: 'a', ...room, ...payload };
    expect(isPlayerShotMessage(relayed)).toBe(true);

    const out = { origin: new THREE.Vector3(), direction: new THREE.Vector3(), end: new THREE.Vector3() };
    const res = resolveShotWorld(relayed, out);
    expect(res.hit).toBe(true);
    expect(out.origin.distanceTo(origin)).toBeLessThan(1e-3);
    expect(out.end.distanceTo(hit)).toBeLessThan(1e-3);
    expect(out.direction.distanceTo(direction)).toBeLessThan(1e-3);
  });

  it('a miss ends at the max tracer range along the direction', () => {
    const room = { room_coord_x: 0, room_coord_z: 0 };
    const payload = buildShotPayload(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -2), room)!;
    expect(payload.direction).toEqual([0, 0, -1]); // normalised
    expect(payload.hit).toBeUndefined();
    const out = { origin: new THREE.Vector3(), direction: new THREE.Vector3(), end: new THREE.Vector3() };
    const res = resolveShotWorld({ type: 'playerShot', id: 'x', ...room, ...payload }, out);
    expect(res.hit).toBe(false);
    expect(out.end.toArray()).toEqual([0, 1, -SHOT_MAX_TRACER_RANGE]);
  });

  it('buildShotPayload rejects degenerate input and drops hitTargetIndex without a hit', () => {
    const room = { room_coord_x: 0, room_coord_z: 0 };
    expect(buildShotPayload(new THREE.Vector3(), new THREE.Vector3(0, 0, 0), room)).toBeNull();
    expect(buildShotPayload(new THREE.Vector3(NaN, 0, 0), new THREE.Vector3(1, 0, 0), room)).toBeNull();
    const p = buildShotPayload(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), room, null, 3)!;
    expect(p.hitTargetIndex).toBeUndefined();
  });
});
