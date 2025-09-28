import type { Dispatch, SetStateAction, ReactElement } from "react";
import type { EditorSelection } from "../types";
import { Group } from "three";
import { AxisInput } from "./AxisInput";

type VectorState = { x: number; y: number; z: number };

type PropertiesPanelProps = {
  selection: EditorSelection;
  positionState: VectorState;
  scaleState: VectorState;
  rotationState: VectorState;
  onPositionChange: Dispatch<SetStateAction<VectorState>>;
  onScaleChange: Dispatch<SetStateAction<VectorState>>;
  onRotationChange: Dispatch<SetStateAction<VectorState>>;
  onGroupSelection: () => void;
  onUngroupSelection?: () => void;
  onCreateComponent?: () => void;
  onModifyComponent?: () => void;
  componentEditing?: boolean;
  onDeleteSelection?: () => void;
};

export function PropertiesPanel({
  selection,
  positionState,
  scaleState,
  rotationState,
  onPositionChange,
  onScaleChange,
  onRotationChange,
  onGroupSelection,
  onUngroupSelection,
  onCreateComponent,
  onModifyComponent,
  componentEditing,
  onDeleteSelection,
}: PropertiesPanelProps): ReactElement {
  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-xs text-white/50 z-50">
        <span className="text-sm font-semibold text-white/60">Inspector</span>
        <p className="mt-3 max-w-[200px] text-white/40">
          Select an existing block or place a new one to adjust its properties.
        </p>
      </div>
    );
  }

  // Multi selection UI
  if (Array.isArray(selection)) {
    return (
      <div className="flex h-full flex-col gap-6 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-rb-muted">Selection</div>
          <div className="mt-1 text-sm font-semibold text-rb-text">Multiple Objects</div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
            onClick={onGroupSelection}
          >
            Group
          </button>
          {onDeleteSelection ? (
            <button
              className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
              onClick={onDeleteSelection}
            >
              Delete
            </button>
          ) : null}
          {onModifyComponent && componentEditing ? (
            <button
              className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
              onClick={onModifyComponent}
            >
              Finish Editing
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // Single selection UI
  return (
    <div className="flex h-full flex-col gap-6 text-xs">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-rb-muted">Selection</div>
        <div className="mt-1 text-sm font-semibold text-rb-text">{selection.id}</div>
      </div>
      {selection.mesh instanceof Group ? (
        <div className="flex flex-col gap-2">
          <button
            className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
            onClick={onUngroupSelection}
          >
            Ungroup
          </button>
          <button
            className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
            onClick={onCreateComponent}
          >
            Create Component
          </button>
          {onModifyComponent ? (
            <button
              className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
              onClick={onModifyComponent}
            >
              {componentEditing ? "Finish Editing" : "Modify Component"}
            </button>
          ) : null}
          {onDeleteSelection ? (
            <button
              className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
              onClick={onDeleteSelection}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {onDeleteSelection ? (
            <button
              className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
              onClick={onDeleteSelection}
            >
              Delete
            </button>
          ) : null}
        </div>
      )}

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rb-muted">Position</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <AxisInput
              key={axis}
              label={axis}
              value={positionState[axis]}
              step={0.1}
              precision={2}
              onChange={(next) => onPositionChange((prev) => ({ ...prev, [axis]: next }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rb-muted">Scale</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <AxisInput
              key={axis}
              label={axis}
              value={scaleState[axis]}
              step={0.1}
              min={0.1}
              precision={2}
              onChange={(next) => onScaleChange((prev) => ({ ...prev, [axis]: next }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rb-muted">Rotation (°)</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <AxisInput
              key={axis}
              label={axis}
              value={rotationState[axis]}
              step={1}
              precision={1}
              onChange={(next) => onRotationChange((prev) => ({ ...prev, [axis]: next }))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
