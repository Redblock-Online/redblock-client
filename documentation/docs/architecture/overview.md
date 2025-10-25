---
sidebar_position: 1
---

# Architecture Overview

Redblock follows a modular architecture with clear separation of concerns. This document provides a high-level overview of the system architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React UI Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Game UI    │  │  Editor UI   │  │  Settings    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Core Application                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     App      │  │  EditorApp   │  │   WSManager  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                        Systems Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Physics    │  │    Audio     │  │   Targets    │      │
│  │   System     │  │   Manager    │  │   Manager    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Rendering Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Scene      │  │   Camera     │  │   Controls   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### App (`/src/core/App.ts`)

The main application class that orchestrates all systems:

- **Responsibilities**:
  - Initialize and manage all subsystems
  - Handle game loop and rendering
  - Manage game state and lifecycle
  - Coordinate between systems

- **Key Systems**:
  - Physics System (Rapier)
  - Audio Manager
  - Target Manager
  - WebSocket Manager
  - Controls System

### EditorApp (`/src/editor/EditorApp.ts`)

The visual editor for creating scenarios:

- **Responsibilities**:
  - Manage editor state and tools
  - Handle block placement and manipulation
  - Serialize/deserialize scenarios
  - Component system management

- **Features**:
  - Drag-and-drop interface
  - Real-time preview
  - Undo/redo system
  - Component library

## System Layers

### 1. UI Layer

React-based user interface:

- **Game UI**: HUD, timer, crosshair, stats
- **Editor UI**: Tools, properties panel, scenario manager
- **Settings**: Audio, graphics, controls configuration

### 2. Core Layer

Main application logic:

- **App**: Game mode controller
- **EditorApp**: Editor mode controller
- **WSManager**: Multiplayer networking

### 3. Systems Layer

Specialized subsystems:

- **PhysicsSystem**: Collision detection, character controller
- **AudioManager**: Multi-channel audio, spatial sound
- **TargetManager**: Object pooling, target lifecycle

### 4. Rendering Layer

Three.js rendering pipeline:

- **Scene**: 3D scene management
- **Camera**: First-person camera
- **Controls**: Mouse/keyboard input

## Data Flow

### Game Mode

```
User Input → Controls → App → Physics System → Target Manager → Renderer
                ↓
          Audio Manager
```

### Editor Mode

```
User Input → Editor UI → EditorApp → Block System → Renderer
                ↓
          Scenario Store
```

## Module Organization

```
src/
├── core/           # Core application classes
├── systems/        # Specialized systems
├── objects/        # 3D objects (Target, Pistol, etc.)
├── editor/         # Editor-specific code
├── ui/             # React UI components
├── utils/          # Utility functions
└── config/         # Configuration files
```

## Key Design Patterns

### 1. **Singleton Pattern**
- `App` and `EditorApp` are singletons
- Ensures single source of truth

### 2. **Object Pooling**
- `TargetManager` pools Target objects
- Reduces garbage collection overhead

### 3. **Observer Pattern**
- Event system for generator completion
- UI updates via React state

### 4. **Strategy Pattern**
- Different generator types (RandomStatic, Moving)
- Pluggable audio channels

### 5. **Command Pattern**
- Editor undo/redo system
- Serializable actions

## Performance Considerations

### Optimization Techniques

1. **Object Pooling**: Reuse targets instead of creating/destroying
2. **Spatial Partitioning**: Grid-based collision detection
3. **Frustum Culling**: Only render visible objects
4. **Audio Pooling**: Reuse audio sources
5. **Lazy Loading**: Load assets on demand

### Memory Management

- Dispose Three.js geometries and materials
- Clean up event listeners
- Pool frequently created objects
- Use WeakMap for object metadata

## Next Steps

- [Core Concepts](/docs/core-concepts/app) - Deep dive into core classes
- [Systems](/docs/systems/physics) - Learn about individual systems
- [Editor](/docs/editor/getting-started) - Editor architecture
