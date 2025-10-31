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
