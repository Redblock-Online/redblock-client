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
  const actionButtonClass =
    "h-10 rounded-lg border border-black/10 bg-black text-xs font-display uppercase tracking-[0.26em] text-white transition hover:-translate-y-[2px] hover:shadow-[0_12px_28px_rgba(15,23,42,0.18)]";
  const subtleButtonClass =
    "h-10 rounded-lg border border-black/10 bg-white/80 text-xs font-display uppercase tracking-[0.26em] text-black/70 transition hover:-translate-y-[2px] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:bg-white";

  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-black/10 bg-white/40 p-8 text-center text-xs text-black/40">
        <span className="font-display text-sm uppercase tracking-[0.3em] text-black/60">Inspector</span>
        <p className="max-w-[220px] text-[11px] leading-relaxed tracking-[0.02em]">
          Select an existing block or place a new one to adjust its properties.
        </p>
      </div>
    );
  }

  // Multi selection UI
  if (Array.isArray(selection)) {
    return (
      <div className="flex h-full flex-col gap-6 text-xs text-black/70">
        <div>
          <div className="font-display text-[11px] uppercase tracking-[0.3em] text-black/30">Selection</div>
          <div className="mt-1 font-display text-base uppercase tracking-[0.18em] text-black">
            Multiple Objects
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            className={actionButtonClass}
            onClick={onGroupSelection}
          >
            Group
          </button>
          {onDeleteSelection ? (
            <button
              className={subtleButtonClass}
              onClick={onDeleteSelection}
            >
              Delete
            </button>
          ) : null}
          {onModifyComponent && componentEditing ? (
            <button
              className={actionButtonClass}
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
    <div className="flex h-full flex-col gap-6 text-xs text-black/70">
      <div>
        <div className="font-display text-[11px] uppercase tracking-[0.3em] text-black/30">Selection</div>
        <div className="mt-1 font-display text-base uppercase tracking-[0.2em] text-black">
          {selection.id}
        </div>
      </div>
      {selection.mesh instanceof Group ? (
        <div className="flex flex-col gap-2">
          <button
            className={subtleButtonClass}
            onClick={onUngroupSelection}
          >
            Ungroup
          </button>
          <button
            className={actionButtonClass}
            onClick={onCreateComponent}
          >
            Create Component
          </button>
          {onModifyComponent ? (
            <button
              className={componentEditing ? actionButtonClass : subtleButtonClass}
              onClick={onModifyComponent}
            >
              {componentEditing ? "Finish Editing" : "Modify Component"}
            </button>
          ) : null}
          {onDeleteSelection ? (
            <button
              className={subtleButtonClass}
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
              className={subtleButtonClass}
              onClick={onDeleteSelection}
            >
              Delete
            </button>
          ) : null}
        </div>
      )}

      <section>
        <h3 className="font-display text-[11px] uppercase tracking-[0.3em] text-black/40">Position</h3>
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
        <h3 className="font-display text-[11px] uppercase tracking-[0.3em] text-black/40">Scale</h3>
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
        <h3 className="font-display text-[11px] uppercase tracking-[0.3em] text-black/40">Rotation (°)</h3>
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
