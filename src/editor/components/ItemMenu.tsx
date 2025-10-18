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
    <div className="flex flex-1 flex-col gap-1.5">
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
            className={`group flex flex-col items-center gap-1.5 rounded border p-2.5 text-[#cccccc] transition ${
              isDisabled
                ? "cursor-not-allowed border-[#1a1a1a] bg-[#2b2b2b] opacity-50"
                : isActive
                  ? "border-[#4772b3] bg-[#2b2b2b] text-white"
                  : "border-[#1a1a1a] bg-[#2b2b2b] hover:bg-[#353535]"
            }`}
          >
            <BlockPreview item={item} />
            <span
              className={`text-[11px] ${
                isActive ? "text-white" : "text-[#cccccc] group-hover:text-white"
              }`}
            >
              {item.label}
            </span>
            <span
              className={`text-[9px] ${
                isActive ? "text-[#999999]" : "text-[#666666] group-hover:text-[#999999]"
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
