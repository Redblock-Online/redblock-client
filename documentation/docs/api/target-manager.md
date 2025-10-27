---
sidebar_position: 5
title: TargetManager API
---

# TargetManager API Reference

Complete API reference for the TargetManager object pooling system.

## Class: TargetManager

High-performance target management with object pooling.

### Constructor

```typescript
constructor(scene: Scene, initialPoolSize: number = 20)
```

**Parameters:**
- `scene` - Three.js scene
- `initialPoolSize` - Initial pool size (default: 20)

### Methods

#### Pool Management

##### `getTarget(position: Vector3, scale?: number): Target`

Gets target from pool.

```typescript
const target = targetManager.getTarget(
  new Vector3(0, 1, 5),
  0.4  // Scale
);
```

**Automatically:**
- Reuses from pool if available
- Creates new if pool empty
- Adds to scene
- Registers in spatial grid

##### `returnTarget(target: Target): void`

Returns target to pool.

```typescript
targetManager.returnTarget(target);
```

**Automatically:**
- Removes from scene
- Hides target
- Unregisters from spatial grid
- Adds to inactive pool

##### `getStats(): { total: number; active: number; inactive: number }`

Gets pool statistics.

```typescript
const stats = targetManager.getStats();
console.log(`Active: ${stats.active}/${stats.total}`);
```

#### Spatial Grid

##### `updateTargetPosition(target: Target): void`

Updates target in spatial grid.

```typescript
target.mesh.position.set(5, 1, 5);
targetManager.updateTargetPosition(target);
```

##### `getNearbyTargets(position: Vector3, radius: number): Target[]`

Gets targets near position.

```typescript
const nearby = targetManager.getNearbyTargets(
  playerPosition,
  10  // Radius
);
```

**Performance:** O(1) using spatial grid

#### Cleanup

##### `dispose(): void`

Disposes all targets and materials.

```typescript
targetManager.dispose();
```

**Disposes:**
- All target geometries
- All materials
- Spatial grid
- Pool references

## Usage Examples

### Basic Setup

```typescript
import { TargetManager } from '@/systems/TargetManager';

const targetManager = new TargetManager(scene, 20);
```

### Spawning Targets

```typescript
// Spawn single target
const target = targetManager.getTarget(
  new Vector3(0, 1, 5),
  0.4
);

// Spawn multiple
for (let i = 0; i < 10; i++) {
  const pos = new Vector3(
    Math.random() * 10 - 5,
    1,
    Math.random() * 10 - 5
  );
  targetManager.getTarget(pos, 0.4);
}
```

### Removing Targets

```typescript
// On target hit
function onTargetHit(target: Target) {
  // Play animation
  target.playHitAnimation();
  
  // Return to pool after animation
  setTimeout(() => {
    targetManager.returnTarget(target);
  }, 200);
}
```

### Spatial Queries

```typescript
// Find nearby targets
const nearby = targetManager.getNearbyTargets(
  playerPosition,
  15  // 15 unit radius
);

console.log(`Found ${nearby.length} nearby targets`);

// Process nearby targets
for (const target of nearby) {
  // Do something with nearby target
}
```

### Pool Monitoring

```typescript
// Log stats periodically
setInterval(() => {
  const stats = targetManager.getStats();
  console.log(`
    Total: ${stats.total}
    Active: ${stats.active}
    Inactive: ${stats.inactive}
  `);
}, 5000);
```

## Type Definitions

### PoolStats

```typescript
type PoolStats = {
  total: number;      // Total targets in pool
  active: number;     // Currently active
  inactive: number;   // Available for reuse
};
```

### Target

```typescript
class Target {
  mesh: Mesh;
  isActive: boolean;
  scale: number;
  
  setVisible(visible: boolean): void;
  playHitAnimation(): void;
  dispose(): void;
}
```

## Performance

### Pool Benefits

- **Zero allocations** during gameplay
- **No GC pauses** from target spawning
- **Stable FPS** over time
- **Material reuse** prevents GPU leaks

### Spatial Grid Benefits

- **O(1) queries** vs O(n²) brute force
- **100x faster** for 50+ targets
- **Efficient collision detection**
- **Scalable to 100+ targets**

## See Also

- [Target Manager Guide](/docs/systems/target-manager)
- [Performance Optimization](/docs/performance/optimization)
- [Best Practices](/docs/performance/best-practices)
