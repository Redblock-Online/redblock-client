import { BlockPreview } from "./BlockPreview";
import type { EditorItem } from "@/features/editor/types";
import type { ReactElement } from "react";

type ItemMenuProps = {
  items: EditorItem[];
  activeItem: EditorItem | null;
  onItemSelect: (item: EditorItem | null) => void;
  onItemDragStart: (itemId: string) => void;
  disabledItems?: string[];
};

export function ItemMenu({ items, activeItem, onItemSelect, onItemDragStart, disabledItems = [] }: ItemMenuProps): ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-2">
      {items.map((item) => {
        const isActive = activeItem?.id === item.id;
        const isDisabled = disabledItems.includes(item.id);
        const isComponent = item.id.startsWith("component:");
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
            className={`
              group relative flex flex-col items-center gap-2 rounded-lg border p-3 
              transition-all duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-[#4772b3]/50
              ${isDisabled
                ? "cursor-not-allowed border-[#1a1a1a] bg-[#2b2b2b] opacity-40"
                : isActive
                  ? "border-[#4772b3] bg-gradient-to-b from-[#3a4a5a] to-[#2d3d4d] text-white shadow-lg shadow-[#4772b3]/20 scale-[1.02]"
                  : "border-[#2a2a2a] bg-[#2d2d2d] hover:bg-[#363636] hover:border-[#3a3a3a] hover:shadow-md"
              }
            `}
          >
            {isActive && (
              <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-[#4772b3]/10 to-transparent pointer-events-none" />
            )}
            <div className={`relative transition-transform duration-200 ${isActive ? "scale-105" : "group-hover:scale-102"}`}>
              <BlockPreview item={item} />
            </div>
            <div className="flex items-center gap-1.5">
              {isComponent && (
                <svg 
                  width="11" 
                  height="11" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#ff4dff" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className={`transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              )}
              <span
                className={`text-[11px] font-medium transition-colors duration-200 ${
                  isActive ? "text-white" : "text-[#cccccc] group-hover:text-white"
                }`}
              >
                {item.label}
              </span>
            </div>
            <div className={`
              flex items-center gap-1 text-[9px] transition-all duration-200
              ${isActive ? "text-[#8ab4f8]" : "text-[#666666] group-hover:text-[#888888]"}
            `}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>Drag to place</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
