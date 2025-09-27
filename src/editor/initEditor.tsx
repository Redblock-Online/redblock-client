import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import EditorApp from "./EditorApp";
import { EditorRoot } from "./components/EditorRoot";

export function initEditor(): void {
  const canvas = document.getElementById("canvas");
  const uiRoot = document.getElementById("ui-root");

  if (!(canvas instanceof HTMLCanvasElement) || uiRoot === null) {
    throw new Error("Editor: missing canvas or UI root");
  }

  document.body.classList.remove("bg-[#f8f8f8]");
  document.body.classList.add("bg-[#161616]", "text-white");
  canvas.classList.add("absolute", "inset-0");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.pointerEvents = "auto";

  uiRoot.classList.add("absolute", "inset-0");

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
