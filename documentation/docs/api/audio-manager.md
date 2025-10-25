---
sidebar_position: 4
title: AudioManager API
---

# AudioManager API Reference

Complete API reference for the AudioManager class.

## Class: AudioManager

Multi-channel audio system with pooling and volume control.

### Constructor

```typescript
constructor(poolSize: number = 20)
```

**Parameters:**
- `poolSize` - Number of audio elements in pool (default: 20)

### Properties

```typescript
private pool: HTMLAudioElement[]
private sounds: Map<string, string>
private masterVolume: number
private channelVolumes: Map<string, number>
private activeSounds: Map<string, HTMLAudioElement>
```

### Methods

#### Sound Loading

##### `async loadSound(id: string, url: string): Promise<void>`

Loads a single sound.

```typescript
await audio.loadSound('impact', '/audio/impact.mp3');
```

##### `async preloadSounds(sounds: [string, string][]): Promise<void>`

Batch loads multiple sounds.

```typescript
await audio.preloadSounds([
  ['shoot', '/audio/shoot.mp3'],
  ['impact', '/audio/impact.mp3'],
  ['reload', '/audio/reload.mp3']
]);
```

**Returns:** Promise that resolves when all sounds loaded

#### Playback

##### `play(id: string, options?: AudioOptions): string`

Plays a sound.

```typescript
const soundId = audio.play('impact', {
  volume: 0.3,
  loop: false,
  channel: 'sfx',
  pitch: 1.0
});
```

**Options:**
```typescript
type AudioOptions = {
  volume?: number;    // 0-1, default: 1.0
  loop?: boolean;     // default: false
  channel?: string;   // 'sfx' | 'music' | 'ambient' | 'ui'
  pitch?: number;     // 0.5-2.0, default: 1.0
};
```

**Returns:** Unique sound instance ID

##### `stop(instanceId: string): void`

Stops a playing sound.

```typescript
const id = audio.play('music', { loop: true });
// Later...
audio.stop(id);
```

##### `stopAll(): void`

Stops all playing sounds.

```typescript
audio.stopAll();
```

#### Volume Control

##### `setMasterVolume(volume: number): void`

Sets master volume (0-1).

```typescript
audio.setMasterVolume(0.8);
```

##### `getMasterVolume(): number`

Gets master volume.

```typescript
const volume = audio.getMasterVolume();
```

##### `setChannelVolume(channel: string, volume: number): void`

Sets channel volume (0-1).

```typescript
audio.setChannelVolume('music', 0.5);
audio.setChannelVolume('sfx', 0.7);
```

##### `getChannelVolume(channel: string): number`

Gets channel volume.

```typescript
const musicVolume = audio.getChannelVolume('music');
```

#### Utility

##### `isLoaded(id: string): boolean`

Checks if sound is loaded.

```typescript
if (audio.isLoaded('impact')) {
  audio.play('impact');
}
```

##### `getPoolStats(): { total: number; active: number; available: number }`

Gets pool statistics.

```typescript
const stats = audio.getPoolStats();
console.log(`Active: ${stats.active}/${stats.total}`);
```

## Usage Examples

### Basic Setup

```typescript
import { AudioManager } from '@/utils/AudioManager';

const audio = new AudioManager(20);

// Preload sounds
await audio.preloadSounds([
  ['shoot', '/audio/shoot.mp3'],
  ['impact', '/audio/impact.mp3']
]);

// Play sound
audio.play('shoot', { volume: 0.3 });
```

### Channel Management

```typescript
// Set channel volumes
audio.setChannelVolume('music', 0.5);
audio.setChannelVolume('sfx', 0.7);
audio.setChannelVolume('ambient', 0.4);

// Play on specific channels
audio.play('bgm', { channel: 'music', loop: true });
audio.play('impact', { channel: 'sfx', volume: 0.3 });
audio.play('wind', { channel: 'ambient', loop: true });
```

### Looping Sounds

```typescript
// Start loop
const stepsId = audio.play('steps', {
  loop: true,
  volume: 0.2,
  channel: 'sfx'
});

// Stop loop later
audio.stop(stepsId);
```

### Pitch Control

```typescript
// Normal pitch
audio.play('impact', { pitch: 1.0 });

// Lower pitch
audio.play('impact', { pitch: 0.8 });

// Higher pitch
audio.play('impact', { pitch: 1.2 });
```

## Type Definitions

### AudioOptions

```typescript
type AudioOptions = {
  volume?: number;         // 0-1
  loop?: boolean;
  channel?: 'sfx' | 'music' | 'ambient' | 'ui';
  pitch?: number;          // 0.5-2.0
};
```

### PoolStats

```typescript
type PoolStats = {
  total: number;      // Total pool size
  active: number;     // Currently playing
  available: number;  // Available for use
};
```

## See Also

- [Audio System Guide](/docs/systems/audio)
- [Performance Best Practices](/docs/performance/best-practices)
