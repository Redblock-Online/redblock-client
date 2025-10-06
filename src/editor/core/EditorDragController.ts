import { PerspectiveCamera, Quaternion, Raycaster, Vector2, Vector3 } from "three";
import type { SelectionTransform } from "../types";
import type { DragAxisConstraint, DragCommitEntry } from "./EditorTypes";
import { DRAG_AXIS_VECTORS, DRAG_VERTICAL_SENSITIVITY } from "./EditorTypes";
import { cloneTransform, hasTransformChanged } from "./EditorTransformUtils";

export class EditorDragController {
  private isDragging = false;
  private dragStartPoint: Vector3 | null = null;
  private dragTargets: Array<{ id: string; origin: SelectionTransform }> = [];
  private dragAxisConstraint: DragAxisConstraint = null;
  private dragPointerAccumulator = { x: 0, y: 0 };
  private lastPointerEvent: { clientX: number; clientY: number } | null = null;

  private readonly dragWorkingDelta = new Vector3();
  private readonly dragTranslationDelta = new Vector3();
  private readonly dragCameraRight = new Vector3();
  private readonly dragCameraUp = new Vector3();
  private readonly dragPointerWorld = new Vector3();
  private readonly dragCameraQuaternion = new Quaternion();

  private readonly raycaster: Raycaster;
  private readonly pointer = new Vector2();
  private readonly camera: PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;

  constructor(camera: PerspectiveCamera, canvas: HTMLCanvasElement, raycaster: Raycaster) {
    this.camera = camera;
    this.canvas = canvas;
    this.raycaster = raycaster;
  }

  public isDraggingActive(): boolean {
    return this.isDragging;
  }

  public getDragAxisConstraint(): DragAxisConstraint {
    return this.dragAxisConstraint;
  }

  public toggleDragAxis(axis: "x" | "y" | "z"): void {
    if (!this.isDragging) return;

    if (this.dragAxisConstraint === axis) {
      this.dragAxisConstraint = null;
    } else {
      this.dragAxisConstraint = axis;
    }

    this.resetDragStartFromPointer();
    this.resetDragPointerAccumulator();
  }

  public startDrag(
    startPoint: Vector3,
    targets: Array<{ id: string; transform: SelectionTransform }>
  ): void {
    this.isDragging = true;
    this.dragStartPoint = startPoint;
    this.dragTargets = targets.map((t) => ({ id: t.id, origin: t.transform }));
    this.dragTranslationDelta.set(0, 0, 0);
    this.dragAxisConstraint = null;
    this.resetDragPointerAccumulator();
  }

  public updateDrag(event: PointerEvent): Vector3 | null {
    if (!this.isDragging || this.dragTargets.length === 0) return null;

    this.lastPointerEvent = { clientX: event.clientX, clientY: event.clientY };
    const axis = this.dragAxisConstraint;

    if (axis === "y") {
      this.dragPointerAccumulator.x += event.movementX;
      this.dragPointerAccumulator.y += event.movementY;

      this.camera.getWorldQuaternion(this.dragCameraQuaternion);
      this.dragCameraRight.set(1, 0, 0).applyQuaternion(this.dragCameraQuaternion);
      this.dragCameraUp.set(0, 1, 0).applyQuaternion(this.dragCameraQuaternion);
      this.dragPointerWorld
        .copy(this.dragCameraRight)
        .multiplyScalar(this.dragPointerAccumulator.x)
        .addScaledVector(this.dragCameraUp, -this.dragPointerAccumulator.y);

      const amount = this.dragPointerWorld.dot(new Vector3(DRAG_AXIS_VECTORS.y.x, DRAG_AXIS_VECTORS.y.y, DRAG_AXIS_VECTORS.y.z)) * DRAG_VERTICAL_SENSITIVITY;
      this.dragTranslationDelta.set(0, amount, 0);
    } else {
      const current = this.intersectGround(event.clientX, event.clientY);
      if (!current) return null;
      if (!this.dragStartPoint) {
        this.dragStartPoint = current;
      }

      this.dragWorkingDelta.copy(current).sub(this.dragStartPoint).setY(0);

      if (axis === "x") {
        this.dragWorkingDelta.set(this.dragWorkingDelta.x, 0, 0);
      } else if (axis === "z") {
        this.dragWorkingDelta.set(0, 0, this.dragWorkingDelta.z);
      }

      this.dragTranslationDelta.copy(this.dragWorkingDelta);
    }

    return this.dragTranslationDelta.clone();
  }

  public getDragUpdates(): Array<{ id: string; transform: SelectionTransform }> {
    return this.dragTargets.map(({ id, origin }) => {
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
  }

  public collectDragChanges(): DragCommitEntry[] {
    if (this.dragTargets.length === 0) return [];

    const changes: DragCommitEntry[] = [];
    for (const target of this.dragTargets) {
      const after: SelectionTransform = {
        position: target.origin.position.clone().add(this.dragTranslationDelta),
        rotation: target.origin.rotation.clone(),
        scale: target.origin.scale.clone(),
      };

      if (hasTransformChanged(target.origin, after)) {
        changes.push({
          id: target.id,
          before: cloneTransform(target.origin),
          after: cloneTransform(after),
        });
      }
    }
    return changes;
  }

  public endDrag(): void {
    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragTargets = [];
    this.dragAxisConstraint = null;
    this.resetDragPointerAccumulator();
    this.lastPointerEvent = null;
    this.dragTranslationDelta.set(0, 0, 0);
  }

  public refreshDragOrigins(getCurrentTransforms: (ids: string[]) => Array<{ id: string; transform: SelectionTransform }>): void {
    if (this.dragTargets.length === 0) return;
    const ids = this.dragTargets.map((t) => t.id);
    const current = getCurrentTransforms(ids);
    this.dragTargets = current.map((entry) => ({ id: entry.id, origin: entry.transform }));
  }

  private resetDragPointerAccumulator(): void {
    this.dragPointerAccumulator.x = 0;
    this.dragPointerAccumulator.y = 0;
  }

  private resetDragStartFromPointer(): void {
    if (!this.lastPointerEvent) return;
    const point = this.intersectGround(this.lastPointerEvent.clientX, this.lastPointerEvent.clientY);
    if (point) {
      this.dragStartPoint = point;
    }
  }

  private intersectGround(clientX: number, clientY: number): Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const planeNormal = new Vector3(0, 1, 0);
    const planePoint = new Vector3(0, 0, 0);
    const ray = this.raycaster.ray;
    const denom = planeNormal.dot(ray.direction);
    if (Math.abs(denom) < 1e-6) return null;
    const t = planePoint.clone().sub(ray.origin).dot(planeNormal) / denom;
    if (t < 0) return null;
    return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
  }
}
