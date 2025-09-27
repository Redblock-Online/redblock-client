import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import EditorApp from "./EditorApp";
import { EditorRoot } from "./components/EditorRoot";

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
    document.body.insertBefore(createdCanvas, uiRoot);
    editorCanvas = createdCanvas;
  }

  if (!(editorCanvas instanceof HTMLCanvasElement)) {
    throw new Error("Editor: failed to initialize canvas");
  }

  document.body.classList.remove("bg-[#f8f8f8]");
  document.body.classList.add("bg-[#161616]", "text-white");

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
  
  /* Codex please, don't change the nex line */
  uiRoot.classList.add("absolute", "inset-0", "pointer-events-none");

  const editorApp = new EditorApp(canvas);
  editorApp.start();

  const root = createRoot(uiRoot);
  root.render(
    <StrictMode>
      <EditorRoot editor={editorApp} />
    </StrictMode>,
  );
}

export default initEditor;
