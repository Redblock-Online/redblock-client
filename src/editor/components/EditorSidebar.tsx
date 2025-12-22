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
    <aside className="relative z-50 flex w-72 flex-col gap-3 rounded-lg border border-[#2a2a2a] bg-gradient-to-b from-[#3a3a3a] to-[#353535] p-4 pointer-events-auto overflow-auto shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4772b3]">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span className="text-[12px] font-semibold text-[#e0e0e0] tracking-tight">Components</span>
        </div>
        <span className="text-[10px] text-[#666666] bg-[#2a2a2a] px-2 py-0.5 rounded-full">
          {items.length} items
        </span>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-[#4a4a4a] to-transparent" />
      <ItemMenu
        items={items}
        activeItem={activeItem}
        onItemSelect={onItemSelect}
        onItemDragStart={onItemDragStart}
      />
      {activeItem && activeItem.id.startsWith("component:") && (
        <div className="mt-2 pt-3 border-t border-[#2a2a2a]">
          <button
            className="
              w-full h-9 rounded-md border border-red-500/30 
              bg-gradient-to-r from-red-600/90 to-red-500/90
              text-[11px] font-medium text-white 
              transition-all duration-200 
              hover:from-red-500 hover:to-red-400 hover:shadow-lg hover:shadow-red-500/20
              active:scale-[0.98]
              flex items-center justify-center gap-2
            "
            onClick={() => {
              const id = activeItem.id.slice("component:".length);
              const def = components.find((entry) => entry.id === id);
              onDeleteComponent(id, def?.label ?? "Component");
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            Remove Component
          </button>
        </div>
      )}
    </aside>
  );
}
