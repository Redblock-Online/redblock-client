import { Vector3 } from "three";
import type { EditorModeManager } from "../EditorModeManager";
import type EditorApp from "../../EditorApp";
import type { SelectionTransform } from "../../types";
import { cloneTransform, hasTransformChanged } from "../EditorTransformUtils";

type DragAxisConstraint = "x" | "y" | "z" | null;

const DRAG_AXIS_VECTORS = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

const DRAG_VERTICAL_SENSITIVITY = 0.01;

export class DragHandler {
  private dragStartPoint: Vector3 | null = null;
  private dragTargets: Array<{ id: string; origin: SelectionTransform }> = [];
  private dragAxisConstraint: DragAxisConstraint = null;
  private dragTranslationDelta = new Vector3();
  private dragWorkingDelta = new Vector3();
  private dragPointerAccumulator = { x: 0, y: 0 };
  private dragCameraRight = new Vector3();
  private dragCameraUp = new Vector3();
  private dragPointerWorld = new Vector3();

  private onCommit?: (changes: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }>) => void;

  constructor(
    private modeManager: EditorModeManager,
    private editor: EditorApp,
  ) {}

  public setCommitCallback(
    callback: (changes: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }>) => void,
  ): void {
    this.onCommit = callback;
  }

  public start(clientX: number, clientY: number): void {
    const selection = this.editor.getSelectionArray();
    if (selection.length === 0) {
      return;
    }

    const start = this.editor.intersectGround(clientX, clientY);
    if (!start) {
      return;
    }

    // Disable OrbitControls during drag
    const controls = this.editor.getControls();
    controls.enabled = false;

    this.dragStartPoint = start;
    const ids = selection.map((b) => b.id);
    this.dragTargets = this.editor
      .getTransformsForIds(ids)
      .map((entry) => ({ id: entry.id, origin: cloneTransform(entry.transform) }));
    this.dragTranslationDelta.set(0, 0, 0);
    this.dragAxisConstraint = null;
    this.dragPointerAccumulator = { x: 0, y: 0 };

    this.modeManager.setMode({ type: "dragging", blockIds: ids });
    this.editor.setDraggingCursor(true);
  }

  public handlePointerMove(event: PointerEvent): void {
    if (this.dragTargets.length === 0) return;

    const axis = this.dragAxisConstraint;

    if (axis === "y") {
      this.dragPointerAccumulator.x += event.movementX;
      this.dragPointerAccumulator.y += event.movementY;

      const camera = this.editor.getCamera();
      const cameraQuaternion = camera.getWorldQuaternion(this.editor.dragCameraQuaternionPublic);
      this.dragCameraRight.set(1, 0, 0).applyQuaternion(cameraQuaternion);
      this.dragCameraUp.set(0, 1, 0).applyQuaternion(cameraQuaternion);
      this.dragPointerWorld
        .copy(this.dragCameraRight)
        .multiplyScalar(this.dragPointerAccumulator.x)
        .addScaledVector(this.dragCameraUp, -this.dragPointerAccumulator.y);

      const amount = this.dragPointerWorld.dot(DRAG_AXIS_VECTORS.y) * DRAG_VERTICAL_SENSITIVITY;
      this.dragTranslationDelta.copy(DRAG_AXIS_VECTORS.y).multiplyScalar(amount);
    } else {
      const current = this.editor.intersectGround(event.clientX, event.clientY);
      if (!current || !this.dragStartPoint) return;

      this.dragWorkingDelta.copy(current).sub(this.dragStartPoint).setY(0);

      if (axis === "x") {
        this.dragWorkingDelta.set(this.dragWorkingDelta.x, 0, 0);
      } else if (axis === "z") {
        this.dragWorkingDelta.set(0, 0, this.dragWorkingDelta.z);
      }

      this.dragTranslationDelta.copy(this.dragWorkingDelta);
    }

    const updates = this.dragTargets.map(({ id, origin }) => {
      const position = origin.position.clone().add(this.dragTranslationDelta);
      return {
        id,
        transform: {
          position,
          rotation: origin.rotation.clone(),
          scale: origin.scale.clone(),
        },
      };
    });

    this.editor.applyTransformsForIds(updates);
  }

  public toggleAxis(axis: "x" | "y" | "z"): void {
    const next = this.dragAxisConstraint === axis ? null : axis;
    this.dragAxisConstraint = next;

    if (next === "y") {
      this.dragPointerAccumulator = { x: 0, y: 0 };
    }
  }

  public finish(commit: boolean): void {
    if (commit && this.dragTargets.length > 0) {
      const changes = this.collectChanges();
      if (changes.length > 0 && this.onCommit) {
        this.onCommit(changes);
      }
    } else if (!commit) {
      // Revert to original positions
      this.editor.applyTransformsForIds(
        this.dragTargets.map((target) => ({ id: target.id, transform: target.origin })),
      );
    }

    this.cleanup();
  }

  private collectChanges(): Array<{ id: string; before: SelectionTransform; after: SelectionTransform }> {
    const ids = this.dragTargets.map((target) => target.id);
    const current = this.editor.getTransformsForIds(ids);
    const changes: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }> = [];

    for (const target of this.dragTargets) {
      const currentEntry = current.find((entry) => entry.id === target.id);
      if (!currentEntry) continue;

      if (hasTransformChanged(target.origin, currentEntry.transform)) {
        changes.push({
          id: target.id,
          before: cloneTransform(target.origin),
          after: cloneTransform(currentEntry.transform),
        });
      }
    }

    return changes;
  }

  private cleanup(): void {
    this.dragStartPoint = null;
    this.dragTargets = [];
    this.dragAxisConstraint = null;
    this.dragTranslationDelta.set(0, 0, 0);
    this.editor.setDraggingCursor(false);
    
    // Re-enable OrbitControls
    const controls = this.editor.getControls();
    controls.enabled = true;
    
    this.modeManager.setMode({ type: "idle" });
  }

}
