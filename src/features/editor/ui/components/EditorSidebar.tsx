import type { ReactElement } from "react";
import type { EditorItem } from "@/features/editor/types";
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
    <aside className="relative z-50 flex w-64 flex-col gap-2 rounded border border-[#1a1a1a] bg-[#383838] p-3 pointer-events-auto overflow-auto">
      <div className="text-[11px] text-[#999999] mb-1">Components</div>
      <ItemMenu
        items={items}
        activeItem={activeItem}
        onItemSelect={onItemSelect}
        onItemDragStart={onItemDragStart}
      />
      {activeItem && activeItem.id.startsWith("component:") ? (
        <div className="mt-4 flex flex-col gap-2">
          <button
            className="h-7 rounded border border-[#1a1a1a] bg-[#ef4444] text-[11px] text-white transition hover:bg-[#dc2626]"
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
