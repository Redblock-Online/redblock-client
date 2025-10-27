# Target Generators System

## Overview

The Target Generators system allows creating dynamic target spawning configurations in the editor that can be used in custom maps. Generators can be enabled/disabled, have events, and support various spawn patterns.

## Architecture

### Core Components

1. **Generator Configuration** (`GeneratorConfig`)
   - Type: `randomStatic` or `moving`
   - Target count and scale
   - Spawn bounds (for randomStatic)
   - Enabled/visible state
   - Event system (onComplete events)

2. **Event System** (`EventConfig`)
   - `startGenerator`: Activate another generator when current completes
   - Events use generator IDs to reference other generators
   - Events execute when all targets from a generator are destroyed

3. **Generator Metadata** (`app.generatorMetadata`)
   - Maps generator ID → configuration + targets
   - Tracks which generators are completed
   - Stores target references for each generator

## Generator Types

### Random Static Generator

Spawns targets randomly within defined bounds relative to the generator position.

```typescript
{
  type: "randomStatic",
  targetCount: 15,
  targetScale: 0.4,
  enabled: true,
  visible: true,
  spawnBounds: {
    minX: -5,
    maxX: 5,
    minY: 0,
    maxY: 3,
    minZ: -5,
    maxZ: 5
  }
}
```

### Moving Generator (Future)

Will support moving target patterns.

## Event System

### Start Generator Event

Activates another generator when the current generator's targets are all destroyed.

```typescript
{
  id: "event-123",
  type: "startGenerator",
  enabled: true,
  targetGeneratorId: "block-4" // ID of generator to activate
}
```

### Event Flow

1. User destroys all targets from Generator A
2. `checkGeneratorCompletion()` detects completion
3. Executes `onComplete` events
4. `activateGenerator()` called for target generator
5. Generator B's targets spawn and become shootable

## Implementation Details

### Generator Creation (Editor)

```typescript
// In EditorRoot.tsx
const generatorConfig: GeneratorConfig = {
  type: "randomStatic",
  targetCount: 5,
  targetScale: 0.4,
  enabled: true,
  visible: true,
  spawnBounds: {
    minX: -5, maxX: 5,
    minY: 0, maxY: 3,
    minZ: -5, maxZ: 5
  },
  events: {
    onComplete: []
  }
};

block.mesh.userData.isGenerator = true;
block.mesh.userData.generatorConfig = generatorConfig;
```

### Generator Loading (Game)

```typescript
// In gameBootstrap.ts - processBlockRecursively()
if (block.isGenerator && block.generatorConfig) {
  const config = block.generatorConfig;
  const generatorId = block.id || `gen-${Date.now()}`;
  
  // Generate targets
  for (let i = 0; i < config.targetCount; i++) {
    const target = new Target(0xffffff, true, false, config.targetScale === 0.2);
    
    // Position within bounds
    const x = generatorPos.x + bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const y = generatorPos.y + bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    const z = generatorPos.z + bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    
    target.position.set(x, y, z);
    target.cubeMesh.userData.generatorId = generatorId;
    
    app.targets.push(target);
    generatorTargets.push(target);
  }
  
  // Store metadata
  app.generatorMetadata.set(generatorId, {
    config: block.generatorConfig,
    position: block.transform.position,
    targets: generatorTargets
  });
  
  // Make first target shootable
  if (generatorTargets.length > 0) {
    generatorTargets[0].makeShootable(0xff0000);
  }
}
```

### Event Execution (Game)

```typescript
// In App.ts - checkGeneratorCompletion()
private checkGeneratorCompletion(hitTarget: Target): boolean {
  const generatorId = hitTarget.cubeMesh.userData.generatorId;
  const metadata = this.generatorMetadata.get(generatorId);
  
  // Check if all targets destroyed
  const allDestroyed = metadata.targets.every(t => !t.visible || t.animating);
  
  if (allDestroyed) {
    this.completedGenerators.add(generatorId);
    
    // Execute events
    const events = metadata.config.events?.onComplete || [];
    for (const event of events) {
      if (event.type === "startGenerator" && event.targetGeneratorId) {
        this.activateGenerator(event.targetGeneratorId);
      }
    }
  }
}
```

