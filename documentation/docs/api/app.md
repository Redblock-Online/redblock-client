---
sidebar_position: 1
title: App API
---

# App API Reference

Complete API reference for the main App class that manages the game lifecycle.

## Class: App

Main application class that orchestrates all game systems.

### Constructor

```typescript
constructor(canvas: HTMLCanvasElement, ui?: UIController, options?: AppOptions)
```

**Parameters:**
- `canvas` - HTMLCanvasElement for rendering
- `ui` - Optional UI controller for React integration
- `options` - Optional configuration object

**Options:**
```typescript
type AppOptions = {
  disableServer?: boolean;  // Disable WebSocket connection
  isEditorMode?: boolean;   // Enable editor mode
};
```

### Properties

#### Core Systems

```typescript
renderer: Renderer
camera: Camera
scene: MainScene
loop: Loop
controls: ControlsWithMovement
collisionSystem: PhysicsSystem
pistol: Pistol
audioManager: AudioManager
wsManager: WSManager
```

#### Game State

```typescript
gameRunning: boolean
targets: Target[]
paused: boolean
```

#### Statistics

```typescript
private shotsFired: number
private shotsHit: number
private reactionTimes: number[]
```

### Methods

#### Lifecycle

##### `async init(): Promise<void>`

Initializes all game systems.

```typescript
await app.init();
```

**Initialization Order:**
1. Physics system
2. Scene creation
3. Controls setup
4. Audio preloading
5. Loop creation

##### `startGame(): void`

Starts the game loop and enables physics.

```typescript
app.startGame();
```

**Actions:**
- Enables physics
- Locks pointer
- Starts render loop
- Sets `gameRunning = true`

##### `stopGame(): void`

Stops the game loop and disables physics.

```typescript
app.stopGame();
```

**Actions:**
- Disables physics
- Releases pointer lock
- Stops render loop
- Sets `gameRunning = false`

##### `dispose(): void`

Cleans up all resources.

```typescript
app.dispose();
```

**Cleanup Order:**
1. Stop loop
2. Dispose physics
3. Dispose scene
4. Dispose controls
5. Dispose renderer

#### Scenario Management

##### `loadScenario(scenarioId: string): Promise<void>`

Loads a scenario by ID.

```typescript
await app.loadScenario('gridshot');
```

##### `loadScenarioByIndex(index: number): void`

Loads a scenario by index.

```typescript
app.loadScenarioByIndex(0);
```

##### `getCurrentScenario(): ScenarioConfig | null`

Gets the currently loaded scenario.

```typescript
const scenario = app.getCurrentScenario();
if (scenario) {
  console.log(scenario.name);
}
```

##### `resetScenario(): void`

Resets the current scenario.

```typescript
app.resetScenario();
```

**Actions:**
- Removes all targets
- Resets statistics
- Respawns targets

#### Target Management

##### `spawnTarget(position: Vector3, scale?: number): Target`

Spawns a target at position.

```typescript
const target = app.spawnTarget(
  new Vector3(0, 1, 5),
  0.4  // Scale
);
```

##### `removeTarget(target: Target): void`

Removes a target from the scene.

```typescript
app.removeTarget(target);
```

##### `getAmmountOfTargetsSelected(): number`

Gets count of active targets.

```typescript
const count = app.getAmmountOfTargetsSelected();
```

#### Statistics

##### `getAccuracy(): number`

Gets current accuracy percentage.

```typescript
const accuracy = app.getAccuracy();
console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
```

**Returns:** 0-100 percentage

##### `getAverageReactionTime(): number`

Gets average reaction time in milliseconds.

```typescript
const avgReaction = app.getAverageReactionTime();
console.log(`Avg Reaction: ${avgReaction.toFixed(0)}ms`);
```

##### `getEfficiency(): number`

Gets efficiency score (hits per second).

```typescript
const efficiency = app.getEfficiency();
```

##### `resetStats(): void`

Resets all statistics.

```typescript
app.resetStats();
```

**Resets:**
- Shots fired
- Shots hit
- Reaction times
- Timer

#### Audio Control

##### `playSound(soundId: string, options?: AudioOptions): string`

Plays a sound effect.

```typescript
app.audioManager.play('impact', {
  volume: 0.3,
  channel: 'sfx'
});
```

