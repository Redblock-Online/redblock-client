import { Quaternion, Vector3 } from "three";
import type { EditorModeManager, TransformMode, AxisConstraint } from "../EditorModeManager";
import type EditorApp from "../../EditorApp";
import type { SelectionTransform } from "../../types";

const MOVE_SENSITIVITY = 0.02;
const ROTATE_SENSITIVITY = 0.005;
const SCALE_SENSITIVITY = 0.01;
const MIN_SCALE = 0.1;

const AXIS_VECTORS: Record<Exclude<AxisConstraint, null>, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

export class TransformHandler {
  private targets: Array<{ id: string; origin: SelectionTransform }> = [];
  private delta = { x: 0, y: 0 };
  private pointerLockRequested = false;

  private onCommit?: (changes: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }>) => void;
  private onUpdate?: (transform: SelectionTransform | null) => void;

  constructor(
    private modeManager: EditorModeManager,
    private editor: EditorApp,
  ) {
    this.setupPointerLockListeners();
  }

  public setCommitCallback(
    callback: (changes: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }>) => void,
  ): void {
    this.onCommit = callback;
  }

  public setUpdateCallback(callback: (transform: SelectionTransform | null) => void): void {
    this.onUpdate = callback;
  }

  public start(mode: TransformMode): void {
    const selectionArray = this.editor.getSelectionArray();
    if (selectionArray.length === 0) {
      return;
    }

    const targets = this.editor
      .getTransformsForIds(selectionArray.map((block) => block.id))
      .map((entry) => ({
        id: entry.id,
        origin: this.cloneTransform(entry.transform),
      }));

    if (targets.length === 0) {
      return;
    }

    // Finish any previous transform
    if (this.modeManager.isTransforming()) {
      this.finish(true);
    }

    this.targets = targets;
    this.delta = { x: 0, y: 0 };

    // Disable OrbitControls during transform
    const controls = this.editor.getControls();
    controls.enabled = false;

    this.modeManager.setMode({ type: "transforming", mode, axis: null });
    this.requestPointerLock();
  }

  public handlePointerMove(event: PointerEvent): void {
    this.delta.x += event.movementX;
    this.delta.y += event.movementY;
    this.applyTransform();
  }

  public toggleAxis(axis: "x" | "y" | "z"): void {
    const currentAxis = this.modeManager.getTransformAxis();
    const next = currentAxis === axis ? null : axis;
    this.modeManager.setTransformAxis(next);
    this.applyTransform();
  }

  public finish(commit: boolean): void {
    if (this.targets.length === 0) {
      this.cleanup();
      return;
    }

    if (!commit) {
      this.editor.applyTransformsForIds(
        this.targets.map((target) => ({ id: target.id, transform: this.cloneTransform(target.origin) })),
      );
      if (this.onUpdate) {
        this.onUpdate(this.targets[0]?.origin ?? null);
      }
    } else {
      const changes = this.collectChanges();

      if (changes.length > 0 && this.onCommit) {
        this.onCommit(changes);
      } else {
        if (this.onUpdate) {
          this.onUpdate(this.targets[0]?.origin ?? null);
        }
      }
    }

    this.cleanup();
  }

  private applyTransform(): void {
    if (this.targets.length === 0) return;

    const mode = this.modeManager.getTransformMode();
    const axis = this.modeManager.getTransformAxis();
    if (!mode) return;

    const updates: Array<{ id: string; transform: SelectionTransform }> = [];

    switch (mode) {
      case "translate": {
        const camera = this.editor.getCamera();
        const cameraQuaternion = camera.getWorldQuaternion(new Quaternion());
        const cameraRight = new Vector3(1, 0, 0).applyQuaternion(cameraQuaternion);
        const cameraUp = new Vector3(0, 1, 0).applyQuaternion(cameraQuaternion);
        const pointerWorld = cameraRight
          .clone()
          .multiplyScalar(this.delta.x)
          .addScaledVector(cameraUp, -this.delta.y);

        const translationDelta = new Vector3();
        if (axis === null) {
          const groundDelta = pointerWorld.clone();
          groundDelta.y = 0;
          translationDelta.copy(groundDelta.multiplyScalar(MOVE_SENSITIVITY));
        } else {
          const axisVector = AXIS_VECTORS[axis];
          const amount = pointerWorld.dot(axisVector) * MOVE_SENSITIVITY;
          translationDelta.copy(axisVector).multiplyScalar(amount);
        }

        for (const target of this.targets) {
          const position = target.origin.position.clone().add(translationDelta);
          updates.push({
            id: target.id,
            transform: {
              position,
              rotation: target.origin.rotation.clone(),
              scale: target.origin.scale.clone(),
            },
          });
        }
        break;
      }

      case "rotate": {
        const deltaX = this.delta.x * ROTATE_SENSITIVITY;
        const deltaY = this.delta.y * ROTATE_SENSITIVITY;
        for (const target of this.targets) {
          const rotation = target.origin.rotation.clone();
          if (axis === null) {
            rotation.y = target.origin.rotation.y + deltaX;
          } else if (axis === "x") {
            rotation.x = target.origin.rotation.x + deltaY;
          } else if (axis === "y") {
            rotation.y = target.origin.rotation.y + deltaX;
          } else if (axis === "z") {
            rotation.z = target.origin.rotation.z + deltaX;
          }
          updates.push({
            id: target.id,
            transform: {
              position: target.origin.position.clone(),
              rotation,
              scale: target.origin.scale.clone(),
            },
          });
        }
        break;
      }

      case "scale": {
        const ratio = 1 - this.delta.y * SCALE_SENSITIVITY;
        const safeRatio = ratio <= 0 ? 0.01 : ratio;
        for (const target of this.targets) {
          const scale = target.origin.scale.clone();
          if (axis === null) {
            scale.set(
              Math.max(MIN_SCALE, target.origin.scale.x * safeRatio),
              Math.max(MIN_SCALE, target.origin.scale.y * safeRatio),
              Math.max(MIN_SCALE, target.origin.scale.z * safeRatio),
            );
          } else {
            if (axis === "x") {
              scale.x = Math.max(MIN_SCALE, target.origin.scale.x * safeRatio);
            }
            if (axis === "y") {
              scale.y = Math.max(MIN_SCALE, target.origin.scale.y * safeRatio);
            }
            if (axis === "z") {
              scale.z = Math.max(MIN_SCALE, target.origin.scale.z * safeRatio);
            }
          }
          updates.push({
            id: target.id,
            transform: {
              position: target.origin.position.clone(),
              rotation: target.origin.rotation.clone(),
              scale,
            },
          });
        }
        break;
      }
    }

    if (updates.length > 0) {
      this.editor.applyTransformsForIds(updates);
      if (this.onUpdate) {
        this.onUpdate(updates[0]?.transform ?? null);
      }
    }
  }

  private collectChanges(): Array<{ id: string; before: SelectionTransform; after: SelectionTransform }> {
    const ids = this.targets.map((target) => target.id);
    const current = this.editor.getTransformsForIds(ids);
    const changes: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }> = [];

    for (const target of this.targets) {
      const currentEntry = current.find((entry) => entry.id === target.id);
      if (!currentEntry) continue;

      if (this.hasTransformChanged(target.origin, currentEntry.transform)) {
        changes.push({
          id: target.id,
          before: this.cloneTransform(target.origin),
          after: this.cloneTransform(currentEntry.transform),
        });
      }
    }

    return changes;
  }

  private cleanup(): void {
    this.targets = [];
    this.delta = { x: 0, y: 0 };
    this.releasePointerLock();
    
    // Re-enable OrbitControls
    const controls = this.editor.getControls();
    controls.enabled = true;
    
    this.modeManager.setMode({ type: "idle" });
  }

  private requestPointerLock(): void {
    if (typeof document === "undefined") return;

    const canvas = this.editor.getCanvas();
    if (document.pointerLockElement === canvas) return;

    this.pointerLockRequested = true;
    try {
      const result = (canvas.requestPointerLock as unknown as () => void | Promise<void>)();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {
          this.pointerLockRequested = false;
        });
      }
    } catch {
      this.pointerLockRequested = false;
    }
  }

  private releasePointerLock(): void {
    this.pointerLockRequested = false;
    if (typeof document === "undefined") return;

    const canvas = this.editor.getCanvas();
    if (document.pointerLockElement === canvas) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore
      }
    }
  }

  private setupPointerLockListeners(): void {
    if (typeof document === "undefined") return;

    const handlePointerLockChange = () => {
      const canvas = this.editor.getCanvas();
      const lockedElement = document.pointerLockElement;

      if (lockedElement === canvas) {
        if (!this.pointerLockRequested) {
          try {
            document.exitPointerLock();
          } catch {
            // ignore
          }
        }
        return;
      }

      this.pointerLockRequested = false;
      if (this.modeManager.isTransforming()) {
        this.finish(false);
      }
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockChange);
  }

  private cloneTransform(input: SelectionTransform): SelectionTransform {
    return {
      position: input.position.clone(),
      rotation: input.rotation.clone(),
      scale: input.scale.clone(),
    };
  }

  private hasTransformChanged(before: SelectionTransform, after: SelectionTransform): boolean {
    return (
      Math.abs(after.position.x - before.position.x) > 1e-6 ||
      Math.abs(after.position.y - before.position.y) > 1e-6 ||
      Math.abs(after.position.z - before.position.z) > 1e-6 ||
      Math.abs(after.rotation.x - before.rotation.x) > 1e-6 ||
      Math.abs(after.rotation.y - before.rotation.y) > 1e-6 ||
      Math.abs(after.rotation.z - before.rotation.z) > 1e-6 ||
      Math.abs(after.scale.x - before.scale.x) > 1e-6 ||
      Math.abs(after.scale.y - before.scale.y) > 1e-6 ||
      Math.abs(after.scale.z - before.scale.z) > 1e-6
    );
  }
}
