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
    "h-7 rounded border border-[#1a1a1a] bg-[#4772b3] text-[11px] text-white transition hover:bg-[#5a8fd6]";
  const subtleButtonClass =
    "h-7 rounded border border-[#1a1a1a] bg-[#2b2b2b] text-[11px] text-[#cccccc] transition hover:bg-[#404040]";

  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded border border-dashed border-[#1a1a1a] bg-[#2b2b2b] p-4 text-center text-[11px] text-[#666666]">
        <span className="text-[12px] text-[#999999]">Inspector</span>
        <p className="max-w-[220px] text-[11px] leading-relaxed">
          Select an existing block or place a new one to adjust its properties.
        </p>
      </div>
    );
  }

  // Multi selection UI
  if (Array.isArray(selection)) {
    return (
      <div className="flex h-full flex-col gap-3 text-[11px] text-[#cccccc]">
        <div>
          <div className="text-[10px] text-[#999999]">Selection</div>
          <div className="mt-0.5 text-[13px] font-medium text-[#cccccc]">
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
    <div className="flex h-full flex-col gap-3 text-[11px] text-[#cccccc]">
      <div>
        <div className="text-[10px] text-[#999999]">Selection</div>
        <div className="mt-0.5 text-[13px] font-medium text-[#cccccc]">
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
        <h3 className="text-[11px] text-[#999999] mb-1.5">Position</h3>
        <div className="grid grid-cols-3 gap-1.5">
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
        <h3 className="text-[11px] text-[#999999] mb-1.5">Scale</h3>
        <div className="grid grid-cols-3 gap-1.5">
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
        <h3 className="text-[11px] text-[#999999] mb-1.5">Rotation (°)</h3>
        <div className="grid grid-cols-3 gap-1.5">
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
