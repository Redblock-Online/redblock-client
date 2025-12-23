/**
 * Event system for target generators
 * Defines what happens when a generator completes (all targets destroyed)
 */

/**
 * Event types that can be triggered
 */
export type EventType = "startGenerator" | "teleportPlayer" | "showMessage" | "playSound" | "spawnObject";

/**
 * Base event interface
 */
export interface BaseEvent {
  id: string; // Unique event ID
  type: EventType;
  enabled: boolean; // Can be disabled without removing
}

/**
 * Start another target generator
 */
export interface StartGeneratorEvent extends BaseEvent {
  type: "startGenerator";
  targetGeneratorId: string; // ID of the generator block to activate
}

/**
 * Teleport player to a position
 */
export interface TeleportPlayerEvent extends BaseEvent {
  type: "teleportPlayer";
  position: { x: number; y: number; z: number };
}

/**
 * Show a message to the player
 */
export interface ShowMessageEvent extends BaseEvent {
  type: "showMessage";
  message: string;
  duration: number; // seconds
}

/**
 * Play a sound effect
 */
export interface PlaySoundEvent extends BaseEvent {
  type: "playSound";
  soundId: string;
  volume: number; // 0-1
}

/**
 * Spawn an object at a position
 */
export interface SpawnObjectEvent extends BaseEvent {
  type: "spawnObject";
  objectType: string;
  position: { x: number; y: number; z: number };
}

/**
 * Union type of all possible events
 */
export type GameEvent = 
  | StartGeneratorEvent 
  | TeleportPlayerEvent 
  | ShowMessageEvent 
  | PlaySoundEvent 
  | SpawnObjectEvent;

/**
 * Event collection for a generator
 */
export interface EventCollection {
  onComplete: GameEvent[]; // Events triggered when all targets are destroyed
  onStart?: GameEvent[]; // Events triggered when generator starts (future)
  onTargetHit?: GameEvent[]; // Events triggered on each target hit (future)
}

/**
 * Helper to create a new event with defaults
 */
export function createEvent(type: EventType): GameEvent {
  const baseId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  switch (type) {
    case "startGenerator":
      return {
        id: baseId,
        type: "startGenerator",
        enabled: true,
        targetGeneratorId: "",
      };
    case "teleportPlayer":
      return {
        id: baseId,
        type: "teleportPlayer",
        enabled: true,
        position: { x: 0, y: 0, z: 0 },
      };
    case "showMessage":
      return {
        id: baseId,
        type: "showMessage",
        enabled: true,
        message: "Message",
        duration: 3,
      };
    case "playSound":
      return {
        id: baseId,
        type: "playSound",
        enabled: true,
        soundId: "",
        volume: 1.0,
      };
    case "spawnObject":
      return {
        id: baseId,
        type: "spawnObject",
        enabled: true,
        objectType: "cube",
        position: { x: 0, y: 0, z: 0 },
      };
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Create empty event collection
 */
export function createEmptyEventCollection(): EventCollection {
  return {
    onComplete: [],
  };
}
