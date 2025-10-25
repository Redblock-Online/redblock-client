---
sidebar_position: 2
title: Target Generators
---

# Target Generators

Target generators are special blocks in the editor that spawn targets dynamically during gameplay. They support event-driven behavior and can be chained together for complex training scenarios.

## ✨ Features

- ✅ **Random Static Generators** - Spawn targets in random positions
- ✅ **Event System** - Chain generators with completion events
- ✅ **Configurable Parameters** - Count, radius, scale, height
- ✅ **Visual Markers** - Pink/magenta blocks in editor
- ✅ **Enable/Disable** - Toggle generators on/off
- ✅ **Visibility Control** - Show/hide generator markers in game

## 🏗️ Generator Types

### Random Static Generator

Spawns a specified number of targets in random positions within a radius.

```typescript
type RandomStaticConfig = {
  type: 'randomStatic';
  enabled: boolean;
  visible: boolean;
  count: number;          // Number of targets to spawn
  spawnRadius: number;    // Radius around generator
  targetScale: number;    // Target size (0.2 = small, 0.4 = normal)
  spawnHeight: number;    // Height above ground
  completionEvents: CompletionEvent[];
};
```

## 📚 Configuration

### Generator Config

```typescript
type GeneratorConfig = {
  type: 'randomStatic' | 'moving';
  enabled: boolean;              // Whether generator is active
  visible: boolean;              // Show generator marker in game
  count: number;                 // Number of targets
  spawnRadius: number;           // Spawn area radius
  targetScale: number;           // Target size
  spawnHeight: number;           // Spawn height
  completionEvents: CompletionEvent[];
};
```

### Completion Events

Events triggered when all targets from a generator are destroyed:

```typescript
type CompletionEvent = {
  type: 'enableGenerator';
  targetGeneratorId: string;     // ID of generator to enable
};
```

## 🎯 Usage Examples

### Creating a Generator

```typescript
// Place generator in editor
const generator = editor.placeRandomTargetGeneratorAt(
  event.clientX,
  event.clientY
);

// Configure it
editor.updateGeneratorConfig(generator.id, {
  type: 'randomStatic',
  enabled: true,
  visible: false,              // Hide in game
  count: 30,
  spawnRadius: 10,
  targetScale: 0.4,
  spawnHeight: 1.5,
  completionEvents: []
});
```

### Chaining Generators

Create a sequence where completing one generator enables the next:

```typescript
// Generator 1 - Active at start
const gen1 = editor.placeRandomTargetGeneratorAt(100, 100);
editor.updateGeneratorConfig(gen1.id, {
  type: 'randomStatic',
  enabled: true,
  visible: false,
  count: 20,
  spawnRadius: 8,
  targetScale: 0.4,
  spawnHeight: 1.5,
  completionEvents: [
    {
      type: 'enableGenerator',
      targetGeneratorId: 'gen-2'  // Enable gen2 when done
    }
  ]
});

// Generator 2 - Disabled at start
const gen2 = editor.placeRandomTargetGeneratorAt(200, 200);
editor.updateGeneratorConfig(gen2.id, {
  type: 'randomStatic',
  enabled: false,              // Starts disabled
  visible: false,
  count: 30,
  spawnRadius: 10,
  targetScale: 0.3,            // Smaller targets
  spawnHeight: 2.0,
  completionEvents: []
});
```

### Progressive Difficulty

```typescript
// Easy wave
const easyGen = createGenerator({
  count: 15,
  spawnRadius: 12,
  targetScale: 0.5,            // Large targets
  completionEvents: [{ 
    type: 'enableGenerator', 
    targetGeneratorId: 'medium-gen' 
  }]
});

// Medium wave
const mediumGen = createGenerator({
  enabled: false,
  count: 25,
  spawnRadius: 10,
  targetScale: 0.4,            // Normal targets
  completionEvents: [{ 
    type: 'enableGenerator', 
    targetGeneratorId: 'hard-gen' 
  }]
});

// Hard wave
const hardGen = createGenerator({
  enabled: false,
  count: 40,
  spawnRadius: 8,
  targetScale: 0.2,            // Small targets
  completionEvents: []
});
```

## 🎨 Visual Appearance

### In Editor

Generators appear as pink/magenta cubes:

```typescript
// Generator marker color
const GENERATOR_COLOR = 0xff4dff;  // Pink/magenta

// With emissive glow
material.emissive = new Color(0xff4dff);
material.emissiveIntensity = 0.2;
```

### In Game

- **visible: true** - Generator marker visible during gameplay
- **visible: false** - Generator marker hidden (recommended)

## 🔧 Implementation

### Placing a Generator

```typescript
public placeRandomTargetGeneratorAt(
  clientX: number, 
  clientY: number
): EditorBlock | null {
  const point = this.intersectGround(clientX, clientY);
  if (!point) return null;

  // Create generator marker
  const generator = this.blocks.createBlock({
    position: point.setY(0.5),
    scale: new Vector3(0.6, 0.6, 0.6),
  });
  
  // Mark as generator
  generator.mesh.userData.isGenerator = true;
  generator.mesh.userData.generatorType = "randomStatic";
  generator.generatorConfig = { ...DEFAULT_RANDOM_STATIC_CONFIG };
  generator.mesh.userData.generatorConfig = generator.generatorConfig;
  
  // Set appearance
  const material = (generator.mesh as Mesh).material as MeshStandardMaterial;
  material.color.set(0xff4dff);
  material.emissive = new Color(0xff4dff);
  material.emissiveIntensity = 0.2;
  
  return generator;
}
```

