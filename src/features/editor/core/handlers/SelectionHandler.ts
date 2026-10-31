import type { EditorModeManager } from "../EditorModeManager";
import type { EditorApp } from "@/features/editor/core";
import type { DragHandler } from "./DragHandler";
import { SelectionBox } from "../SelectionBox";

export class SelectionHandler {
  private dragHandler?: DragHandler;
  private selectionBox: SelectionBox;
  private isDraggingBox = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private readonly DRAG_THRESHOLD = 5; // pixels
  // Block clicked inside a multi-selection; becomes the only selection if the click wasn't a drag
  private pendingSingleSelectId: string | null = null;

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

    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const currentSelection = this.editor.getSelectionArray();

    // Detect block under cursor without changing selection
    const detectedBlock = this.editor.detectBlockUnderCursor(event.clientX, event.clientY);
    const clickedBlockIsSelected = !!detectedBlock && currentSelection.some((block) => block.id === detectedBlock.id);

    // Plain click on a block of a multi-selection: keep the selection and drag all of it.
    // (Shift/Ctrl-click falls through so it can toggle that block out of the selection.)
    this.pendingSingleSelectId = null;
    if (!additive && currentSelection.length > 1 && clickedBlockIsSelected && this.dragHandler) {
      if (!this.editor.isSelectingGenerator()) {
        this.pendingSingleSelectId = detectedBlock.id;
        this.dragHandler.start(event.clientX, event.clientY);
      }
      this.isDraggingBox = false;
      return;
    }

    // For single selection or new selection, use normal pickBlock behavior
    const hit = this.editor.pickBlock(event.clientX, event.clientY, additive);

    if (hit) {
      // Only drag when the clicked block ended up selected: a shift-click that toggles a block
      // off must not start dragging the rest of the selection.
      const hitIsSelected = this.editor.getSelectionArray().some((block) => block.id === hit.id);
      if (this.dragHandler && hitIsSelected && !this.editor.isSelectingGenerator()) {
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

  /**
   * Called when a block drag ends. A click (no movement) on a block of a multi-selection
   * selects just that block.
   */
  public handleDragEnd(event: PointerEvent): void {
    const pendingId = this.pendingSingleSelectId;
    this.pendingSingleSelectId = null;
    if (!pendingId) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    if (Math.sqrt(dx * dx + dy * dy) <= this.DRAG_THRESHOLD) {
      this.editor.setSelectionByIds([pendingId]);
    }
  }

  /**
   * Abort a box selection without selecting (pointer released outside the canvas, window blur).
   */
  public cancelBoxSelection(): void {
    if (this.selectionBox.isSelecting()) {
      this.selectionBox.hide();
    }
    this.isDraggingBox = false;
  }

  public dispose(): void {
    this.selectionBox.dispose();
  }
}