### Generator Activation

```typescript
// In App.ts - activateGenerator()
private activateGenerator(generatorId: string): void {
  const metadata = this.generatorMetadata.get(generatorId);
  
  // Remove from completed set
  this.completedGenerators.delete(generatorId);
  
  // If targets already exist, reset them
  if (metadata.targets.length > 0) {
    metadata.targets.forEach(target => {
      // Kill animations
      if (target.activeTweens) {
        target.activeTweens.forEach(t => t.kill());
        target.activeTweens = [];
      }
      
      // Reset state
      target.visible = true;
      target.animating = false;
      target.shootable = false;
      target.scale.set(target.baseScale, target.baseScale, target.baseScale);
      target.setColor(0xffffff);
    });
    
    // Make first shootable
    metadata.targets[0].makeShootable(0xff0000);
  } else {
    // Generate new targets (first activation)
    // ... target generation code ...
  }
}
```

## Editor UI

### Generator Config Panel

Located in `GeneratorConfigPanel.tsx`:

- **Type Selection**: randomStatic or moving
- **Target Count**: Number of targets to spawn
- **Target Scale**: 0.2 (small) or 0.4 (normal)
- **Enabled**: Whether generator starts active
- **Visible**: Whether targets are initially visible
- **Spawn Bounds**: Min/Max X/Y/Z relative to generator

### Event Config Panel

Located in `EventConfigPanel.tsx`:

- **Event Type**: startGenerator, teleportPlayer, etc.
- **Target Generator**: Select which generator to activate
- **Link Button (🎯)**: Click to enter selection mode, then click target generator

## Serialization

Generators are saved in `.rbonline` files:

```json
{
  "type": "block",
  "id": "block-9",
  "isGenerator": true,
  "generatorConfig": {
    "type": "randomStatic",
    "targetCount": 15,
    "targetScale": 0.4,
    "enabled": true,
    "visible": true,
    "spawnBounds": {
      "minX": -5,
      "maxX": 5,
      "minY": 0,
      "maxY": 3,
      "minZ": -5,
      "maxZ": 5
    },
    "events": {
      "onComplete": [
        {
          "id": "event-123",
          "type": "startGenerator",
          "enabled": true,
          "targetGeneratorId": "block-4"
        }
      ]
    }
  },
  "transform": {
    "position": { "x": 0, "y": 0, "z": 0 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 0.6, "y": 0.6, "z": 0.6 }
  }
}
```

## Best Practices

### Generator Placement

1. **Position generators strategically** - Place where targets should spawn
2. **Use spawn bounds** - Define clear spawn areas
3. **Test in Play mode** - Verify target positions before saving

### Event Chains

1. **Linear progression** - Gen1 → Gen2 → Gen3
2. **Branching** - Gen1 → Gen2A and Gen2B
3. **Loops** - Gen3 → Gen1 (creates repeatable challenges)

### Performance

1. **Limit target count** - Max 50 targets per generator recommended
2. **Reuse targets** - Generators reuse targets on reactivation
3. **Collision optimization** - Targets use optimized collision detection

## Troubleshooting

### Targets Not Spawning

- Check `enabled: true` in generator config
- Verify spawn bounds are valid (max > min)
- Check console for error messages

### Events Not Firing

- Verify `targetGeneratorId` matches target generator's ID
- Check event is `enabled: true`
- Ensure all targets are destroyed (check `allDestroyed` log)

### Targets Not Shootable

- First target should auto-activate
- Check `makeShootable()` is called
- Verify target has `shootable: true` property

## Future Enhancements

- [ ] Moving target patterns
- [ ] Timed spawning
- [ ] Wave-based generation
- [ ] Conditional events
- [ ] Sound effects on completion
- [ ] Visual effects on spawn
