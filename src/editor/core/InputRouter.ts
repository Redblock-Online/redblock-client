import type { EditorModeManager } from "./EditorModeManager";
import type { DragHandler } from "../core/handlers/DragHandler";
import type { TransformHandler } from "../core/handlers/TransformHandler";
import type { SelectionHandler } from "../core/handlers/SelectionHandler";
import type EditorApp from "../EditorApp";

export class InputRouter {
  constructor(
    private modeManager: EditorModeManager,
    private dragHandler: DragHandler,
    private transformHandler: TransformHandler,
    private selectionHandler: SelectionHandler,
    private editor: EditorApp,
  ) {}

  public handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;

    const mode = this.modeManager.getMode();

    switch (mode.type) {
      case "transforming":
        // Click during transform = commit transform
        event.preventDefault();
        event.stopImmediatePropagation();
        this.transformHandler.finish(true);
        break;

      case "idle":
      case "selecting":
        // Normal selection/drag flow
        this.selectionHandler.handlePointerDown(event);
        break;

      case "component-editing":
        // Let component editing handle it
        break;

      case "dragging":
        // Already dragging, ignore
        break;
    }
  }

  public handlePointerMove(event: PointerEvent): void {
    const mode = this.modeManager.getMode();

    switch (mode.type) {
      case "dragging":
        event.preventDefault();
        this.dragHandler.handlePointerMove(event);
        break;

      case "transforming":
        event.preventDefault();
        this.transformHandler.handlePointerMove(event);
        break;
    }
  }

  public handlePointerUp(event: PointerEvent): void {
    if (event.button !== 0) return;

    const mode = this.modeManager.getMode();

    switch (mode.type) {
      case "dragging":
        event.preventDefault();
        event.stopImmediatePropagation();
        this.dragHandler.finish(true);
        break;

      case "transforming":
        // Pointer up during transform doesn't commit (use click or Enter)
        break;

      case "idle":
      case "selecting":
        // Quick click without drag
        break;
    }
  }

  public handleKeyDown(event: KeyboardEvent): void {
    // Ignore all shortcuts when user is typing in an input
    if (this.editor.isUserTyping()) {
      return;
    }
    
    const mode = this.modeManager.getMode();

    // Escape always cancels
    if (event.key === "Escape") {
      switch (mode.type) {
        case "transforming":
          event.preventDefault();
          this.transformHandler.finish(false);
          break;
        case "dragging":
          event.preventDefault();
          this.dragHandler.finish(false);
          break;
      }
      return;
    }

    // Transform mode keys
    if (mode.type === "transforming") {
      const key = event.key.toLowerCase();

      // Axis constraints
      if (key === "x" || key === "y" || key === "z") {
        event.preventDefault();
        this.transformHandler.toggleAxis(key);
        return;
      }

      // Commit transform
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.transformHandler.finish(true);
        return;
      }
    }

    // Drag mode keys
    if (mode.type === "dragging") {
      const key = event.key.toLowerCase();
      if (key === "x" || key === "y" || key === "z") {
        event.preventDefault();
        this.dragHandler.toggleAxis(key);
        return;
      }
    }

    // Start transform (G/R/F)
    if (mode.type === "idle" || mode.type === "selecting") {
      const key = event.key.toLowerCase();
      if (key === "g" || key === "r" || key === "f") {
        event.preventDefault();
        const transformMode = key === "g" ? "translate" : key === "r" ? "rotate" : "scale";
        this.transformHandler.start(transformMode);
        return;
      }
    }
  }
}
