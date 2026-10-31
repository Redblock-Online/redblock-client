import type * as THREE from "three";
import Target from "@/objects/Target";
import { targetsInfoIndexOf } from "@/utils/targetsInfo";
import type WSManager from "@/utils/ws/WSManager";
import { buildShotPayload, SHOT_SEND_LIMIT_PER_SEC, type ShotPayload } from "./shotProtocol";

export type LocalShot = {
  /** Camera world position when firing. */
  origin: THREE.Vector3;
  /** Camera world direction. */
  direction: THREE.Vector3;
  /** First raycast intersection, if any. */
  hit?: THREE.Intersection | null;
  /** True when the shot registered a target hit (the target starts breaking). */
  brokeTarget: boolean;
  /** Targets used to build `targetsInfo` (App.targets) and how many of them are sent. */
  targets: Target[];
  targetCount: number;
};

type ShotTransport = Pick<WSManager, "sendShot" | "getMe" | "isOnline">;

/**
 * Sends the local player's shots to the server as soon as they are fired.
 *
 * Mirrors the server's rate limit (15 shots/s) so excess shots are never sent, and
 * does nothing offline or in the editor (`disableServer: true`).
 *
 * @example
 * ```typescript
 * const reporter = new LocalShotReporter(wsManager, () => controls.requestNetworkSync());
 * reporter.report({ origin, direction, hit: intersects[0], brokeTarget, targets, targetCount });
 * ```
 */
export default class LocalShotReporter {
  private sentAt: number[] = [];

  /**
   * @param transport - WSManager (or a stub)
   * @param onTargetBroken - Called after a shot that broke a target, e.g. to push the new
   *                         `targetsInfo` without waiting for the next movement
   */
  constructor(
    private readonly transport: ShotTransport,
    private readonly onTargetBroken?: () => void
  ) {}

  /** @returns the payload that was sent, or null if nothing was sent */
  public report(shot: LocalShot, now: number = Date.now()): ShotPayload | null {
    if (!this.transport.isOnline()) return null;
    const me = this.transport.getMe();
    if (!me) return null;

    while (this.sentAt.length > 0 && now - this.sentAt[0] >= 1000) this.sentAt.shift();
    if (this.sentAt.length >= SHOT_SEND_LIMIT_PER_SEC) return null;

    let hitTargetIndex = -1;
    if (shot.hit && shot.brokeTarget) {
      const target = findTarget(shot.hit.object);
      if (target) hitTargetIndex = targetsInfoIndexOf(shot.targets, shot.targetCount, target);
    }

    const payload = buildShotPayload(shot.origin, shot.direction, me, shot.hit?.point ?? null, hitTargetIndex, now);
    if (!payload || !this.transport.sendShot(payload)) return null;
    this.sentAt.push(now);

    if (shot.brokeTarget) this.onTargetBroken?.();
    return payload;
  }
}

function findTarget(object: THREE.Object3D | null): Target | null {
  let node: THREE.Object3D | null = object;
  while (node && !(node instanceof Target)) node = node.parent;
  return node;
}
