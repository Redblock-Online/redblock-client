import { BlockPreview } from "./BlockPreview";
import type { EditorItem } from "../types";

type ItemMenuProps = {
  items: EditorItem[];
  activeItem: EditorItem | null;
  onItemSelect: (item: EditorItem | null) => void;
  onItemDragStart: (itemId: string) => void;
  disabledItems?: string[];
};

import type { ReactElement } from "react";

export function ItemMenu({ items, activeItem, onItemSelect, onItemDragStart, disabledItems = [] }: ItemMenuProps): ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {items.map((item) => {
        const isActive = activeItem?.id === item.id;
        const isDisabled = disabledItems.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            draggable={!isDisabled}
            disabled={isDisabled}
            onDragStart={(event) => {
              if (isDisabled) {
                event.preventDefault();
                return;
              }
              event.dataTransfer?.setData("text/plain", item.id);
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "copy";
              }

              const dragGhost = event.currentTarget.cloneNode(true) as HTMLElement;
              dragGhost.style.position = "absolute";
              dragGhost.style.top = "-9999px";
              dragGhost.style.left = "-9999px";
              dragGhost.style.pointerEvents = "none";
              dragGhost.style.opacity = "0.9";
              document.body.appendChild(dragGhost);

              const { width, height } = dragGhost.getBoundingClientRect();
              event.dataTransfer?.setDragImage(dragGhost, width / 2, height / 2);

              requestAnimationFrame(() => {
                document.body.removeChild(dragGhost);
              });

              onItemDragStart(item.id);
            }}
            onClick={() => !isDisabled && onItemSelect(isActive ? null : item)}
            className={`group flex flex-col items-center gap-2 rounded-lg border p-4 text-black/60 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/80 ${
              isDisabled
                ? "cursor-not-allowed border-black/5 bg-black/5 opacity-50"
                : isActive
                  ? "border-black bg-black text-white shadow-[0_16px_32px_rgba(15,23,42,0.22)]"
                  : "border-white/60 bg-white/90 hover:-translate-y-[3px] hover:shadow-[0_18px_35px_rgba(15,23,42,0.18)]"
            }`}
          >
            <BlockPreview item={item} />
            <span
              className={`font-display text-xs uppercase tracking-[0.32em] ${
                isActive ? "text-white/80" : "text-black/60 group-hover:text-black"
              }`}
            >
              {item.label}
            </span>
            <span
              className={`text-[10px] uppercase tracking-[0.28em] ${
                isActive ? "text-white/50" : "text-black/30 group-hover:text-black/60"
              }`}
            >
              Drag to place
            </span>
          </button>
        );
      })}
    </div>
  );
}
