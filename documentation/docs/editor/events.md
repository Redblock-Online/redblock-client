---
sidebar_position: 3
title: Event System
---

# Event System

The event system allows generators to trigger actions when completed, enabling complex training scenarios with sequential waves and progressive difficulty.

## ✨ Features

- ✅ **Completion Events** - Trigger actions when generator completes
- ✅ **Generator Chaining** - Enable other generators sequentially
- ✅ **Event Configuration** - Visual UI for event setup
- ✅ **Multiple Events** - One generator can trigger multiple actions
- ✅ **Validation** - Checks for circular dependencies

## 📚 Event Types

### Enable Generator Event

Enables another generator when the current one completes all targets.

```typescript
type CompletionEvent = {
  type: 'enableGenerator';
  targetGeneratorId: string;
};
```

## 🎯 Usage Examples

### Simple Chain

```typescript
// Wave 1 → Wave 2
const wave1 = {
  enabled: true,
  count: 20,
  completionEvents: [{
    type: 'enableGenerator',
    targetGeneratorId: 'wave-2'
  }]
};

const wave2 = {
  enabled: false,  // Starts disabled
  count: 30,
  completionEvents: []
};
```

### Multi-Stage Scenario

```typescript
// Tutorial → Practice → Challenge
const tutorial = {
  enabled: true,
  count: 10,
  targetScale: 0.5,  // Large targets
  completionEvents: [{
    type: 'enableGenerator',
    targetGeneratorId: 'practice'
  }]
};

const practice = {
  enabled: false,
  count: 25,
  targetScale: 0.4,  // Normal targets
  completionEvents: [{
    type: 'enableGenerator',
    targetGeneratorId: 'challenge'
  }]
};

const challenge = {
  enabled: false,
  count: 50,
  targetScale: 0.2,  // Small targets
  completionEvents: []
};
```

### Branching Paths

```typescript
// Main wave triggers two parallel waves
const mainWave = {
  enabled: true,
  count: 30,
  completionEvents: [
    { type: 'enableGenerator', targetGeneratorId: 'left-wave' },
    { type: 'enableGenerator', targetGeneratorId: 'right-wave' }
  ]
};

const leftWave = {
  enabled: false,
  count: 20,
  spawnRadius: 8,
  completionEvents: []
};

const rightWave = {
  enabled: false,
  count: 20,
  spawnRadius: 8,
  completionEvents: []
};
```

## 🔧 Configuration UI

### Event Config Panel

The EventConfigPanel component provides a visual interface for configuring events:

```typescript
<EventConfigPanel
  generatorId={selectedBlock.id}
  config={selectedBlock.generatorConfig}
  onConfigChange={(newConfig) => {
    editor.updateGeneratorConfig(selectedBlock.id, newConfig);
  }}
  availableGenerators={allGenerators}
/>
```

### Adding Events

```typescript
// Add completion event
const newEvent: CompletionEvent = {
  type: 'enableGenerator',
  targetGeneratorId: 'target-gen-id'
};

config.completionEvents.push(newEvent);
editor.updateGeneratorConfig(generatorId, config);
```

### Removing Events

```typescript
// Remove event by index
config.completionEvents.splice(index, 1);
editor.updateGeneratorConfig(generatorId, config);
```

## 🎮 Runtime Behavior

### Event Processing

When all targets from a generator are destroyed:

```typescript
function onAllTargetsDestroyed(generatorId: string) {
  const generator = getGenerator(generatorId);
  const config = generator.generatorConfig;
  
  // Mark generator as completed
  markGeneratorComplete(generatorId);
  
  // Process all completion events
  for (const event of config.completionEvents) {
    processEvent(event);
  }
}

function processEvent(event: CompletionEvent) {
  if (event.type === 'enableGenerator') {
    const targetGen = getGenerator(event.targetGeneratorId);
    
    if (targetGen) {
      // Enable the target generator
      targetGen.generatorConfig.enabled = true;
      
      // Spawn its targets
      spawnTargetsFromGenerator(targetGen, targetGen.generatorConfig);
      
      console.log(`Enabled generator: ${event.targetGeneratorId}`);
    }
  }
}
```

### Tracking Completion

```typescript
class GeneratorTracker {
  private completedGenerators = new Set<string>();
  
  onTargetDestroyed(target: Target) {
    const generatorId = target.generatorId;
    const remainingTargets = this.getRemainingTargets(generatorId);
    
    if (remainingTargets === 0 && !this.completedGenerators.has(generatorId)) {
      this.completedGenerators.add(generatorId);
      this.triggerCompletionEvents(generatorId);
    }
  }
  
  private triggerCompletionEvents(generatorId: string) {
    const generator = this.getGenerator(generatorId);
    const events = generator.generatorConfig.completionEvents;
    
    for (const event of events) {
      this.processEvent(event);
    }
  }
}
```

## 🐛 Troubleshooting

### Events not triggering

**Cause:** Generator not marked as complete

**Solution:**
```typescript
// Ensure all targets are tracked
function onTargetDestroyed(target: Target) {
  const generatorId = target.userData.generatorId;
  const remaining = countRemainingTargets(generatorId);
  
  if (remaining === 0) {
    triggerCompletionEvents(generatorId);
  }
}
```

### Wrong generator enabled

**Cause:** Incorrect target generator ID

**Solution:**
```typescript
// Verify ID matches exactly
const targetGen = editor.getBlock(event.targetGeneratorId);
if (!targetGen) {
  console.error('Generator not found:', event.targetGeneratorId);
}
```

### Circular dependency

**Cause:** Generators enabling each other

**Solution:**
```typescript
// Validate event chain
function validateEventChain(generatorId: string, visited = new Set()): boolean {
  if (visited.has(generatorId)) {
    console.error('Circular dependency detected!');
    return false;
  }
  
  visited.add(generatorId);
  const generator = getGenerator(generatorId);
  
  for (const event of generator.generatorConfig.completionEvents) {
    if (event.type === 'enableGenerator') {
      if (!validateEventChain(event.targetGeneratorId, visited)) {
        return false;
      }
    }
  }
  
  return true;
}
```

## 📈 Best Practices

### ✅ Do's

1. **Validate event chains**
   ```typescript
   // Check for circular dependencies
   validateEventChain(generatorId);
   ```

2. **Use descriptive generator names**
   ```typescript
   editor.renameBlock('block-1', 'tutorial-wave');
   editor.renameBlock('block-2', 'practice-wave');
   ```

3. **Test event sequences**
   ```typescript
   // Play through entire scenario
   // Verify all waves trigger correctly
   ```

### ❌ Don'ts

1. **Don't create loops**
   ```typescript
   // ❌ Bad
   gen1.completionEvents = [{ targetGeneratorId: 'gen-2' }];
   gen2.completionEvents = [{ targetGeneratorId: 'gen-1' }];
   ```

2. **Don't reference non-existent generators**
   ```typescript
   // ❌ Bad
   completionEvents: [{ targetGeneratorId: 'does-not-exist' }]
   
   // ✅ Good - verify first
   if (editor.getBlock(targetId)) {
     completionEvents.push({ targetGeneratorId: targetId });
   }
   ```

## 🔗 Related

- [Generators](/docs/editor/generators) - Target generator configuration
- [EditorApp](/docs/core-concepts/editor-app) - Editor API
- [App](/docs/core-concepts/app) - Runtime event processing

## Next Steps

- [Components](/docs/editor/components) - Create reusable structures
- [Getting Started](/docs/editor/getting-started) - Editor basics