##### `setMasterVolume(volume: number): void`

Sets master volume (0-1).

```typescript
app.audioManager.setMasterVolume(0.8);
```

##### `setChannelVolume(channel: string, volume: number): void`

Sets channel volume.

```typescript
app.audioManager.setChannelVolume('music', 0.5);
```

#### Networking

##### `connectToServer(roomId?: string): Promise<void>`

Connects to multiplayer server.

```typescript
await app.connectToServer('room-123');
```

##### `disconnectFromServer(): void`

Disconnects from server.

```typescript
app.disconnectFromServer();
```

#### Pause/Resume

##### `pause(): void`

Pauses the game.

```typescript
app.pause();
```

**Actions:**
- Stops loop
- Releases pointer lock
- Sets `paused = true`

##### `resume(): void`

Resumes the game.

```typescript
app.resume();
```

**Actions:**
- Starts loop
- Locks pointer
- Sets `paused = false`

### Events

The App class emits events through the UI controller:

#### `onTargetHit`

Fired when a target is hit.

```typescript
ui.onTargetHit((target: Target) => {
  console.log('Target hit!');
});
```

#### `onScenarioComplete`

Fired when scenario completes.

```typescript
ui.onScenarioComplete((stats: Stats) => {
  console.log('Scenario complete!', stats);
});
```

#### `onStatsUpdate`

Fired when statistics update.

```typescript
ui.onStatsUpdate((stats: Stats) => {
  console.log('Stats:', stats);
});
```

## Usage Examples

### Basic Setup

```typescript
import App from '@/core/App';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const app = new App(canvas);

await app.init();
app.startGame();
```

### With UI Controller

```typescript
import App from '@/core/App';
import { createUIController } from '@/ui/react/mountUI';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ui = createUIController();
const app = new App(canvas, ui);

await app.init();

// Listen to events
ui.onTargetHit(() => {
  console.log('Hit!');
});

app.startGame();
```

### Loading Scenarios

```typescript
// Load by ID
await app.loadScenario('gridshot');

// Load by index
app.loadScenarioByIndex(0);

// Get current
const scenario = app.getCurrentScenario();
console.log(scenario?.name);
```

### Statistics Tracking

```typescript
// Get stats
const accuracy = app.getAccuracy();
const avgReaction = app.getAverageReactionTime();
const efficiency = app.getEfficiency();

console.log(`
  Accuracy: ${accuracy.toFixed(1)}%
  Avg Reaction: ${avgReaction.toFixed(0)}ms
  Efficiency: ${efficiency.toFixed(2)} hits/s
`);

// Reset stats
app.resetStats();
```

### Audio Management

```typescript
// Play sounds
app.audioManager.play('shoot', { volume: 0.3 });
app.audioManager.play('impact', { volume: 0.3 });

// Control volumes
app.audioManager.setMasterVolume(0.8);
app.audioManager.setChannelVolume('music', 0.5);
app.audioManager.setChannelVolume('sfx', 0.7);
```

### Multiplayer

```typescript
// Connect to server
await app.connectToServer();

// Join specific room
await app.connectToServer('room-123');

// Disconnect
app.disconnectFromServer();
```

### Cleanup

```typescript
// Stop game
app.stopGame();

// Full cleanup
app.dispose();
```

## Type Definitions

### ScenarioConfig

```typescript
type ScenarioConfig = {
  id: string;
  name: string;
  description: string;
  targetCount: number;
  targetScale: number;
  spawnRadius: number;
  spawnHeight: number;
};
```

### Stats

```typescript
type Stats = {
  accuracy: number;        // 0-100
  avgReaction: number;     // milliseconds
  efficiency: number;      // hits per second
  time: number;           // seconds
  shotsFired: number;
  shotsHit: number;
};
```

### AudioOptions

```typescript
type AudioOptions = {
  volume?: number;         // 0-1
  loop?: boolean;
  channel?: 'sfx' | 'music' | 'ambient' | 'ui';
  pitch?: number;          // 0.5-2.0
};
```

## See Also

- [App Class Guide](/docs/core-concepts/app)
- [Game Loop](/docs/core-concepts/game-loop)
- [Audio System](/docs/systems/audio)
- [Physics System](/docs/systems/physics)
