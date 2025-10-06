import type { EditorModeManager } from "../EditorModeManager";
import type EditorApp from "../../EditorApp";
import type { DragHandler } from "./DragHandler";

export class SelectionHandler {
  private dragHandler?: DragHandler;

  constructor(
    private modeManager: EditorModeManager,
    private editor: EditorApp,
  ) {}

  public setDragHandler(handler: DragHandler): void {
    this.dragHandler = handler;
  }

  public handlePointerDown(event: PointerEvent): void {
    // ALWAYS prevent OrbitControls from handling left click
    event.preventDefault();
    event.stopImmediatePropagation();

    // Pick block under cursor
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const hit = this.editor.pickBlock(event.clientX, event.clientY, additive);

    if (hit && this.dragHandler) {
      // Block was clicked, start drag
      this.dragHandler.start(event.clientX, event.clientY);
    }
    // If no hit, just select nothing (clear selection is handled by pickBlock)
  }
}
