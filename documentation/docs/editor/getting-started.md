---
sidebar_position: 1
title: Getting Started
---

# Getting Started with the Editor

Learn how to use the Redblock visual editor to create custom aim training scenarios.

## 🚀 Quick Start

### Opening the Editor

```bash
# Start the development server
npm run dev

# Navigate to the editor
http://localhost:3001/editor
```

### Basic Controls

| Action | Control |
|--------|---------|
| **Place Block** | Left Click on ground |
| **Select Block** | Left Click on block |
| **Multi-Select** | Shift + Left Click |
| **Move Camera** | Right Click + Drag |
| **Pan Camera** | Middle Click + Drag |
| **Zoom** | Mouse Wheel |
| **Delete** | Delete key |

## 📦 Placing Blocks

### Single Block

Click the "Place Block" button, then click on the ground:

```typescript
// Programmatically
const block = editor.placeBlockAt(clientX, clientY);
```

### Spawn Point

Every scenario needs exactly one spawn point:

```typescript
const spawn = editor.placeSpawnAt(clientX, clientY);
```

### Target Generator

Place generators to spawn targets during gameplay:

```typescript
const generator = editor.placeRandomTargetGeneratorAt(clientX, clientY);
```

## 🎯 Selection

### Single Selection

Click on any block to select it. Selected blocks show a colored outline.

### Multi-Selection

Hold **Shift** and click to add blocks to selection:

```typescript
// Select multiple blocks
editor.pickBlock(x1, y1, false);  // First block
editor.pickBlock(x2, y2, true);   // Add to selection (shift)
editor.pickBlock(x3, y3, true);   // Add another
```

### Box Selection

Click and drag to create a selection rectangle:

1. Click on empty ground
2. Hold and drag
3. Release to select all blocks in rectangle

### Clear Selection

Press **Escape** or click on empty ground.

## 🔧 Transform Tools

### Move (G)

1. Select block(s)
2. Press **G** to grab
3. Move mouse to position
4. Click to confirm or **Escape** to cancel

**Axis Constraints:**
- Press **X** - Move only on X axis
- Press **Y** - Move only on Y axis  
- Press **Z** - Move only on Z axis

### Rotate (R)

1. Select block(s)
2. Press **R** to rotate
3. Move mouse to rotate
4. Click to confirm

### Scale (S)

1. Select block(s)
2. Press **S** to scale
3. Move mouse to scale
4. Click to confirm

## 📐 Properties Panel

The properties panel shows transform values for selected blocks:

```typescript
// Position
X: 0.00
Y: 0.50
Z: 0.00

// Rotation (degrees)
X: 0.00
Y: 0.00
Z: 0.00

// Scale
X: 1.00
Y: 1.00
Z: 1.00
```

You can manually type values for precise positioning.

## 👥 Grouping

### Create Group

1. Select multiple blocks
2. Press **Ctrl+G** or click "Group" button

Groups allow you to move multiple blocks together.

### Ungroup

1. Select a group
2. Press **Ctrl+Shift+G** or click "Ungroup" button

## 🎨 Components

### Creating Components

Components are reusable prefabs:

1. Create and group blocks
2. Click "Create Component"
3. Name your component
4. Place instances from component panel

### Editing Components

1. Select any component instance
2. Click "Edit Component"
3. Modify the structure
4. Click "Finish Editing"
5. All instances update automatically!

## 🎯 Target Generators

### Placing Generators

1. Click "Place Generator" button
2. Click on ground to place
3. Configure in properties panel:
   - **Count**: Number of targets
   - **Radius**: Spawn area size
   - **Scale**: Target size
   - **Height**: Spawn height

### Configuring Events

Chain generators together:

1. Select generator
2. Open "Events" tab
3. Add completion event
4. Select target generator to enable

Example: Tutorial → Practice → Challenge

## 💾 Saving & Loading

### Save Scenario

```typescript
// Menu → Save As
// Enter scenario name
// Scenario saved to localStorage
```

### Load Scenario

```typescript
// Menu → Load
// Select scenario from list
// Click to load
```

