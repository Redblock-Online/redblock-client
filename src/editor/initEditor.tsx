import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { StrictMode } from "react";
import EditorApp from "./EditorApp";
import { EditorRoot } from "./components/EditorRoot";
import { AUTO_SAVE_SCENARIO_NAME, findScenarioByName, saveScenario } from "./scenarioStore";

let editorAppSingleton: EditorApp | null = null;
let reactRootSingleton: Root | null = null;
let reactRootHostEl: HTMLElement | null = null;

export function initEditor(): void {
  const originalCanvas = document.getElementById("canvas");
  const uiRoot = document.getElementById("ui-root");

  if (uiRoot === null) {
    throw new Error("Editor: missing UI root");
  }

  if (originalCanvas instanceof HTMLCanvasElement) {
    originalCanvas.style.display = "none";
  }

  let editorCanvas = document.getElementById("editor-canvas");
  if (!(editorCanvas instanceof HTMLCanvasElement)) {
    const createdCanvas = document.createElement("canvas");
    createdCanvas.id = "editor-canvas";
    // Mount outside React-managed subtree to avoid reparenting during renders
    document.body.appendChild(createdCanvas);
    editorCanvas = createdCanvas;
  } else if (!document.body.contains(editorCanvas)) {
    // If somehow detached or moved, ensure it lives under body
    document.body.appendChild(editorCanvas);
  }

  if (!(editorCanvas instanceof HTMLCanvasElement)) {
    throw new Error("Editor: failed to initialize canvas");
  }

  document.body.classList.remove("bg-[#f8f8f8]");
  document.body.classList.add("bg-[#2b2b2b]", "text-white");

  const canvas: HTMLCanvasElement = editorCanvas;

  canvas.classList.add("absolute", "inset-0");
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.right = "0";
  canvas.style.bottom = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.pointerEvents = "auto";
  canvas.style.zIndex = "1"; // Above background but below UI panels (z-10)
  
  /* Codex please, don't change the nex line */
  uiRoot.classList.add("absolute", "inset-0", "pointer-events-none");

  if (!editorAppSingleton) {
    editorAppSingleton = new EditorApp(canvas);
    editorAppSingleton.start();

    // Expose editor globally for debugging
    if (typeof window !== "undefined") {
      (window as Window & { editor?: typeof editorAppSingleton }).editor = editorAppSingleton;
      console.log("[Editor] Editor exposed globally as window.editor");
    }

    try {
      const autosave = findScenarioByName(AUTO_SAVE_SCENARIO_NAME);
      if (autosave) {
        editorAppSingleton.importScenario(autosave.data);
      } else {
        const initial = editorAppSingleton.exportScenario(AUTO_SAVE_SCENARIO_NAME);
        saveScenario(AUTO_SAVE_SCENARIO_NAME, initial);
      }
    } catch (error) {
      console.error("Editor: failed to restore last saved scenario", error);
    }
  }

  // (Re)mount React UI root, avoiding duplicate createRoot on the same container
  if (!reactRootSingleton || reactRootHostEl !== uiRoot) {
    try {
      reactRootSingleton?.unmount();
    } catch {}
    reactRootSingleton = createRoot(uiRoot);
    reactRootHostEl = uiRoot;
  }

  reactRootSingleton.render(
    <StrictMode>
      <EditorRoot editor={editorAppSingleton} />
    </StrictMode>,
  );
}

export function disposeEditor(): void {
  try {
    reactRootSingleton?.unmount();
  } catch {}
  reactRootSingleton = null;
  reactRootHostEl = null;
  try {
    editorAppSingleton?.dispose();
  } catch {}
  editorAppSingleton = null;
  const canvas = document.getElementById("editor-canvas");
  if (canvas && canvas.parentElement) {
    try {
      canvas.parentElement.removeChild(canvas);
    } catch {}
  }
}

export default initEditor;
