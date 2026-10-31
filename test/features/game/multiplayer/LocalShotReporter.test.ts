import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import LocalShotReporter from '@/features/game/multiplayer/LocalShotReporter';
import Target from '@/objects/Target';
import type { ShotPayload } from '@/features/game/multiplayer/shotProtocol';

const me = {
  id: 'me',
  chunk_number: 0,
  room_coord_x: 24,
  room_coord_z: -24,
  player_rotation_x: 0,
  player_rotation_y: 0,
  local_player_position_x: 24,
  local_player_position_y: 0,
  local_player_position_z: -24,
  targetsInfo: [],
};

function transport(online = true) {
  const sent: ShotPayload[] = [];
  return {
    sent,
    isOnline: () => online,
    getMe: () => me,
    sendShot: vi.fn((shot: ShotPayload) => {
      sent.push(shot);
      return true;
    }),
  };
}

const base = () => ({
  origin: new THREE.Vector3(24, 0.8, -24),
  direction: new THREE.Vector3(1, 0, 0),
  hit: null,
  brokeTarget: false,
  targets: [] as Target[],
  targetCount: 3,
});

describe('LocalShotReporter', () => {
  it('sends nothing offline / in the editor', () => {
    const t = transport(false);
    expect(new LocalShotReporter(t).report(base())).toBeNull();
    expect(t.sendShot).not.toHaveBeenCalled();
  });

  it('sends a room-local shot with the targetsInfo index of a broken target', () => {
    const t = transport();
    const onBroken = vi.fn();
    const targets = [new Target(), new Target(), new Target(), new Target()];
    targets[2].position.set(30, 0.8, -24);
    const hit = {
      point: new THREE.Vector3(29.8, 0.8, -24),
      object: targets[2].cubeMesh,
      distance: 5.8,
    } as unknown as THREE.Intersection;

    const payload = new LocalShotReporter(t, onBroken).report(
      { ...base(), hit, brokeTarget: true, targets },
      1000
    );
    expect(payload).toEqual({
      origin: [0, 0.8, 0],
      direction: [1, 0, 0],
      hit: [5.8, 0.8, 0],
      hitTargetIndex: 1, // targetsInfo covers targets.slice(-3)
      t: 1000,
    });
    expect(onBroken).toHaveBeenCalledTimes(1);
  });

  it('omits hitTargetIndex when the shot did not break a target', () => {
    const t = transport();
    const target = new Target();
    const hit = { point: new THREE.Vector3(30, 0.8, -24), object: target.cubeMesh } as unknown as THREE.Intersection;
    const payload = new LocalShotReporter(t).report({ ...base(), hit, targets: [target] });
    expect(payload?.hit).toEqual([6, 0.8, 0]);
    expect(payload?.hitTargetIndex).toBeUndefined();
  });

  it('never sends more than 15 shots per second', () => {
    const t = transport();
    const reporter = new LocalShotReporter(t);
    for (let i = 0; i < 30; i++) reporter.report(base(), 1000 + i * 10);
    expect(t.sent).toHaveLength(15);
    reporter.report(base(), 2000);
    expect(t.sent).toHaveLength(16);
  });
});
