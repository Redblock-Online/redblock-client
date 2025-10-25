import Target from "@/objects/Target";
import type {
  ITargetGenerator,
  TargetGenerationConfig,
  TargetGenerationResult,
} from "./types";

/**
 * RandomStaticGenerator - Generates static targets at random positions
 * Default generator for standard scenarios
 */
export class RandomStaticGenerator implements ITargetGenerator {
  getName(): string {
    return "RandomStaticGenerator";
  }

  isMoving(): boolean {
    return false;
  }

  generate(
    config: TargetGenerationConfig,
    acquireTarget: () => Target | null,
    checkCollision: (target: Target, scale: number) => boolean
  ): TargetGenerationResult {
    const { count, roomX, roomZ, scale, playerYaw } = config;
    const targets: Target[] = [];
    const maxAttempts = count * 50;
    let attempts = 0;

    // If playerYaw is provided, spawn targets in front of player
    const useDirectionalSpawn = playerYaw !== undefined;
    const forwardAngle = playerYaw ?? 0;
    
    // Calculate forward direction from yaw
    const forwardX = Math.cos(forwardAngle);
    const forwardZ = Math.sin(forwardAngle);

    while (targets.length < count && attempts < maxAttempts) {
      attempts++;

      const target = acquireTarget();
      if (!target) {
        console.warn("[RandomStaticGenerator] Failed to acquire target from pool");
        break;
      }

      let x: number, y: number, z: number;

      if (useDirectionalSpawn) {
        // Spawn in a cone in front of the player
        const distance = 3 + Math.random() * 10; // 3-13 units away
        const spread = (Math.random() - 0.5) * Math.PI * 0.6; // ±54 degrees spread
        
        const angle = forwardAngle + spread;
        const lateralOffset = (Math.random() - 0.5) * 6; // ±3 units lateral spread
        
        x = roomX + Math.cos(angle) * distance + Math.cos(angle + Math.PI / 2) * lateralOffset;
        z = roomZ + Math.sin(angle) * distance + Math.sin(angle + Math.PI / 2) * lateralOffset;
        y = Math.random() * 2.5 - 0.5; // -0.5 to 2 units height
      } else {
        // Random position within room bounds (legacy behavior)
        x = roomX + (Math.random() - 0.5) * 16;
        y = Math.random() * 3 - 1;
        z = roomZ + (Math.random() - 0.5) * 16;
      }

      target.position.set(x, y, z);
      target.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Check collision
      if (checkCollision(target, scale)) {
        continue;
      }

      targets.push(target);
    }

    const spawnMode = useDirectionalSpawn ? "directional" : "random";
    const message = `Generated ${targets.length}/${count} static targets (${spawnMode}, ${attempts} attempts)`;
    return { targets, message };
  }
}
