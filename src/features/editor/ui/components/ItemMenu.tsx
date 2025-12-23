import { BlockPreview } from "./BlockPreview";
import type { EditorItem } from "../../types";

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
            className={`group flex flex-col items-center gap-2 rounded-lg border p-3 transition-all duration-150 ${
              isDisabled
                ? "cursor-not-allowed border-editor-border bg-editor-surface opacity-50"
                : isActive
                  ? "border-editor-accent bg-editor-hover shadow-sm"
                  : "border-editor-border bg-white hover:bg-editor-surface hover:border-editor-accent/50 hover:shadow-sm"
            }`}
          >
            <BlockPreview item={item} />
            <div className="flex items-center gap-1.5">
              {isComponent && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isActive ? "opacity-100" : "opacity-70"}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              )}
              <span
                className={`text-editor-sm font-medium ${
                  isActive ? "text-editor-accent" : "text-editor-text"
                }`}
              >
                {item.label}
              </span>
            </div>
            <span className="text-editor-xs text-editor-muted">
              Drag to place
            </span>
          </button>
        );
      })}
    </div>
  );
}