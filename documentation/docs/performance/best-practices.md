---
sidebar_position: 2
title: Best Practices
---

# Performance Best Practices

Essential guidelines for writing high-performance code in Redblock.

## 🎯 General Principles

### 1. Avoid Allocations in Hot Paths

**❌ Bad:**
```typescript
update(deltaTime: number) {
  const velocity = new Vector3(1, 0, 0);  // Allocation every frame!
  const temp = new Vector3();             // More allocations!
  position.add(velocity.multiplyScalar(deltaTime));
}
```

**✅ Good:**
```typescript
private velocity = new Vector3(1, 0, 0);
private temp = new Vector3();

update(deltaTime: number) {
  this.temp.copy(this.velocity).multiplyScalar(deltaTime);
  position.add(this.temp);
}
```

### 2. Use Object Pooling

**❌ Bad:**
```typescript
function createTarget() {
  return new Target(scene);  // New allocation
}
```

**✅ Good:**
```typescript
function getTarget() {
  return targetPool.get();  // Reuse from pool
}
```

### 3. Batch Operations

**❌ Bad:**
```typescript
targets.forEach(target => {
  target.update();
  target.render();
});
```

**✅ Good:**
```typescript
// Update all first
for (let i = 0; i < targets.length; i++) {
  targets[i].update();
}
// Then render all
for (let i = 0; i < targets.length; i++) {
  targets[i].render();
}
```

## 🔧 Code Patterns

### Reusable Vectors

```typescript
class MySystem {
  // Reusable vectors for calculations
  private _tempVec1 = new Vector3();
  private _tempVec2 = new Vector3();
  private _tempVec3 = new Vector3();
  
  update() {
    // Use temp vectors instead of creating new ones
    this._tempVec1.copy(positionA);
    this._tempVec2.copy(positionB);
    this._tempVec3.subVectors(this._tempVec2, this._tempVec1);
    
    const distance = this._tempVec3.length();
  }
}
```

### Loop Optimization

```typescript
// ❌ Bad - forEach creates function closure
targets.forEach(target => target.update());

// ✅ Good - for loop is faster
for (let i = 0; i < targets.length; i++) {
  targets[i].update();
}

// ✅ Even better - cache length
const len = targets.length;
for (let i = 0; i < len; i++) {
  targets[i].update();
}
```

### Conditional Checks

```typescript
// ❌ Bad - checks every frame
update() {
  if (this.enabled && this.visible && this.active) {
    // Do work
  }
}

// ✅ Good - early return
update() {
  if (!this.enabled) return;
  if (!this.visible) return;
  if (!this.active) return;
  
  // Do work
}
```

## 🎨 Three.js Specific

### Material Reuse

```typescript
// ❌ Bad
const material = new MeshStandardMaterial({ color: 0xff0000 });
mesh.material = material;

// ✅ Good - reuse from pool
const material = materialPool.get();
material.color.set(0xff0000);
mesh.material = material;
```

### Geometry Sharing

```typescript
// ❌ Bad - new geometry for each cube
cubes.forEach(cube => {
  cube.geometry = new BoxGeometry(1, 1, 1);
});

// ✅ Good - share one geometry
const sharedGeometry = new BoxGeometry(1, 1, 1);
cubes.forEach(cube => {
  cube.geometry = sharedGeometry;
});
```

### Dispose Properly

```typescript
dispose() {
  // Dispose geometry
  if (this.mesh.geometry) {
    this.mesh.geometry.dispose();
  }
  
  // Dispose material
  if (this.mesh.material) {
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
  
  // Dispose texture
  if (this.texture) {
    this.texture.dispose();
  }
}
```

## 🔊 Audio Best Practices

### Preload Sounds

```typescript
// ❌ Bad - load during gameplay
async playSound() {
  await audio.loadSound('impact', '/audio/impact.mp3');
  audio.play('impact');
}

// ✅ Good - preload at startup
async init() {
  await audio.preloadSounds([
    ['impact', '/audio/impact.mp3'],
    ['shoot', '/audio/shoot.mp3']
  ]);
}

playSound() {
  audio.play('impact');  // Already loaded
}
```

### Use Low Volumes

```typescript
// ❌ Bad - clipping/distortion
audio.play('impact', { volume: 1.0 });

// ✅ Good - leaves headroom
audio.play('impact', { volume: 0.3 });
```

### Stop Loops

```typescript
// ❌ Bad - loops accumulate
audio.play('steps', { loop: true });

// ✅ Good - track and stop
const stepsId = audio.play('steps', { loop: true });
// Later...
audio.stop(stepsId);
```

## ⚡ Physics Best Practices

### Use Static Bodies

```typescript
// ❌ Bad - dynamic body for static object
const bodyDesc = RAPIER.RigidBodyDesc.dynamic();

// ✅ Good - static body has zero overhead
const bodyDesc = RAPIER.RigidBodyDesc.fixed();
```

