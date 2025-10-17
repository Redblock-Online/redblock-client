import type { ReactElement } from "react";
import type { EditorItem } from "../types";

interface EditorOverlaysProps {
  activeItem: EditorItem | null;
  editingActive: boolean;
  transformLabel: string | null;
}

export function EditorOverlays({ activeItem, editingActive, transformLabel }: EditorOverlaysProps): ReactElement {
  return (
    <main className="pointer-events-none relative flex-1">
      <div className="pointer-events-none absolute inset-0">
        <div className=" left-8 top-8 flex max-w-md flex-col gap-2 rounded-lg border border-white/60 bg-white/80 px-5 py-4 text-[11px] text-black/60 shadow-[0_18px_35px_rgba(15,23,42,0.12)] backdrop-blur">
          <span className="font-display text-[11px] uppercase tracking-[0.3em] text-black/40">
            Controls
          </span>
          <span className="leading-relaxed">Orbit with right click · Pan with Shift + right click · Zoom with scroll</span>
          <span className="leading-relaxed">
            Select with left click · Move (G) · Rotate (R) · Scale (F) · constrain with X / Y / Z
          </span>
          <span className="leading-relaxed">Move camera with WASD</span>
          {transformLabel ? (
            <span className="mt-2 w-fit rounded-md border border-black/10 bg-black px-3 py-1 text-[10px] font-display uppercase tracking-[0.32em] text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)]">
              {transformLabel}
            </span>
          ) : null}
        </div>
        {activeItem ? (
          <div className="absolute bottom-8 left-1/2 w-max -translate-x-1/2 rounded-lg border border-white/60 bg-white/85 px-6 py-3 text-[11px] font-display uppercase tracking-[0.32em] text-black/50 shadow-[0_16px_30px_rgba(15,23,42,0.1)] backdrop-blur">
            Drag the {activeItem.label.toLowerCase()} from the components panel onto the canvas to place it
          </div>
        ) : null}
        {editingActive ? (
          <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-black/20 bg-black px-6 py-3 text-[11px] font-display uppercase tracking-[0.32em] text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]">
            Press Enter to finish editing the component
          </div>
        ) : null}
      </div>
    </main>
  );
}
