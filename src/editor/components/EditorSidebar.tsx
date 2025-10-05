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
    <aside className="relative z-50 flex w-64 flex-col border-r border-rb-border bg-rb-panel p-4 outline outline-3 outline-rb-border pointer-events-auto overflow-auto">
      <div className="mb-4 text-xs uppercase text-rb-muted">Components</div>
      <ItemMenu
        items={items}
        activeItem={activeItem}
        onItemSelect={onItemSelect}
        onItemDragStart={onItemDragStart}
      />
      {activeItem && activeItem.id.startsWith("component:") ? (
        <div className="mt-4 flex flex-col gap-2">
          <button
            className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
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