### Export Scenario

```typescript
// Menu → Export
// Downloads .rbonline file
// Share with others!
```

### Import Scenario

```typescript
// Menu → Import
// Select .rbonline file
// Scenario added to list
```

## ⌨️ Keyboard Shortcuts

### Navigation

| Key | Action |
|-----|--------|
| **W/A/S/D** | Move camera |
| **Q/E** | Move up/down |
| **Shift** | Move faster |

### Selection

| Key | Action |
|-----|--------|
| **Shift + Click** | Add to selection |
| **Ctrl + A** | Select all |
| **Escape** | Clear selection |

### Transform

| Key | Action |
|-----|--------|
| **G** | Grab/Move |
| **R** | Rotate |
| **S** | Scale |
| **X/Y/Z** | Constrain to axis |

### Edit

| Key | Action |
|-----|--------|
| **Delete** | Delete selected |
| **Ctrl + D** | Duplicate |
| **Ctrl + G** | Group |
| **Ctrl + Shift + G** | Ungroup |
| **Ctrl + Z** | Undo |
| **Ctrl + Shift + Z** | Redo |

## 🎮 Testing Your Scenario

### Preview Mode

1. Click "Test" button
2. Game starts with your scenario
3. Press **Escape** to return to editor

### What to Test

- ✅ Spawn point has floor beneath it
- ✅ Generators spawn targets correctly
- ✅ Event chains work as expected
- ✅ No floating blocks
- ✅ Playable area is accessible

## 📝 Best Practices

### ✅ Do's

1. **Always add a spawn point**
   ```typescript
   // Required for gameplay
   editor.placeSpawnAt(x, y);
   ```

2. **Test frequently**
   ```typescript
   // Test after major changes
   // Verify everything works
   ```

3. **Use components for repeated structures**
   ```typescript
   // Create once, place many times
   // Easier to update later
   ```

4. **Name your blocks**
   ```typescript
   // Use descriptive names
   editor.renameBlock('block-1', 'main-platform');
   ```

5. **Save often**
   ```typescript
   // Auto-save happens, but manual save is safer
   ```

### ❌ Don'ts

1. **Don't forget spawn point**
   ```typescript
   // ❌ Scenario won't work without it
   ```

2. **Don't create floating spawn points**
   ```typescript
   // ❌ Players will fall through
   // ✅ Always place floor beneath spawn
   ```

3. **Don't overlap blocks unnecessarily**
   ```typescript
   // ❌ Can cause physics issues
   // ✅ Use snapping or precise values
   ```

4. **Don't create too many generators**
   ```typescript
   // ❌ Performance issues
   // ✅ Use event chaining instead
   ```

## 🐛 Common Issues

### Blocks not appearing

**Solution:** Check camera position and zoom level.

### Can't select blocks

**Solution:** Ensure you're not in typing mode (click outside input fields).

### Spawn point warning

**Solution:** Add a floor block beneath the spawn point.

### Generator not spawning

**Solution:** Check generator is enabled and has valid configuration.

## 🔗 Next Steps

- [Generators](/docs/editor/generators) - Configure target spawning
- [Components](/docs/editor/components) - Create reusable prefabs
- [Events](/docs/editor/events) - Chain generators together
- [EditorApp API](/docs/core-concepts/editor-app) - Advanced usage

## 📖 Tutorial: Your First Scenario

### Step 1: Create Floor

1. Click "Place Block"
2. Click on ground
3. Scale to 10x1x10 (large floor)

### Step 2: Add Spawn Point

1. Click "Place Spawn"
2. Click on floor
3. Verify it's above the floor

### Step 3: Add Generator

1. Click "Place Generator"
2. Click on floor
3. Configure:
   - Count: 20
   - Radius: 8
   - Scale: 0.4

### Step 4: Test

1. Click "Test" button
2. Verify targets spawn
3. Try shooting them!

### Step 5: Save

1. Menu → Save As
2. Name: "My First Scenario"
3. Done!

**Congratulations!** You've created your first scenario. 🎉
