---
sidebar_position: 2
title: EditorApp API
---

# EditorApp API Reference

Complete API reference for the EditorApp visual editor class.

## Class: EditorApp

Visual editor for creating aim training scenarios.

### Constructor

```typescript
constructor(canvas: HTMLCanvasElement)
```

### Methods

#### Block Placement

##### `placeBlockAt(clientX: number, clientY: number): EditorBlock | null`

Places a block at cursor position.

```typescript
const block = editor.placeBlockAt(event.clientX, event.clientY);
```

##### `placeSpawnAt(clientX: number, clientY: number): EditorBlock | null`

Places spawn point.

```typescript
const spawn = editor.placeSpawnAt(event.clientX, event.clientY);
```

##### `placeRandomTargetGeneratorAt(clientX: number, clientY: number): EditorBlock | null`

Places target generator.

```typescript
const gen = editor.placeRandomTargetGeneratorAt(event.clientX, event.clientY);
```

#### Selection

##### `pickBlock(clientX: number, clientY: number, additive: boolean): EditorBlock | null`

Selects block at cursor.

```typescript
// Single selection
editor.pickBlock(x, y, false);

// Add to selection
editor.pickBlock(x, y, true);
```

##### `getSelection(): EditorBlock | null`

Gets selected block.

##### `getSelectionArray(): EditorBlock[]`

Gets all selected blocks.

##### `clearSelection(): void`

Clears selection.

#### Transform

##### `applyTransform(id: string, transform: SelectionTransform): boolean`

Applies transform to block.

```typescript
editor.applyTransform('block-1', {
  position: new Vector3(0, 1, 0),
  rotation: new Euler(0, Math.PI/4, 0),
  scale: new Vector3(1, 1, 1)
});
```

##### `updateSelectedBlockPosition(position: Vector3): void`

Updates selected block position.

#### Grouping

##### `groupSelection(): EditorBlock | null`

Groups selected blocks.

##### `ungroupSelected(): EditorBlock[] | null`

Ungroups selected group.

#### Components

##### `createComponentFromSelectedGroup(label: string, id: string): string | null`

Creates component from group.

```typescript
const compId = editor.createComponentFromSelectedGroup('Platform', 'comp-1');
```

##### `placeComponentAt(clientX: number, clientY: number, component: SavedComponent): EditorBlock | null`

Places component instance.

##### `startEditingComponent(id: string): boolean`

Enters component edit mode.

##### `finishEditingComponent(id: string): boolean`

Exits component edit mode.

#### Scenario

##### `exportScenario(name: string): SerializedScenario`

Exports scenario.

```typescript
const scenario = editor.exportScenario('My Scenario');
```

##### `importScenario(scenario: SerializedScenario): void`

Imports scenario.

##### `resetScene(): void`

Clears scene.

#### Generator Config

##### `updateGeneratorConfig(blockId: string, config: GeneratorConfig): void`

Updates generator configuration.

```typescript
editor.updateGeneratorConfig('gen-1', {
  type: 'randomStatic',
  enabled: true,
  count: 30,
  spawnRadius: 10,
  targetScale: 0.4,
  spawnHeight: 1.5,
  completionEvents: []
});
```

## Type Definitions

### EditorBlock

```typescript
type EditorBlock = {
  id: string;
  mesh: Object3D;
  generatorConfig?: GeneratorConfig;
};
```

### SelectionTransform

```typescript
type SelectionTransform = {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
};
```

### SerializedScenario

```typescript
type SerializedScenario = {
  version: 1;
  name: string;
  createdAt: string;
  blocks: SerializedNode[];
  componentDefinitions: SavedComponent[];
};
```

## See Also

- [EditorApp Guide](/docs/core-concepts/editor-app)
- [Getting Started](/docs/editor/getting-started)
- [Components](/docs/editor/components)