### Reduce Solver Iterations

```typescript
// Balance quality vs performance
world.integrationParameters.numSolverIterations = 2;  // Default: 4
world.integrationParameters.numInternalPgsIterations = 1;  // Default: 1
```

### Use Simple Colliders

```typescript
// ❌ Bad - complex mesh collider
const collider = RAPIER.ColliderDesc.trimesh(vertices, indices);

// ✅ Good - simple shapes
const collider = RAPIER.ColliderDesc.cuboid(1, 1, 1);
const collider = RAPIER.ColliderDesc.capsule(0.5, 0.25);
```

## 📊 Profiling Best Practices

### Add Performance Marks

```typescript
performance.mark('update-start');
this.update(deltaTime);
performance.mark('update-end');
performance.measure('update', 'update-start', 'update-end');

// View in Chrome DevTools Performance tab
```

### Monitor Pool Sizes

```typescript
// Log periodically
if (frameCount % 300 === 0) {
  const stats = targetManager.getStats();
  console.log(`Targets: ${stats.active}/${stats.total}`);
}
```

### Track Frame Time

```typescript
class FrameTimer {
  private samples: number[] = [];
  
  record(deltaTime: number) {
    this.samples.push(deltaTime * 1000);
    if (this.samples.length > 60) {
      this.samples.shift();
    }
  }
  
  getAverage() {
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }
}
```

## 🎮 Gameplay Best Practices

### Frame-Independent Movement

```typescript
// ❌ Bad - speed varies with FPS
position.x += 0.1;

// ✅ Good - consistent at any FPS
position.x += velocity * deltaTime;
```

### Clamp Delta Time

```typescript
// ❌ Bad - spiral of death on slow frames
update(deltaTime: number) {
  physics.step(deltaTime);
}

// ✅ Good - clamp to prevent issues
update(deltaTime: number) {
  const dt = Math.min(deltaTime, 0.1);
  physics.step(dt);
}
```

### Update Order

```typescript
// ✅ Correct order
update(deltaTime: number) {
  this.physics.step(deltaTime);      // 1. Physics first
  this.controls.update(deltaTime);   // 2. Then controls
  this.weapons.update(deltaTime);    // 3. Then weapons
  this.scene.update();               // 4. Then scene
  this.render();                     // 5. Finally render
}
```

## 🌐 Network Best Practices

### Throttle Updates

```typescript
// ❌ Bad - send every frame
update() {
  sendPositionUpdate(position);
}

// ✅ Good - throttle to 20Hz
private updateTimer = 0;
private updateInterval = 1 / 20;

update(deltaTime: number) {
  this.updateTimer += deltaTime;
  
  if (this.updateTimer >= this.updateInterval) {
    sendPositionUpdate(position);
    this.updateTimer = 0;
  }
}
```

### Quantize Values

```typescript
// ❌ Bad - full precision
const data = { x: 1.23456789, y: 2.34567890 };

// ✅ Good - quantize to 2cm
const quant = 0.02;
const data = {
  x: Math.round(position.x / quant) * quant,
  y: Math.round(position.y / quant) * quant
};
```

### Only Send Changes

```typescript
// ❌ Bad - send always
sendUpdate(position, rotation);

// ✅ Good - only if changed
const posChanged = position.distanceTo(lastPos) > 0.08;
const rotChanged = Math.abs(rotation - lastRot) > 0.026;

if (posChanged || rotChanged) {
  sendUpdate(position, rotation);
  lastPos.copy(position);
  lastRot = rotation;
}
```

## 📝 Code Review Checklist

### Before Committing

- [ ] No allocations in update loops
- [ ] Vectors/objects reused
- [ ] Materials from pool
- [ ] Geometries shared
- [ ] Proper disposal
- [ ] Frame-independent movement
- [ ] Delta time clamped
- [ ] Profiling marks added
- [ ] Pool sizes monitored
- [ ] Network throttled

### Performance Red Flags

- 🚩 `new` keyword in update methods
- 🚩 `forEach` in hot paths
- 🚩 Creating materials dynamically
- 🚩 Not disposing resources
- 🚩 Fixed movement values
- 🚩 No frame rate limiting
- 🚩 Sending updates every frame
- 🚩 Complex physics shapes

## 🔗 Related

- [Optimization](/docs/performance/optimization) - Detailed techniques
- [Target Manager](/docs/systems/target-manager) - Pooling implementation
- [Game Loop](/docs/core-concepts/game-loop) - Frame timing
- [Physics System](/docs/systems/physics) - Physics optimization

## Summary

**Key Takeaways:**

1. **Reuse, don't recreate** - Object pools, material pools, geometry sharing
2. **Profile regularly** - Measure before optimizing
3. **Batch operations** - Group similar work together
4. **Frame-independent** - Always use deltaTime
5. **Dispose properly** - Prevent memory leaks

**Performance Mantra:** *"Allocate once, reuse forever"*
