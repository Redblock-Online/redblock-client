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
        <div className=" left-4 top-4 flex max-w-md flex-col gap-1.5 rounded border border-[#1a1a1a] bg-[#323232]/95 px-3 py-2.5 text-[11px] text-[#cccccc]">
          <span className="text-[10px] text-[#999999] mb-0.5">
            Controls
          </span>
          <span className="leading-relaxed text-[10px]">Orbit with right click · Pan with Shift + right click · Zoom with scroll</span>
          <span className="leading-relaxed text-[10px]">
            Select with left click · Move (G) · Rotate (R) · Scale (F) · constrain with X / Y / Z
          </span>
          <span className="leading-relaxed text-[10px]">Move camera with WASD</span>
          {transformLabel ? (
            <span className="mt-1 w-fit rounded border border-[#1a1a1a] bg-[#4772b3] px-2.5 py-1 text-[10px] text-white">
              {transformLabel}
            </span>
          ) : null}
        </div>
        {activeItem ? (
          <div className="absolute bottom-4 left-1/2 w-max -translate-x-1/2 rounded border border-[#1a1a1a] bg-[#323232]/95 px-4 py-2 text-[11px] text-[#cccccc]">
            Drag the {activeItem.label.toLowerCase()} from the components panel onto the canvas to place it
          </div>
        ) : null}
        {editingActive ? (
          <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded border border-[#1a1a1a] bg-[#4772b3] px-4 py-2 text-[11px] text-white">
            Press Enter to finish editing the component
          </div>
        ) : null}
      </div>
    </main>
  );
}