### Updating Configuration

```typescript
public updateGeneratorConfig(
  blockId: string, 
  config: GeneratorConfig
): void {
  const block = this.blocks.getBlock(blockId);
  if (block && block.mesh.userData.isGenerator) {
    block.generatorConfig = config;
    block.mesh.userData.generatorConfig = config;
  }
}
```

### Serialization

Generators are saved with their configuration:

```typescript
{
  type: "block",
  transform: { position, rotation, scale },
  id: "gen-1",
  isGenerator: true,
  generatorConfig: {
    type: "randomStatic",
    enabled: true,
    visible: false,
    count: 30,
    spawnRadius: 10,
    targetScale: 0.4,
    spawnHeight: 1.5,
    completionEvents: [
      { type: "enableGenerator", targetGeneratorId: "gen-2" }
    ]
  }
}
```

## 🎮 Gameplay Integration

### Loading Generators

When a scenario loads, generators are processed:

```typescript
// Find all generators in scenario
const generators = blocks.filter(block => 
  block.mesh.userData.isGenerator === true
);

// Process each generator
for (const generator of generators) {
  const config = generator.generatorConfig;
  
  if (config.enabled) {
    // Spawn targets immediately
    spawnTargetsFromGenerator(generator, config);
  }
  
  // Hide marker if not visible
  if (!config.visible) {
    generator.mesh.visible = false;
  }
}
```

### Completion Events

When all targets from a generator are destroyed:

```typescript
function onGeneratorComplete(generatorId: string) {
  const generator = getGenerator(generatorId);
  const config = generator.generatorConfig;
  
  // Process completion events
  for (const event of config.completionEvents) {
    if (event.type === 'enableGenerator') {
      const targetGen = getGenerator(event.targetGeneratorId);
      if (targetGen) {
        // Enable and spawn targets
        targetGen.generatorConfig.enabled = true;
        spawnTargetsFromGenerator(targetGen, targetGen.generatorConfig);
      }
    }
  }
}
```

## 📊 Default Configuration

```typescript
const DEFAULT_RANDOM_STATIC_CONFIG: GeneratorConfig = {
  type: 'randomStatic',
  enabled: true,
  visible: false,
  count: 30,
  spawnRadius: 10,
  targetScale: 0.4,
  spawnHeight: 1.5,
  completionEvents: []
};
```

## 🐛 Troubleshooting

### Generator not spawning targets

**Cause:** Generator disabled or config not saved

**Solution:**
```typescript
// Check if enabled
if (!generator.generatorConfig.enabled) {
  console.log('Generator is disabled');
}

// Ensure config is in both places
generator.generatorConfig = config;
generator.mesh.userData.generatorConfig = config;
```

### Completion events not firing

**Cause:** Target generator ID doesn't match

**Solution:**
```typescript
// Use exact block ID
completionEvents: [{
  type: 'enableGenerator',
  targetGeneratorId: 'block-123'  // Must match exactly
}]
```

### Targets spawning in wrong location

**Cause:** Generator position not updated

**Solution:**
```typescript
// Get world position
const worldPos = new Vector3();
generator.mesh.getWorldPosition(worldPos);

// Spawn relative to world position
spawnTargetsAround(worldPos, config.spawnRadius);
```

## 📈 Best Practices

### ✅ Do's

1. **Hide generator markers in game**
   ```typescript
   generatorConfig.visible = false;
   ```

2. **Use meaningful IDs for chaining**
   ```typescript
   // Rename generators for clarity
   editor.renameBlock('block-1', 'wave-1-easy');
   editor.renameBlock('block-2', 'wave-2-medium');
   ```

3. **Test event chains**
   ```typescript
   // Verify all target IDs exist
   for (const event of config.completionEvents) {
     const target = editor.getBlock(event.targetGeneratorId);
     if (!target) {
       console.error('Target generator not found:', event.targetGeneratorId);
     }
   }
   ```

### ❌ Don'ts

1. **Don't create circular dependencies**
   ```typescript
   // ❌ Bad - infinite loop
   gen1.completionEvents = [{ targetGeneratorId: 'gen-2' }];
   gen2.completionEvents = [{ targetGeneratorId: 'gen-1' }];
   ```

2. **Don't use huge spawn radius**
   ```typescript
   // ❌ Bad - targets too spread out
   spawnRadius: 50
   
   // ✅ Good - reasonable area
   spawnRadius: 10
   ```

3. **Don't forget to disable chained generators**
   ```typescript
   // ❌ Bad - all spawn at once
   gen1.enabled = true;
   gen2.enabled = true;
   
   // ✅ Good - sequential
   gen1.enabled = true;
   gen2.enabled = false;  // Enabled by gen1 completion
   ```

## 🔗 Related

- [EditorApp](/docs/core-concepts/editor-app) - Creating generators
- [Event System](/docs/editor/events) - Event configuration
- [TargetManager](/docs/systems/target-manager) - Target spawning

## Next Steps

- [Event System](/docs/editor/events) - Configure completion events
- [Components](/docs/editor/components) - Create reusable structures
- [Getting Started](/docs/editor/getting-started) - Editor basics
