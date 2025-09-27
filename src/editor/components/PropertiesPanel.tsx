import type { Dispatch, SetStateAction } from "react";
import type { EditorBlock } from "../EditorApp";

type VectorState = { x: number; y: number; z: number };

type PropertiesPanelProps = {
  selection: EditorBlock | null;
  positionState: VectorState;
  scaleState: VectorState;
  rotationState: VectorState;
  onPositionChange: Dispatch<SetStateAction<VectorState>>;
  onScaleChange: Dispatch<SetStateAction<VectorState>>;
  onRotationChange: Dispatch<SetStateAction<VectorState>>;
};

export function PropertiesPanel({
  selection,
  positionState,
  scaleState,
  rotationState,
  onPositionChange,
  onScaleChange,
  onRotationChange,
}: PropertiesPanelProps): JSX.Element {
  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-xs text-white/50">
        <span className="text-sm font-semibold text-white/60">Inspector</span>
        <p className="mt-3 max-w-[200px] text-white/40">
          Select an existing block or place a new one to adjust its properties.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 text-xs">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/40">Selection</div>
        <div className="mt-1 text-sm font-semibold text-white">{selection.id}</div>
      </div>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Position</h3>
        <div className="mt-3 flex flex-col gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} className="flex items-center justify-between gap-3">
              <span className="w-6 text-[11px] uppercase text-white/50">{axis}</span>
              <input
                type="number"
                value={Number(positionState[axis].toFixed(2))}
                step={0.1}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  onPositionChange((prev) => ({ ...prev, [axis]: Number.isNaN(value) ? prev[axis] : value }));
                }}
                className="h-8 w-24 rounded border border-white/10 bg-[#2a2a2a] px-2 text-right text-white"
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Scale</h3>
        <div className="mt-3 flex flex-col gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} className="flex items-center justify-between gap-3">
              <span className="w-6 text-[11px] uppercase text-white/50">{axis}</span>
              <input
                type="number"
                value={Number(scaleState[axis].toFixed(2))}
                min={0.1}
                step={0.1}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  onScaleChange((prev) => ({ ...prev, [axis]: Number.isNaN(value) ? prev[axis] : value }));
                }}
                className="h-8 w-24 rounded border border-white/10 bg-[#2a2a2a] px-2 text-right text-white"
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Rotation (°)</h3>
        <div className="mt-3 flex flex-col gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} className="flex items-center justify-between gap-3">
              <span className="w-6 text-[11px] uppercase text-white/50">{axis}</span>
              <input
                type="number"
                value={Number(rotationState[axis].toFixed(1))}
                step={1}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  onRotationChange((prev) => ({ ...prev, [axis]: Number.isNaN(value) ? prev[axis] : value }));
                }}
                className="h-8 w-24 rounded border border-white/10 bg-[#2a2a2a] px-2 text-right text-white"
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
