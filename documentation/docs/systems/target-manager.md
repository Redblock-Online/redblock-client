---
sidebar_position: 3
title: Target Manager
---

# Target Manager - Object Pooling & Performance

The TargetManager is a high-performance system for managing target generation with object pooling, spatial partitioning, and zero-allocation gameplay.

## ✨ Features

- ✅ **Object pooling** - Pre-initialized pool of 20-100 targets
- ✅ **Spatial grid** - O(1) collision detection vs O(n²)
- ✅ **Material pooling** - Reuse materials to prevent GPU memory leaks
- ✅ **Set-based management** - O(1) operations vs O(n) arrays
- ✅ **Zero allocations** - No GC pressure during gameplay
- ✅ **Stable FPS** - No performance degradation over time

## 🏗️ Architecture

### System Overview

```mermaid
graph TD
    A[TargetManager] --> B[Target Pool]
    A --> C[Spatial Grid]
    A --> D[Active Targets Set]
    A --> E[Inactive Targets Set]
    B --> F[Material Pool]
    B --> G[Geometry Cache]
    C --> H[Grid Cells Map]
```

### Key Components

#### 1. **Target Pool**
```typescript
// Pre-initialized pool
private readonly minPoolSize = 20;
private readonly maxPoolSize = 100;
private activeTargets = new Set<Target>();
private inactiveTargets = new Set<Target>();
```

#### 2. **Spatial Grid**
```typescript
// 3D grid for O(1) collision detection
private spatialGrid = new Map<string, Set<Target>>();
private readonly gridCellSize = 1.0; // 1 meter per cell
```

#### 3. **Material Pools**
```typescript
// Shared materials in Target.ts
private static materialPool: THREE.MeshToonMaterial[] = [];
private static edgeMaterialPool: THREE.MeshBasicMaterial[] = [];
```

## 📚 API Reference

### Target Generation

#### `generateTargets(count: number, roomX: number, roomZ: number, scale: number): Target[]`
Generates targets in a specified area.

**Parameters:**
- `count: number` - Number of targets to generate
- `roomX: number` - Room center X coordinate
- `roomZ: number` - Room center Z coordinate
- `scale: number` - Target scale (0.2 = small, 0.4 = normal)

**Returns:** `Target[]` - Array of generated targets

```typescript
const targets = targetManager.generateTargets(
  30,    // 30 targets
  0,     // Room X
  0,     // Room Z
  0.4    // Normal size
);
```

### Target Management

#### `resetAllTargets(): void`
Hides all active targets and clears the spatial grid.

```typescript
targetManager.resetAllTargets();
```

#### `getActiveTargets(): Target[]`
Returns array of currently active targets.

```typescript
const active = targetManager.getActiveTargets();
console.log(`${active.length} targets active`);
```

#### `updateActiveTargetsScale(scale: number): void`
Updates the scale of all active targets.

```typescript
targetManager.updateActiveTargetsScale(0.2); // Make smaller
```

### Statistics

#### `getStats(): { total: number; active: number; inactive: number; gridCells: number }`
Returns statistics about the target pool.

```typescript
const stats = targetManager.getStats();
console.log(`Pool: ${stats.total}, Active: ${stats.active}`);
```

### Cleanup

#### `dispose(): void`
Cleans up all resources.

```typescript
targetManager.dispose();
```

## 🎯 Usage Examples

### Basic Setup

```typescript
import { TargetManager } from '@/systems/TargetManager';

class MainScene {
  private targetManager: TargetManager;

  constructor(scene: THREE.Scene) {
    this.targetManager = new TargetManager(scene);
  }

  loadScenario(count: number) {
    // Reset previous targets
    this.targetManager.resetAllTargets();
    
    // Generate new targets
    const targets = this.targetManager.generateTargets(
      count,
      this.roomX,
      this.roomZ,
      0.4
    );
    
    console.log(`Generated ${targets.length} targets`);
  }
}
```

### Changing Target Size

```typescript
// Make all targets smaller
targetManager.updateActiveTargetsScale(0.2);

// Make all targets larger
targetManager.updateActiveTargetsScale(0.6);
```

### Performance Monitoring

```typescript
// Check pool status
const stats = targetManager.getStats();

if (stats.total > 80) {
  console.warn('Pool growing large:', stats.total);
}

if (stats.inactive === 0) {
  console.warn('Pool exhausted!');
}
```

## ⚡ Performance Optimizations

### 1. Object Pooling

**Before:**
```typescript
// ❌ Creates new target every time
const target = new Target(scene);
```

**After:**
```typescript
// ✅ Reuses from pool
const target = inactiveTargets.values().next().value;
target.setVisible(true);
```

**Benefits:**
- Zero allocations during gameplay
- No garbage collection pressure
- Consistent frame times

### 2. Spatial Grid Collision Detection

**Before (O(n²)):**
```typescript
// ❌ Check against ALL targets
for (const target of allTargets) {
  if (position.distanceTo(target.position) < minDist) {
    collision = true;
  }
}
```

**After (O(1)):**
```typescript
// ✅ Only check nearby cells (3×3×3 = 27 cells)
const cellKey = this.getCellKey(position);
const nearbyTargets = this.spatialGrid.get(cellKey);
```

**Performance:**
- 50 targets: **2,500 checks** → **~10 checks**
- 100 targets: **10,000 checks** → **~20 checks**

### 3. Material Pooling

**Before:**
```typescript
// ❌ New materials every time (13 per target!)
this.material = new THREE.MeshToonMaterial({ color });
this.edges.forEach(edge => {
  edge.material = new THREE.MeshBasicMaterial({ color });
});
```

