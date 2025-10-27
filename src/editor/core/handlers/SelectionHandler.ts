import type { EditorModeManager } from "../EditorModeManager";
import type EditorApp from "../../EditorApp";
import type { DragHandler } from "./DragHandler";
import { SelectionBox } from "../SelectionBox";

export class SelectionHandler {
  private dragHandler?: DragHandler;
  private selectionBox: SelectionBox;
  private isDraggingBox = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private readonly DRAG_THRESHOLD = 5; // pixels

  constructor(
    private modeManager: EditorModeManager,
    private editor: EditorApp,
  ) {
    // Create selection box (will be attached to canvas container)
    const canvas = this.editor.getCanvas();
    this.selectionBox = new SelectionBox(canvas.parentElement!);
  }

  public setDragHandler(handler: DragHandler): void {
    this.dragHandler = handler;
  }

  public handlePointerDown(event: PointerEvent): void {
    // ALWAYS prevent OrbitControls from handling left click
    event.preventDefault();
    event.stopImmediatePropagation();

    // Store drag start position
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;

    // Pick block under cursor
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const hit = this.editor.pickBlock(event.clientX, event.clientY, additive);

    if (hit && this.dragHandler) {
      // Don't start drag if we're selecting a generator target
      if (!this.editor.isSelectingGenerator()) {
        // Block was clicked, start drag
        this.dragHandler.start(event.clientX, event.clientY);
      }
      this.isDraggingBox = false;
    } else {
      // No block hit, prepare for box selection
      this.isDraggingBox = true;
    }
  }

  public handlePointerMove(event: PointerEvent): void {
    if (!this.isDraggingBox) return;

    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Start showing box after threshold
    if (distance > this.DRAG_THRESHOLD) {
      if (!this.selectionBox.isSelecting()) {
        this.selectionBox.start(this.dragStartX, this.dragStartY);
      }
      this.selectionBox.update(event.clientX, event.clientY);
    }
  }

  public handlePointerUp(event: PointerEvent): void {
    if (!this.isDraggingBox) return;

    if (this.selectionBox.isSelecting()) {
      // Get selection bounds
      const bounds = this.selectionBox.end();
      if (bounds) {
        // Select all blocks within bounds
        const additive = event.shiftKey || event.metaKey || event.ctrlKey;
        this.editor.selectBlocksInRect(bounds, additive);
      }
    }

    this.isDraggingBox = false;
  }

  public dispose(): void {
    this.selectionBox.dispose();
  }
}
