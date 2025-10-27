# Custom Maps System

## Overview

The Custom Maps system allows loading pre-designed scenarios from `.rbonline` files instead of procedurally generated targets. Maps can include blocks, target generators, spawn points, and custom components.

## Quick Start

### 1. Create a Map in the Editor

1. Open the Editor tab
2. Build your map with blocks and target generators
3. Add a spawn point (where player starts)
4. Configure target generators with events
5. Save the scenario (File → Save Scenario)

### 2. Use the Map in Game

Add the map to a scenario in `src/config/scenarios.ts`:

```typescript
export const SCENARIOS: ScenarioConfig[] = [
  { 
    id: "scenario-1", 
    label: "Quick Warmup", 
    targetCount: 3, 
    mapFile: "/scenario/first-map.rbonline" 
  },
  // ... other scenarios
];
```

### 3. Play

Click "Quick Warmup" in the game menu to load your custom map!

## Architecture

### File Format

Maps are saved as `.rbonline` JSON files in `/public/scenario/`:

```json
{
  "version": 1,
  "name": "First Scenario/Map/World",
  "createdAt": "2025-10-27T20:07:36.286Z",
  "blocks": [
    {
      "type": "block",
      "id": "block-1",
      "transform": {
        "position": { "x": 0, "y": 0, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 }
      }
    },
    {
      "type": "block",
      "id": "block-9",
      "isGenerator": true,
      "generatorConfig": { /* ... */ }
    }
  ],
  "componentDefinitions": []
}
```

### Loading Pipeline

```
User clicks scenario
    ↓
App.startScenarioById()
    ↓
Detects mapFile property
    ↓
App.loadCustomMap(mapFile)
    ↓
fetch() JSON file
    ↓
processScenarioForGame(app, scenarioData)
    ↓
processBlockRecursively() for each block
    ↓
Game ready with custom map
```

## Implementation

### Scenario Configuration

**File**: `src/config/scenarios.ts`

```typescript
export type ScenarioConfig = {
  id: string;
  label: string;
  targetCount: number;
  targetScale?: number;
  mapFile?: string; // Path to .rbonline file
};

export const SCENARIOS: ScenarioConfig[] = [
  { 
    id: "scenario-1", 
    label: "Quick Warmup", 
    targetCount: 3, 
    mapFile: "/scenario/first-map.rbonline" 
  },
  { 
    id: "scenario-2", 
    label: "Precision", 
    targetCount: 8, 
    targetScale: 0.2 
  },
];
```

### Map Loading

**File**: `src/core/App.ts`

```typescript
private async loadCustomMap(mapPath: string): Promise<void> {
  try {
    // Fetch the map file
    const response = await fetch(mapPath);
    if (!response.ok) {
      throw new Error(`Failed to load map: ${response.statusText}`);
    }
    
    const scenarioData = await response.json();
    console.log(`[App] Loaded scenario:`, scenarioData.name);
    
    // Import bootstrap function
    const { processScenarioForGame } = await import("@/editor/utils/gameBootstrap");
    
    // Process and load the scenario
    await processScenarioForGame(this, scenarioData);
    
    // Update controls reference
    this.controls.updateTargets(this.targets);
    
    console.log(`[App] Custom map loaded with ${this.targets.length} targets`);
  } catch (error) {
    console.error(`[App] Failed to load custom map:`, error);
    // Fallback to procedural generation
    const useHalfSize = this.currentScenarioTargetScale === 0.2;
    this.scene.loadScenario(this.currentScenarioTargetCount, useHalfSize, (Math.PI / 2) * 3);
    this.targets = this.scene.targets;
    this.controls.updateTargets(this.targets);
  }
}
```

### Scenario Processing

**File**: `src/editor/utils/gameBootstrap.ts`

```typescript
export async function processScenarioForGame(app: App, scenario: SerializedScenario): Promise<void> {
  // Create group for scenario objects
  const customGroup = new THREE.Group();
  customGroup.name = "CustomScenario";
  app.scene.add(customGroup);
  
  // Find spawn point
  let spawnBlock: SerializedNode | null = null;
  for (const block of scenario.blocks) {
    if (block.isSpawnPoint) {
      spawnBlock = block;
      break;
    }
  }
  
  // Calculate room bounds
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  scenario.blocks.forEach((block: SerializedNode) => {
    if (!block.isSpawnPoint) {
      const x = block.transform.position.x;
      const z = block.transform.position.z;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  });
  
  // Set room constraints
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const sizeX = maxX - minX + 40; // Generous padding
  const sizeZ = maxZ - minZ + 40;
  const roomSize = Math.max(sizeX, sizeZ, 100); // Min 100 units
  
  app.controls.initPlayerRoom(centerX, centerZ, roomSize);
  
  // Process all blocks
  scenario.blocks.forEach((block: SerializedNode) => {
    processBlockRecursively(block, customGroup, app, true, scenario.componentDefinitions);
  });
  
  // Store reference for raycasting
  (app as typeof app & { editorCubesGroup?: THREE.Group }).editorCubesGroup = customGroup;
  
  // Wait for collision system
  await app.collisionSystem.waitForInit();
  
  // Sync targets
  app.scene.targets = app.targets;
  
  // Teleport to spawn point
  if (spawnBlock) {
    const spawnX = spawnBlock.transform.position.x;
    const spawnZ = spawnBlock.transform.position.z;
    const spawnBlockTop = spawnBlock.transform.position.y + (spawnBlock.transform.scale.y / 2);
    const spawnY = spawnBlockTop + 1.6;
    const spawnYaw = spawnBlock.transform.rotation.y;
    
    app.controls.teleportTo(spawnX, spawnY, spawnZ, spawnYaw);
  }
}
```

