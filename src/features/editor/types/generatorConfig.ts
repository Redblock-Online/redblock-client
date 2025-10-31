/**
 * Configuration for target generator components in the editor
 */

import type { EventCollection } from "./eventConfig";

export type GeneratorType = "randomStatic" | "moving";

export interface BaseGeneratorConfig {
  type: GeneratorType;
  targetCount: number;
  targetScale: number; // 0.2 for half-size, 0.4 for normal
  enabled: boolean; // If false, generator won't spawn targets until activated
  visible: boolean; // If false, targets are invisible until generator is enabled
  events?: EventCollection; // Events triggered by this generator
}

export interface RandomStaticGeneratorConfig extends BaseGeneratorConfig {
  type: "randomStatic";
  // Spawn bounds relative to generator position
  spawnBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

export interface MovingTargetGeneratorConfig extends BaseGeneratorConfig {
  type: "moving";
  speed: number; // Movement speed
  pattern: "linear" | "circular" | "random"; // Movement pattern
  amplitude: number; // Movement range/amplitude
}

export type GeneratorConfig = RandomStaticGeneratorConfig | MovingTargetGeneratorConfig;

/**
 * Default configurations for each generator type
 */
export const DEFAULT_RANDOM_STATIC_CONFIG: RandomStaticGeneratorConfig = {
  type: "randomStatic",
  targetCount: 5,
  targetScale: 0.4,
  enabled: true,
  visible: true,
  spawnBounds: {
    minX: -5,
    maxX: 5,
    minY: 0,
    maxY: 3,
    minZ: 2,
    maxZ: 10,
  },
};

export const DEFAULT_MOVING_CONFIG: MovingTargetGeneratorConfig = {
  type: "moving",
  targetCount: 5,
  targetScale: 0.4,
  enabled: true,
  visible: true,
  speed: 2,
  pattern: "linear",
  amplitude: 2.0,
};
