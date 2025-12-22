import Target from "@/objects/Target";
import * as THREE from "three";
import type {
  ITargetGenerator,
  TargetGenerationConfig,
  TargetGenerationResult,
} from "./types";

/**
 * MovingTargetGenerator - Generates targets that move in patterns
 * For advanced training scenarios
 */
export class MovingTargetGenerator implements ITargetGenerator {
  private targetData = new Map<Target, { velocity: THREE.Vector3; bounds: { min: THREE.Vector3; max: THREE.Vector3 } }>();

  getName(): string {
    return "MovingTargetGenerator";
  }

  isMoving(): boolean {
    return true;
  }

  generate(
    config: TargetGenerationConfig,
    acquireTarget: () => Target | null,
    checkCollision: (target: Target, scale: number) => boolean
  ): TargetGenerationResult {
    const { count, roomX, roomZ, scale } = config;
    const targets: Target[] = [];
    const maxAttempts = count * 50;
    let attempts = 0;

    while (targets.length < count && attempts < maxAttempts) {
      attempts++;

      const target = acquireTarget();
      if (!target) {
        console.warn("[MovingTargetGenerator] Failed to acquire target from pool");
        break;
      }

      // Random starting position
      const x = roomX + (Math.random() - 0.5) * 14;
      const y = Math.random() * 2;
      const z = roomZ + (Math.random() - 0.5) * 14;

      target.position.set(x, y, z);

      // Check collision
      if (checkCollision(target, scale)) {
        continue;
      }

      // Random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 2
      );

      // Movement bounds
      const bounds = {
        min: new THREE.Vector3(roomX - 8, -1, roomZ - 8),
        max: new THREE.Vector3(roomX + 8, 2, roomZ + 8),
      };

      this.targetData.set(target, { velocity, bounds });
      targets.push(target);
    }

    const message = `Generated ${targets.length}/${count} moving targets (${attempts} attempts)`;
    return { targets, message };
  }

  update(deltaTime: number, targets: Target[]): void {
    for (const target of targets) {
      const data = this.targetData.get(target);
      if (!data) continue;

      const { velocity, bounds } = data;

      // Update position
      target.position.x += velocity.x * deltaTime;
      target.position.y += velocity.y * deltaTime;
      target.position.z += velocity.z * deltaTime;

      // Bounce off bounds
      if (target.position.x < bounds.min.x || target.position.x > bounds.max.x) {
        velocity.x *= -1;
        target.position.x = THREE.MathUtils.clamp(target.position.x, bounds.min.x, bounds.max.x);
      }
      if (target.position.y < bounds.min.y || target.position.y > bounds.max.y) {
        velocity.y *= -1;
        target.position.y = THREE.MathUtils.clamp(target.position.y, bounds.min.y, bounds.max.y);
      }
      if (target.position.z < bounds.min.z || target.position.z > bounds.max.z) {
        velocity.z *= -1;
        target.position.z = THREE.MathUtils.clamp(target.position.z, bounds.min.z, bounds.max.z);
      }

      // Rotate for visual effect
      target.rotation.y += deltaTime * 0.5;
    }
  }

  cleanupTarget(target: Target): void {
    this.targetData.delete(target);
  }
}