**After:**
```typescript
// ✅ Reuse from pool
this.material = Target.getMaterial();
this.edges.forEach(edge => {
  edge.material = Target.getEdgeMaterial();
});
```

**Benefits:**
- 90%+ reduction in GPU allocations
- No memory leaks
- Faster target creation

### 4. Set-Based State Management

**Before (O(n)):**
```typescript
// ❌ Linear search
const target = targets.find(t => !t.visible);
```

**After (O(1)):**
```typescript
// ✅ Constant time
const target = inactiveTargets.values().next().value;
```

## 📊 Performance Comparison

### Memory Allocations

| Operation | Before | After |
|-----------|--------|-------|
| **Materials per reset** | 13 × count | 0 (pool reuse) |
| **Geometries per reset** | 1-2 × count | 0 (shared) |
| **Target objects** | Dynamic | Fixed pool |
| **Array operations** | O(n) × ops | O(1) × ops |

### Temporal Complexity

| Operation | Before | After |
|-----------|--------|-------|
| **Generate 50 targets** | ~50ms | ~5ms |
| **Reset targets** | O(n) forEach | O(1) Set clear |
| **Find inactive target** | O(n) find | O(1) Set pop |
| **Collision check** | O(n) | O(1) grid |
| **Scale update** | O(total) | O(active) |

### FPS Stability

#### Before:
```
Reset 1: 144 FPS
Reset 2: 130 FPS (-10%)
Reset 3: 115 FPS (-20%)
Reset 4: 98 FPS  (-32%)
Reset 5: 85 FPS  (-41%)
```

#### After:
```
Reset 1-100: 144 FPS (stable)
```

## 🔧 Implementation Details

### Spatial Grid

The spatial grid divides 3D space into 1m³ cells:

```typescript
private getCellKey(position: THREE.Vector3): string {
  const x = Math.floor(position.x / this.gridCellSize);
  const y = Math.floor(position.y / this.gridCellSize);
  const z = Math.floor(position.z / this.gridCellSize);
  return `${x},${y},${z}`;
}

private addToGrid(target: Target): void {
  const key = this.getCellKey(target.position);
  if (!this.spatialGrid.has(key)) {
    this.spatialGrid.set(key, new Set());
  }
  this.spatialGrid.get(key)!.add(target);
}
```

### Collision Detection

Only checks targets in adjacent cells:

```typescript
private checkCollision(position: THREE.Vector3, radius: number): boolean {
  // Check 3×3×3 = 27 cells around position
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cellKey = this.getCellKey(
          position.clone().add(new THREE.Vector3(dx, dy, dz))
        );
        const targets = this.spatialGrid.get(cellKey);
        if (targets) {
          for (const target of targets) {
            if (position.distanceTo(target.position) < radius) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}
```

## 🐛 Troubleshooting

### Pool exhausted warning

**Cause:** More than 100 targets requested

**Solution:**
```typescript
// Increase max pool size in TargetManager.ts
private readonly maxPoolSize = 150;
```

### Targets not appearing

**Cause:** Targets not added to scene

**Solution:**
```typescript
// TargetManager automatically adds to scene
// Just ensure scene is passed to constructor
const manager = new TargetManager(scene);
```

### Memory leaks

**Cause:** Not disposing materials properly

**Solution:**
```typescript
// TargetManager handles disposal automatically
// Just call dispose() when done
targetManager.dispose();
```

### Poor performance

**Cause:** Too many active targets

**Solution:**
```typescript
// Check active count
const stats = targetManager.getStats();
if (stats.active > 50) {
  console.warn('Too many active targets');
}
```

## 📈 Best Practices

### ✅ Do's

1. **Reuse the same TargetManager instance**
   ```typescript
   // ✅ Good - one instance
   this.targetManager = new TargetManager(scene);
   ```

2. **Reset before generating new targets**
   ```typescript
   // ✅ Good - clean slate
   targetManager.resetAllTargets();
   targetManager.generateTargets(30, x, z, 0.4);
   ```

3. **Monitor pool size**
   ```typescript
   // ✅ Good - track growth
   const stats = targetManager.getStats();
   console.log('Pool size:', stats.total);
   ```

### ❌ Don'ts

1. **Don't create multiple TargetManager instances**
   ```typescript
   // ❌ Bad - defeats pooling
   const manager1 = new TargetManager(scene);
   const manager2 = new TargetManager(scene);
   ```

2. **Don't manually create Target objects**
   ```typescript
   // ❌ Bad - bypasses pool
   const target = new Target(scene);
   ```

3. **Don't forget to reset**
   ```typescript
   // ❌ Bad - accumulates targets
   targetManager.generateTargets(30, x, z, 0.4);
   targetManager.generateTargets(30, x, z, 0.4); // Adds 30 more!
   ```

## 🔗 Integration

### With MainScene

```typescript
class MainScene {
  public targetManager: TargetManager;
  
  constructor() {
    this.targetManager = new TargetManager(this.scene);
  }
  
  loadScenario(count: number, halfSize: boolean = false) {
    const scale = halfSize ? 0.2 : 0.4;
    this.targetManager.resetAllTargets();
    const targets = this.targetManager.generateTargets(
      count,
      this.roomX,
      this.roomZ,
      scale
    );
    this.targets = targets; // Legacy compatibility
  }
}
```

### With App

```typescript
class App {
  resetScenario() {
    // Reset targets
    this.scene.targetManager.resetAllTargets();
    
    // Generate new ones
    const targets = this.scene.targetManager.generateTargets(
      this.targetCount,
      this.roomX,
      this.roomZ,
      this.targetScale
    );
    
    this.targets = targets;
  }
}
```

## Next Steps

- [Performance](/docs/performance/optimization) - More optimization techniques
- [App Class](/docs/core-concepts/app) - How App uses TargetManager
