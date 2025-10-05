import type { ReactElement } from "react";
import type { EditorSelection, EditorItem } from "../types";
import type { VectorState } from "../types/editorTypes";
import { PropertiesPanel } from "./PropertiesPanel";
import { EditorHeader } from "./EditorHeader";
import { EditorSidebar } from "./EditorSidebar";
import { EditorOverlays } from "./EditorOverlays";
import { DropdownMenu } from "./DropdownMenu";

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
  onMenuClick: (menuId: string) => void;
  closeMenus: () => void;
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
}

export function EditorLayout(props: EditorLayoutProps): ReactElement {
  const inspectorVisible = props.selection !== null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col text-rb-text">
      <EditorHeader
        menuGroups={props.menuGroups}
        openMenuId={props.openMenuId}
        activeScenarioName={props.activeScenarioName}
        hasUnsavedChanges={props.hasUnsavedChanges}
        title={props.title}
        menuAnchors={props.menuAnchors}
        onMenuClick={props.onMenuClick}
        closeMenus={props.closeMenus}
      />
      <DropdownMenu menu={props.activeMenu} position={props.menuPosition} onClose={props.closeMenus} />
      <div className="flex flex-1 overflow-hidden">
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
          className={`relative z-50 w-72 border-l border-rb-border bg-rb-panel p-4 transition-opacity outline outline-3 outline-rb-border overflow-auto ${
            inspectorVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-40"
          }`}
        >
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
          />
        </aside>
      </div>
    </div>
  );
}
