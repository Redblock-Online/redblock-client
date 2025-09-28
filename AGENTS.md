**Redblock Client — Agents Guide**

This document helps contributors and AI agents work effectively in this repo. It reflects current tooling and conventions used by the Three.js + Next.js + React TypeScript client.

**Project Overview**
- **Stack:** Next.js (App Router), TypeScript (strict), Three.js, React UI.
- **Entrypoints:** `app/page.tsx` (game), `app/editor/page.tsx` (editor), bootstrappers in `src/next/`.
- **Aliases:** `@/*` → `src/*` (see `tsconfig.json:paths`).
- **Scripts:** `npm run dev`, `npm run build`, `npm start` (see `package.json`).

**Run Commands**
- **Install:** `npm install`
- **Dev server:** `npm run dev` (serves on `localhost:3000` by default)
- **Build:** `npm run build` (Next.js production build)
- **Preview build:** `npm start`

**Dev Environment**
- **Node:** Use a recent LTS (≥ 23). Prefer `nvm` to match local dev.
- **Editor:** Enable TypeScript strict checks. Respect path alias `@/*`.
- **Next.js:** App Router + React 19 client components. Use client-only modules for DOM APIs.
- **Env vars:** `NEXT_PUBLIC_WS_SERVER` overrides the default WebSocket URL in `src/utils/ws/WSManager.ts`.

**Codebase Map**
- `src/core/` — engine wrappers (`Camera`, `Renderer`, `Loop`, `App`).
- `src/scenes/` — Three.js scenes (game world and neighbors interpolation).
- `src/systems/` — movement/controls and related logic.
- `src/objects/` — 3D entities (`Cube`, `Pistol`, generators).
- `src/ui/react/` — React UI (Start screen, Timer, hints, badges) mounted at `#ui-root`.
- `public/` — static assets (images, icons, models).

**Conventions**
- **TypeScript:** keep types explicit; avoid `any`. Strict mode is on.
- **Imports:** prefer `@/...` absolute paths over deep relatives.
- **UI:** React components own DOM; game logic should not query UI nodes directly. Use the `UIController` bridge in `src/ui/react/mountUI.tsx`.
- **Pointer lock:** only request on canvas clicks (see `src/core/App.ts`).
- **Sensitivity:** read from `localStorage` and react to `#sensitivityRange` updates (delegated input listener in controls).
- **Networking:** WS throttled to ~20Hz; see `src/utils/ws/WSManager.ts` and `ControlsWithMovement.checkChanges()`.

**React UI Architecture**
- Root is mounted in `#ui-root`; see `src/ui/react/mountUI.tsx` and `src/ui/react/UIRoot.tsx`.
- The game calls `app.startGame(level)` via the UI `onStart` callback.
- The timer is a React component exposing `start/stop/reset` through `UIController.timer`.

**Performance Tips**
- Limit allocations in the render loop; reuse vectors and raycasters.
- Keep network updates quantized and thresholded; don’t lower rate caps casually.
- When modifying post-processing, ensure pass order remains: Render → Outline → FXAA (`src/core/Renderer.ts`).

**Testing**
- No test suite is configured yet. If you add tests, prefer Vitest.
- Suggested setup: `npm i -D vitest @testing-library/react @testing-library/user-event jsdom` and wire a custom Next-compatible `vitest.config.ts`.
- Keep unit tests close to the code under `src/**/__tests__`.

**Linting & Formatting**
- ESLint is configured via `next lint`. If you introduce Prettier, scope changes to config + minimal autofix; avoid large reformat-only PRs.

**PR Guidelines**
- **Title:** `[client] <short, imperative title>`
- **Diff hygiene:** keep PRs focused; avoid unrelated refactors.
- **Checks:** ensure type-check (`tsc --noEmit`) is clean and app runs.
- **Describe:** include rationale, screenshots (UI), and notes on performance/network impacts.

**Agent Workflow**
- **Plan:** outline 2–6 concrete steps before large changes.
- **Search:** prefer `rg` to find files/symbols; open files in ≤250-line chunks.
- **Edit:** use patch-based edits; keep changes minimal and aligned with the style.
- **Validate:** run locally if possible; for non-interactive tasks, add small sanity checks.
- **Coordinate:** if a change touches both React UI and game logic, define the interface (callbacks/bridges) first.

**Common Tasks**
- **Add UI component:** create under `src/ui/react/...`, export from an index if shared, mount via `UIRoot`.
- **Hook game to UI:** extend `UIController` in `src/ui/react/mountUI.tsx` and call from `src/core/App.ts`.
- **New scene/system:** prefer small classes in `src/scenes/` or `src/systems/`, injected via `App`/`Loop`.
- **Assets:** place in `public/` and reference by relative URL.

**Troubleshooting**
- Pointer lock grabs outside canvas: ensure listeners are bound to `canvas` only or some buttons in the ui (see `App` constructor).
- Sensitivity not applying: confirm `localStorage.mouseSensitivity` and `input` event reaches document.
- Neighbors stutter: check WS rate/throttling and interpolation in `MainScene.update()`.

For any larger changes, propose the interface first (short plan), then implement in small, verifiable steps.
