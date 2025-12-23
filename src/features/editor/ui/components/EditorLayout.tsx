import type { ReactElement } from "react";
import type { EditorSelection, EditorItem } from "@/features/editor/types";
import type { VectorState } from "@/features/editor/types";
import { PropertiesPanel } from "./PropertiesPanel";
import { EditorHeader } from "./EditorHeader";
import { EditorSidebar } from "./EditorSidebar";
import { EditorOverlays } from "./EditorOverlays";
import { DropdownMenu } from "./DropdownMenu";
import type { Alert } from "@/features/editor/core";

interface MenuGroup {
  id: string;
  label: string;
  items: Array<{ id: string; label: string; action: () => void; disabled?: boolean }>;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
}

interface EditorLayoutProps {
  menuGroups: MenuGroup[];
  openMenuId: string | null;
  activeScenarioName: string;
  hasUnsavedChanges: boolean;
  title: string;
  menuAnchors: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  activeMenu: MenuGroup | null;
  menuPosition: MenuPosition | null;
  items: EditorItem[];
  activeItem: EditorItem | null;
  components: Array<{ id: string; label: string }>;
  editingActive: boolean;
  transformLabel: string | null;
  selection: EditorSelection;
  positionState: VectorState;
  scaleState: VectorState;
  rotationState: VectorState;
  isEditingComponent: boolean;
  selectedComponentId: string | null;
  onMenuHover: (menuId: string) => void;
  onMenuLeave: () => void;
  setActiveItem: (item: EditorItem | null) => void;
  setComponentPendingDelete: (value: { id: string; label: string }) => void;
  handlePositionChange: (updater: React.SetStateAction<VectorState>) => void;
  handleScaleChange: (updater: React.SetStateAction<VectorState>) => void;
  handleRotationChange: (updater: React.SetStateAction<VectorState>) => void;
  handleGroupSelection: () => void;
  handleUngroupSelection: () => void;
  handleCreateComponent: () => void;
  handleModifyComponent: (id: string) => void;
  deleteSelection: () => void;
  renameSelection?: (id: string, newName: string) => void;
  setTyping?: (typing: boolean) => void;
  alerts: Alert[];
}

export function EditorLayout(props: EditorLayoutProps): ReactElement {
  const inspectorVisible = props.selection !== null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col text-[#cccccc]">
      <EditorHeader
        menuGroups={props.menuGroups}
        openMenuId={props.openMenuId}
        activeScenarioName={props.activeScenarioName}
        hasUnsavedChanges={props.hasUnsavedChanges}
        title={props.title}
        menuAnchors={props.menuAnchors}
        onMenuHover={props.onMenuHover}
        onMenuLeave={props.onMenuLeave}
        alerts={props.alerts}
      />
      <DropdownMenu 
        menu={props.activeMenu} 
        position={props.menuPosition} 
        onClose={props.onMenuLeave}
        onMouseEnter={() => props.onMenuHover(props.openMenuId ?? "")}
        onMouseLeave={props.onMenuLeave}
      />
      <div className="flex flex-1 overflow-hidden px-3 pb-3 pt-3 gap-3">
        <EditorSidebar
          items={props.items}
          activeItem={props.activeItem}
          components={props.components}
          onItemSelect={props.setActiveItem}
          onItemDragStart={(itemId) => props.setActiveItem(props.items.find((e) => e.id === itemId) ?? null)}
          onDeleteComponent={(id, label) => props.setComponentPendingDelete({ id, label })}
        />
        <EditorOverlays activeItem={props.activeItem} editingActive={props.editingActive} transformLabel={props.transformLabel} />
        <aside
          className={`
            relative z-50 w-80 rounded-lg border border-[#2a2a2a] 
            bg-gradient-to-b from-[#3a3a3a] to-[#353535] p-4 
            shadow-xl transition-all duration-300 ease-out
            ${inspectorVisible 
              ? "pointer-events-auto opacity-100 translate-x-0" 
              : "pointer-events-none opacity-30 translate-x-2"
            }
          `}
        >
          <div className="flex items-center gap-2 mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4772b3]">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span className="text-[12px] font-semibold text-[#e0e0e0] tracking-tight">Inspector</span>
            <kbd className="ml-auto px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[9px] text-[#666666]">I to hide</kbd>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[#4a4a4a] to-transparent mb-4" />
          <PropertiesPanel
            selection={props.selection}
            positionState={props.positionState}
            scaleState={props.scaleState}
            rotationState={props.rotationState}
            onPositionChange={props.handlePositionChange}
            onScaleChange={props.handleScaleChange}
            onRotationChange={props.handleRotationChange}
            onGroupSelection={props.handleGroupSelection}
            onUngroupSelection={props.handleUngroupSelection}
            onCreateComponent={props.handleCreateComponent}
            onModifyComponent={props.selectedComponentId ? () => props.handleModifyComponent(props.selectedComponentId!) : undefined}
            componentEditing={props.isEditingComponent}
            onDeleteSelection={props.deleteSelection}
            onRenameSelection={props.renameSelection}
            setTyping={props.setTyping}
          />
        </aside>
      </div>
    </div>
  );
}
