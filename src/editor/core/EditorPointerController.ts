import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { EditorDragController } from "./EditorDragController";
import type { PointerUpListener, DragCommitEntry } from "./EditorTypes";
import type { SelectionTransform } from "../types";

export class EditorPointerController {
  private leftButtonActive = false;
  private draggingCursorApplied = false;
  private readonly pointerUpListeners = new Set<PointerUpListener>();
  private readonly dragCommitListeners = new Set<(changes: DragCommitEntry[]) => void>();

  private readonly canvas: HTMLCanvasElement;
  private readonly controls: OrbitControls;
  private readonly dragController: EditorDragController;

  constructor(
    canvas: HTMLCanvasElement,
    controls: OrbitControls,
    dragController: EditorDragController
  ) {
    this.canvas = canvas;
    this.controls = controls;
    this.dragController = dragController;

    this.canvas.addEventListener("pointerdown", this.handlePointerDownCapture, { capture: true });
    this.canvas.addEventListener("pointermove", this.handlePointerMoveCapture, { capture: true });
    this.canvas.addEventListener("pointerup", this.handlePointerUpCapture, { capture: true });
    this.canvas.addEventListener("pointercancel", this.handlePointerUpCapture, { capture: true });
    window.addEventListener("pointerup", this.handleWindowPointerUpCapture, { capture: true });
    window.addEventListener("pointercancel", this.handleWindowPointerUpCapture, { capture: true });
  }

  public addPointerUpListener(listener: PointerUpListener): () => void {
    this.pointerUpListeners.add(listener);
    return () => this.pointerUpListeners.delete(listener);
  }

  public addDragCommitListener(listener: (changes: DragCommitEntry[]) => void): () => void {
    this.dragCommitListeners.add(listener);
    return () => this.dragCommitListeners.delete(listener);
  }

  public setDraggingCursor(active: boolean): void {
    if (active === this.draggingCursorApplied) return;
    this.draggingCursorApplied = active;
    this.canvas.style.cursor = active ? "pointer" : "default";
  }

  public dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDownCapture, { capture: true });
    this.canvas.removeEventListener("pointermove", this.handlePointerMoveCapture, { capture: true });
    this.canvas.removeEventListener("pointerup", this.handlePointerUpCapture, { capture: true });
    this.canvas.removeEventListener("pointercancel", this.handlePointerUpCapture, { capture: true });
    window.removeEventListener("pointerup", this.handleWindowPointerUpCapture, { capture: true });
    window.removeEventListener("pointercancel", this.handleWindowPointerUpCapture, { capture: true });
  }

  private handlePointerDownCapture = (event: PointerEvent): void => {
    if (event.button !== 0) {
      if (event.button === 2) {
        this.controls.enabled = true;
      }
      return;
    }

    this.leftButtonActive = true;
    this.controls.enabled = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private handlePointerMoveCapture = (event: PointerEvent): void => {
    if (!this.dragController.isDraggingActive() || !this.leftButtonActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.dragController.updateDrag(event);
  };

  private handlePointerUpCapture = (event: PointerEvent): void => {
    const isCancel = event.type === "pointercancel";
    if ((event.button === 0 || isCancel) && this.leftButtonActive) {
      this.leftButtonActive = false;
      this.controls.enabled = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.finalizePointerRelease(event, !isCancel);
      this.setDraggingCursor(false);
    }
  };

  private handleWindowPointerUpCapture = (event: PointerEvent): void => {
    const isCancel = event.type === "pointercancel";
    if ((event.button === 0 || isCancel) && this.leftButtonActive) {
      this.leftButtonActive = false;
      this.controls.enabled = true;
      this.finalizePointerRelease(event, false);
      this.setDraggingCursor(false);
    }
  };

  private finalizePointerRelease(event: PointerEvent, commit: boolean): void {
    const wasDragging = this.dragController.isDraggingActive();
    const changes = commit && wasDragging ? this.dragController.collectDragChanges() : [];

    this.dragController.endDrag();

    if (changes.length > 0) {
      this.emitDragCommit(changes);
    }

    this.emitPointerUp(event, { dragged: wasDragging });
  }

  private emitPointerUp(event: PointerEvent, context: { dragged: boolean }): void {
    for (const listener of this.pointerUpListeners) {
      listener(event, context);
    }
  }

  private emitDragCommit(changes: DragCommitEntry[]): void {
    if (changes.length === 0) return;
    for (const listener of this.dragCommitListeners) {
      listener(changes);
    }
  }

  public notifyDragStart(
    startPoint: import("three").Vector3,
    targets: Array<{ id: string; transform: SelectionTransform }>
  ): void {
    this.dragController.startDrag(startPoint, targets);
    this.setDraggingCursor(true);
  }

  public applyDragUpdates(
    applyTransforms: (updates: Array<{ id: string; transform: SelectionTransform }>) => void
  ): void {
    if (!this.dragController.isDraggingActive()) return;
    const updates = this.dragController.getDragUpdates();
    applyTransforms(updates);
  }
}
