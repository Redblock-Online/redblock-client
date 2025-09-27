import { BlockPreview } from "./BlockPreview";
import type { EditorItem } from "../types";

type ItemMenuProps = {
  items: EditorItem[];
  activeItem: EditorItem | null;
  onItemSelect: (item: EditorItem | null) => void;
  onItemDragStart: (itemId: string) => void;
};

export function ItemMenu({ items, activeItem, onItemSelect, onItemDragStart }: ItemMenuProps): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {items.map((item) => {
        const isActive = activeItem?.id === item.id;
        return (
          <button
            key={item.id}
            type="button"
            draggable
            onDragStart={(event) => {
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
            onClick={() => onItemSelect(isActive ? null : item)}
            className={`group flex flex-col items-center rounded border border-white/10 bg-[#2a2a2a]/90 p-4 text-white/70 transition ${
              isActive ? "border-[#5b8cff] bg-[#2f365f] text-white" : "hover:border-white/40 hover:text-white"
            }`}
          >
            <BlockPreview />
            <span className="mt-3 text-xs uppercase tracking-wide">{item.label}</span>
            <span className="mt-1 text-[10px] uppercase text-white/40 group-hover:text-white/60">
              Drag to place
            </span>
          </button>
        );
      })}
    </div>
  );
}
