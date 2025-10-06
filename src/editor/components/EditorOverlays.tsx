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
        <div className="absolute left-6 top-6 flex flex-col gap-1 rounded border border-rb-border bg-white/80 px-3 py-2 text-xs text-rb-muted shadow-sm outline outline-3 outline-rb-border">
          <span>Orbit with right click · Pan with Shift + right click · Zoom with scroll</span>
          <span>Select with left click · Move (G) · Rotate (R) · Scale (F) · constrain with X / Y / Z</span>
          <span>Move camera with WASD</span>
          {transformLabel ? (
            <span className="mt-1 rounded border border-rb-border bg-rb-panel px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-rb-muted outline outline-3 outline-rb-border">
              {transformLabel}
            </span>
          ) : null}
        </div>
        {activeItem ? (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded border border-rb-border bg-white/90 px-4 py-2 text-xs text-rb-muted outline outline-3 outline-rb-border">
            Drag the {activeItem.label.toLowerCase()} from the components panel onto the canvas to place it
          </div>
        ) : null}
        {editingActive ? (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded border border-rb-border bg-black/80 px-4 py-2 text-xs font-semibold text-white outline outline-3 outline-rb-border z-20">
            Press Enter to finish editing the component
          </div>
        ) : null}
      </div>
    </main>
  );
}
