import type Cube from "@/objects/Cube";
import type { TargetInfo } from "@/scenes/MainScene";

export function buildTargetsInfo(
  targets: Cube[],
  ammountOfTargetsSelected: number
): TargetInfo[] {
  // keep only the last `ammountOfTargetsSelected` targets
  const lastTargets = targets.slice(-ammountOfTargetsSelected);

  return lastTargets.map((t) => ({
    x: t.position.x,
    y: t.position.y,
    z: t.position.z,
    shootable: (t as any).shootable === true,
    disabled: !t.visible || (t as any).animating === true,
  }));
}
