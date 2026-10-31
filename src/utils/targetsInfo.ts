import type Target from "@/objects/Target";
import type { TargetInfo } from "@/features/game/scenes";

export function buildTargetsInfo(
  targets: Target[],
  ammountOfTargetsSelected: number
): TargetInfo[] {
  // keep only the last `ammountOfTargetsSelected` targets
  const lastTargets = targets.slice(-ammountOfTargetsSelected);

  return lastTargets.map((t) => ({
    x: t.position.x,
    y: t.position.y,
    z: t.position.z,
    shootable: t.shootable === true,
    disabled: !t.visible || t.animating === true,
  }));
}

/**
 * Index of `target` inside the array produced by {@link buildTargetsInfo} for the same
 * inputs, or -1 if it is not part of it. Used to tell neighbours which of the targets
 * they render was broken by a shot.
 */
export function targetsInfoIndexOf(
  targets: Target[],
  ammountOfTargetsSelected: number,
  target: Target
): number {
  return targets.slice(-ammountOfTargetsSelected).indexOf(target);
}
