import type { EditorBlock } from "@/features/editor/types";

export type TransformMode = "translate" | "rotate" | "scale";
export type AxisConstraint = "x" | "y" | "z" | null;

export type EditorMode =
  | { type: "idle" }
  | { type: "selecting" }
  | { type: "dragging"; blockIds: string[] }
  | { type: "transforming"; mode: TransformMode; axis: AxisConstraint }
  | { type: "component-editing"; componentId: string };

type ModeChangeListener = (mode: EditorMode, previousMode: EditorMode) => void;

export class EditorModeManager {
  private currentMode: EditorMode = { type: "idle" };
  private listeners = new Set<ModeChangeListener>();

  public getMode(): EditorMode {
    return this.currentMode;
  }

  public setMode(mode: EditorMode): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    this.notifyListeners(mode, previousMode);
  }

  public isMode(type: EditorMode["type"]): boolean {
    return this.currentMode.type === type;
  }

  public isIdle(): boolean {
    return this.currentMode.type === "idle";
  }

  public isDragging(): boolean {
    return this.currentMode.type === "dragging";
  }

  public isTransforming(): boolean {
    return this.currentMode.type === "transforming";
  }

  public getTransformMode(): TransformMode | null {
    return this.currentMode.type === "transforming" ? this.currentMode.mode : null;
  }

  public getTransformAxis(): AxisConstraint {
    return this.currentMode.type === "transforming" ? this.currentMode.axis : null;
  }

  public setTransformAxis(axis: AxisConstraint): void {
    if (this.currentMode.type === "transforming") {
      this.currentMode.axis = axis;
      this.notifyListeners(this.currentMode, this.currentMode);
    }
  }

  public addListener(listener: ModeChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(mode: EditorMode, previousMode: EditorMode): void {
    for (const listener of this.listeners) {
      listener(mode, previousMode);
    }
  }

  public reset(): void {
    this.setMode({ type: "idle" });
  }
}