## Key Features

### 1. Room Constraints

The system automatically calculates movement boundaries based on map size:

- **Padding**: 40 units around all objects
- **Minimum size**: 100 units (for small maps)
- **Dynamic**: Adjusts to map content

### 2. Raycast Detection

Custom maps require special handling for shooting:

```typescript
// Store reference for raycast system
(app as typeof app & { editorCubesGroup?: THREE.Group }).editorCubesGroup = customGroup;
```

This allows `App.ts` to find and shoot targets in custom maps.

### 3. Collision System

All blocks and targets are added to the collision system:

```typescript
// Add to collision system
target.updateWorldMatrix(true, true);
const boundingBox = new THREE.Box3().setFromObject(target);
const collider = {
  min: boundingBox.min.clone(),
  max: boundingBox.max.clone(),
  object: target
};

app.collisionSystem.waitForInit().then(() => {
  app.collisionSystem.addCollider(collider);
});
```

### 4. Target Management

Targets are properly tracked in multiple arrays:

```typescript
// Add to app.targets (main game array)
app.targets.push(target);

// Add to scene.targets (legacy compatibility)
app.scene.targets = app.targets;

// Add to generator metadata
generatorTargets.push(target);
```

## Map Elements

### Blocks

Regular cubes that form the environment:

```json
{
  "type": "block",
  "id": "block-1",
  "transform": {
    "position": { "x": 0, "y": 0, "z": 0 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 5, "y": 0.5, "z": 5 }
  }
}
```

### Target Generators

Spawn targets dynamically (see TARGET_GENERATORS.md):

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
      "minX": -5, "maxX": 5,
      "minY": 0, "maxY": 3,
      "minZ": -5, "maxZ": 5
    }
  }
}
```

### Spawn Points

Where the player starts:

```json
{
  "type": "block",
  "id": "spawn-1",
  "isSpawnPoint": true,
  "transform": {
    "position": { "x": 0, "y": 1, "z": 10 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 0.1, "z": 1 }
  }
}
```

### Groups

Nested collections of objects:

```json
{
  "type": "group",
  "id": "group-1",
  "transform": { /* ... */ },
  "children": [
    { "type": "block", /* ... */ },
    { "type": "block", /* ... */ }
  ]
}
```

### Components

Custom reusable objects (future):

```json
{
  "type": "component",
  "componentId": "custom-obstacle-1",
  "transform": { /* ... */ }
}
```

## Best Practices

### Map Design

1. **Add a spawn point** - Always include exactly one spawn point
2. **Test in Play mode** - Use editor's Play mode before saving
3. **Use generators** - Prefer generators over manual target placement
4. **Reasonable bounds** - Keep maps under 200x200 units for performance

### File Organization

```
/public/scenario/
  ├── first-map.rbonline       # Tutorial map
  ├── precision-course.rbonline # Advanced map
  └── warmup.rbonline           # Quick practice
```

### Performance

1. **Limit targets** - Max 50-100 targets total
2. **Optimize geometry** - Use simple blocks
3. **Test loading time** - Should load in <1 second

## Troubleshooting

### Map Won't Load

**Symptoms**: Error in console, falls back to procedural generation

**Solutions**:
- Check file path is correct (`/scenario/filename.rbonline`)
- Verify JSON is valid (use JSON validator)
- Check console for specific error message

### Can't Shoot Targets

**Symptoms**: Crosshair doesn't detect targets

**Solutions**:
- Verify `editorCubesGroup` is set (check logs)
- Ensure targets have `userData.isTarget = true`
- Check targets are in scene hierarchy

### Player Can't Move

**Symptoms**: Movement is restricted to small area

**Solutions**:
- Check room size calculation (should be >100)
- Verify spawn point is within bounds
- Increase padding in `processScenarioForGame`

### Targets Don't Destroy

**Symptoms**: Targets don't disappear when shot

**Solutions**:
- Verify `app.targets` array is populated
- Check `scene.targets` is synced
- Ensure targets have proper collision setup

## Example Maps

### Simple Warmup

```json
{
  "version": 1,
  "name": "Simple Warmup",
  "blocks": [
    {
      "type": "block",
      "id": "floor",
      "transform": {
        "position": { "x": 0, "y": -0.5, "z": 0 },
        "scale": { "x": 20, "y": 0.5, "z": 20 }
      }
    },
    {
      "type": "block",
      "id": "spawn",
      "isSpawnPoint": true,
      "transform": {
        "position": { "x": 0, "y": 0.5, "z": 10 },
        "scale": { "x": 1, "y": 0.1, "z": 1 }
      }
    },
    {
      "type": "block",
      "id": "gen1",
      "isGenerator": true,
      "generatorConfig": {
        "type": "randomStatic",
        "targetCount": 5,
        "targetScale": 0.4,
        "enabled": true,
        "visible": true,
        "spawnBounds": {
          "minX": -3, "maxX": 3,
          "minY": 0, "maxY": 2,
          "minZ": -3, "maxZ": 3
        }
      },
      "transform": {
        "position": { "x": 0, "y": 1, "z": 0 }
      }
    }
  ]
}
```

## Future Enhancements

- [ ] Map validation on load
- [ ] Map preview thumbnails
- [ ] Map metadata (author, difficulty, etc.)
- [ ] Workshop/sharing system
- [ ] Procedural map generation
- [ ] Map editor improvements
