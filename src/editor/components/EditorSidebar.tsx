import type { ReactElement } from "react";
import type { EditorItem } from "../types";
import { ItemMenu } from "./ItemMenu";

interface EditorSidebarProps {
  items: EditorItem[];
  activeItem: EditorItem | null;
  components: Array<{ id: string; label: string }>;
  onItemSelect: (item: EditorItem | null) => void;
  onItemDragStart: (itemId: string) => void;
  onDeleteComponent: (id: string, label: string) => void;
}

export function EditorSidebar({
  items,
  activeItem,
  components,
  onItemSelect,
  onItemDragStart,
  onDeleteComponent,
}: EditorSidebarProps): ReactElement {
  return (
    <aside className="relative z-50 flex w-72 flex-col gap-4 rounded-xl border border-white/60 bg-white/80 p-6 shadow-[0_18px_35px_rgba(15,23,42,0.12)] backdrop-blur pointer-events-auto overflow-auto">
      <div className="font-display text-xs uppercase tracking-[0.4em] text-black/45">Components</div>
      <ItemMenu
        items={items}
        activeItem={activeItem}
        onItemSelect={onItemSelect}
        onItemDragStart={onItemDragStart}
      />
      {activeItem && activeItem.id.startsWith("component:") ? (
        <div className="mt-4 flex flex-col gap-2">
          <button
            className="h-10 rounded-lg border border-black/10 bg-black text-xs font-display uppercase tracking-[0.28em] text-white transition hover:-translate-y-[2px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
            onClick={() => {
              const id = activeItem.id.slice("component:".length);
              const def = components.find((entry) => entry.id === id);
              onDeleteComponent(id, def?.label ?? "Component");
            }}
          >
            Remove Component
          </button>
        </div>
      ) : null}
    </aside>
  );
}
