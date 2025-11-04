import Target from "@/objects/Target";

/**
 * Configuration for target generation
 */
export interface TargetGenerationConfig {
  count: number;
  roomX: number;
  roomZ: number;
  scale: number;
  playerYaw?: number; // Player's yaw rotation in radians (targets spawn in front)
}

/**
 * Result of target generation
 */
export interface TargetGenerationResult {
  targets: Target[];
  message: string;
}

/**
 * Interface for target generation strategies
 */
export interface ITargetGenerator {
  /**
   * Get the name of this generator
   */
  getName(): string;

  /**
   * Generate targets based on configuration
   * @param config - Generation configuration
   * @param acquireTarget - Function to acquire a target from the pool
   * @param checkCollision - Function to check if a target collides with existing targets
   */
  generate(
    config: TargetGenerationConfig,
    acquireTarget: () => Target | null,
    checkCollision: (target: Target, scale: number) => boolean
  ): TargetGenerationResult;

  /**
   * Whether this generator creates moving targets
   */
  isMoving(): boolean;

  /**
   * Update targets (for moving generators)
   */
  update?(deltaTime: number, targets: Target[]): void;
}
