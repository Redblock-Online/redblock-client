# Redblock Online 
## Aim trainer for shooters, (in ThreeJS + Next.js)

<h3 align="center">🎮 Game Preview</h3>

<p align="center">
  <img src="preview.gif" alt="Preview" width="800">
</p>

## How to install

```bash
npm install
```

## How to run

```bash
npm run dev
```

## How to build

```bash
npm run build
```

---

## 🎮 Gameplay & Controls

| Action              | Key/Mouse             |
| ------------------- | --------------------- |
| Move Forward / Back | `W` / `S`             |
| Strafe Left / Right | `A` / `D`             |
| Shoot               | `Left Click`          |
| Crouch              | `C` (hold)            |
| Jump                | `Space`               |
| Lock Pointer        | `Click` inside canvas |
| Start Round         | `Space`               |

Use the **sensitivity slider** in the start screen to fine-tune mouse sensitivity. The value is stored in `localStorage` so your preference persists across sessions.

## ✨ Features

- Three target presets (3, 8, 50) for quick warm-ups.
- Procedurally generated colored cubes that become shootable one at a time.
- Animated target absorption effect when hit.
- Die-cut cell-shaded pistol model that follows camera rotation.
- FPS-style WASD movement with adjustable sensitivity and inertia.
- Built-in timer that stops automatically when the last target disappears.
- Post-processing pipeline (`EffectComposer`, FXAA pass) ready for expansion.
- Fully written in **TypeScript** + **Three.js** and powered by **Next.js**.

## 🗂️ Project Structure

```text
three-shooter/
├── app/                  # Next.js App Router routes (game & editor)
├── public/               # Static assets (models, textures, icons…)
├── src/
│   ├── core/             # Engine wrappers (Camera, Renderer, Loop, App)
│   ├── next/             # Client bootstrappers for Next.js routes
│   ├── objects/          # 3D objects & generators (Cube, Pistol …)
│   ├── scenes/           # Three.js scenes (MainScene)
│   ├── systems/          # Behaviour modules (ControlsWithMovement)
│   └── ui/               # DOM-based UI overlays (StartScreen)
├── package.json          # NPM scripts & deps
└── tsconfig.json         # TypeScript configuration
```

## 🛠️ Tech Stack

- **Three.js** – WebGL abstraction layer for 3D rendering.
- **TypeScript** – Static typing for safer code.
- **Next.js** – Hybrid React framework for routing and bundling.
- **Post-processing Addons** – `EffectComposer`, `RenderPass`, `FXAAShader`.

## 🔧 Configuration

| Option            | Location                              | Description                                                     |
| ----------------- | ------------------------------------- | --------------------------------------------------------------- |
| Mouse sensitivity | `localStorage` key `mouseSensitivity` | Set via slider on start screen. Multiplies base rotation speed. |
| Renderer quality  | `src/core/Renderer.ts`                | Change antialias, pixel ratio, post FX.                         |
| Target counts     | `src/scenes/MainScene.ts`             | `level1/2/3()` generate different numbers of cubes.             |

## 📜 Available NPM Scripts

| Script            | Purpose                               |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Local dev server on `localhost:3000`. |
| `npm run build`   | Create an optimized production build. |
| `npm start`       | Run the production build locally.     |

## 📦 Assets

- `public/models/pistol.glb` – Low-poly pistol model.
- `preview.gif` – Gameplay preview used in this README.
- `controls.png` – Legend for keyboard controls shown in HUD.

## 🚀 Deployment

The production build is a standard Next.js application and can be deployed to any platform that supports Node.js (Vercel, Netlify, Render, etc.). Use `npm run build` followed by `npm start` (or your platform's deployment command).

