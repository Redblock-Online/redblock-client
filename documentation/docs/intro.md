---
sidebar_position: 1
---

# Welcome to Redblock

**Redblock** is a modern 3D FPS aim trainer built with **Three.js**, **React**, and **TypeScript**. It features a powerful visual editor, advanced physics simulation, and a comprehensive audio system.

## 🎯 Key Features

- **Visual Editor**: Drag-and-drop scenario builder with real-time preview
- **Target Generators**: Create dynamic target spawning systems with events
- **Physics Engine**: Rapier-based physics with collision detection
- **Audio System**: Multi-channel audio with spatial sound and music management
- **Performance Optimized**: Object pooling, spatial partitioning, and efficient rendering
- **Multiplayer Ready**: WebSocket-based multiplayer support

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) version 18.0 or above
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/redblock/redblock-client.git

# Navigate to the project directory
cd redblock-client

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:3001`.

## 📚 Documentation Structure

This documentation is organized into several sections:

- **Getting Started**: Installation, configuration, and basic usage
- **Core Systems**: Deep dive into the main systems (Physics, Audio, Rendering)
- **Editor**: How to use the visual editor and create scenarios
- **API Reference**: Detailed API documentation for all classes and functions
- **Performance**: Optimization techniques and best practices

## 🎮 What You'll Build

With Redblock, you can create:

- **Custom Training Scenarios**: Design your own aim training exercises
- **Target Generators**: Spawn targets with custom patterns and behaviors
- **Event Systems**: Chain generators together with completion events
- **Multiplayer Sessions**: Practice with friends in real-time

## 🛠️ Tech Stack

- **Frontend**: React 18, Next.js 15, TypeScript
- **3D Engine**: Three.js r178
- **Physics**: Rapier Physics Engine
- **Audio**: Custom multi-channel audio manager with Web Audio API
- **State Management**: React hooks and context
- **Styling**: Tailwind CSS

## 📖 Next Steps

- [Architecture Overview](/docs/architecture/overview) - Understand the project structure
- [Core Concepts](/docs/core-concepts/app) - Learn about the main systems
- [Editor Guide](/docs/editor/getting-started) - Start creating scenarios
- [API Reference](/docs/api/app) - Explore the API documentation
