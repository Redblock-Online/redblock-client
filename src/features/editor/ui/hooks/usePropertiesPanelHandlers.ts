import { useCallback } from "react";
import { Group, Object3D } from "three";
import type { EditorApp } from "@/features/editor/core";
import type { EditorSelection } from "@/features/editor/types";
import { addComponent } from "@/features/editor/components-system";
import { snapshotFromBlock, snapshotFromWorldObject } from "@/features/editor/core";
import type { GroupMember, HistoryAction } from "./useHistoryStack";

export function usePropertiesPanelHandlers(
  editor: EditorApp,
  selection: EditorSelection,
  components: Array<{ id: string; label: string }>,
  refreshComponents: () => void,
  autoSaveScenario: () => void,
  pushHistory: (entry: HistoryAction) => void
) {
  const handleGroupSelection = useCallback(() => {
    const editingId = editor.getEditingComponentId();
    if (editingId) {
      editor.finishEditingComponent(editingId);
      autoSaveScenario();
      return;
    }
    if (!selection || !Array.isArray(selection)) return;
    const members: GroupMember[] = selection.map((b) => ({ id: b.id, transform: snapshotFromBlock(b) }));
    const res = editor.groupSelection();
    if (res) {
      pushHistory({ type: "group", groupId: res.id, members });
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, pushHistory, selection]);

  const handleUngroupSelection = useCallback(() => {
    if (!selection || Array.isArray(selection)) return;
    const groupId = selection.id;
    const children = (selection.mesh as Group).children as Object3D[];
    const members: GroupMember[] = children.map((child) => {
      const id = (child as Object3D & { userData: { editorId?: string } }).userData?.editorId as string;
      return { id, transform: snapshotFromWorldObject(child) };
    });
    const res = editor.ungroupSelected();
    if (res && members.length > 0) {
      pushHistory({ type: "ungroup", groupId, members });
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, pushHistory, selection]);

  const handleCreateComponent = useCallback(() => {
    if (!selection || Array.isArray(selection)) return;
    const members = editor.getSelectedGroupMembersLocalTransforms();
    if (!members) return;
    const nextIndex = components.length + 1;
    const nextId = `comp-${nextIndex}`;
    const label = `Component ${nextIndex}`;
    addComponent({ id: nextId, label, members });
    editor.createComponentFromSelectedGroup(label, nextId);
    refreshComponents();
    autoSaveScenario();
  }, [autoSaveScenario, components.length, editor, refreshComponents, selection]);

  const handleModifyComponent = useCallback(
    (componentId: string) => {
      if (editor.isComponentEditing(componentId)) {
        editor.finishEditingComponent(componentId);
        autoSaveScenario();
      } else {
        editor.startEditingComponent(componentId);
      }
    },
    [autoSaveScenario, editor]
  );

  return {
    handleGroupSelection,
    handleUngroupSelection,
    handleCreateComponent,
    handleModifyComponent,
  };
}
