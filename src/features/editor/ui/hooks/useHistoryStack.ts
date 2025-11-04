import { useCallback, useRef } from "react";
import type { EditorApp } from "@/features/editor/core";
import type { SelectionTransform, SerializedNode } from "@/features/editor/types";

export type GroupMember = {
  id: string;
  transform: SelectionTransform;
};

export type HistoryAction =
  | { type: "add"; id: string; transform: SelectionTransform; node?: SerializedNode }
  | { type: "transform"; id: string; before: SelectionTransform; after: SelectionTransform }
  | { type: "group"; groupId: string; members: GroupMember[] }
  | { type: "ungroup"; groupId: string; members: GroupMember[] }
  | {
      type: "multi-transform";
      entries: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }>;
    }
  | {
      type: "delete";
      ids: string[];
      payload: { nodes: SerializedNode[]; componentIds: string[] };
      restoredIds?: string[];
    };

export function useHistoryStack(
  editor: EditorApp,
  applyTransformSnapshot: (id: string, transform: SelectionTransform) => void,
  onChange?: () => void,
): {
  pushHistory: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
} {
  const undoStack = useRef<HistoryAction[]>([]);
  const redoStack = useRef<HistoryAction[]>([]);

  const pushHistory = useCallback((action: HistoryAction) => {
    undoStack.current.push(action);
    redoStack.current = [];
    onChange?.();
  }, [onChange]);

  const undo = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) {
      return;
    }

    if (action.type === "add") {
      editor.removeBlock(action.id);
    } else if (action.type === "transform") {
      applyTransformSnapshot(action.id, action.before);
    } else if (action.type === "group") {
      editor.removeBlock(action.groupId);
      for (const member of action.members) {
        editor.createBlock({
          id: member.id,
          position: member.transform.position,
          rotation: member.transform.rotation,
          scale: member.transform.scale,
        });
      }
      editor.setSelectionByIds(action.members.map((member) => member.id));
    } else if (action.type === "ungroup") {
      editor.groupByIds(action.members.map((member) => member.id), action.groupId);
    } else if (action.type === "multi-transform") {
      for (const entry of action.entries) {
        applyTransformSnapshot(entry.id, entry.before);
      }
      editor.setSelectionByIds(action.entries.map((entry) => entry.id));
    } else if (action.type === "delete") {
      const created = editor.instantiateSerializedNodes(action.payload.nodes, action.payload.componentIds);
      const restoredIds = created.map((block) => block.id);
      action.restoredIds = restoredIds;
      if (restoredIds.length > 0) {
        editor.setSelectionByIds(restoredIds);
      } else {
        editor.clearSelection();
      }
    }

    redoStack.current.push(action);
    onChange?.();
  }, [editor, applyTransformSnapshot, onChange]);

  const redo = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) {
      return;
    }

    if (action.type === "add") {
      // If we have the full node data, use it to restore the block completely
      if (action.node) {
        const restored = editor.instantiateSerializedNodes([action.node], []);
        if (restored.length > 0) {
          editor.setSelectionByIds([restored[0].id]);
        }
      } else {
        // Fallback to simple block creation (for backwards compatibility)
        editor.createBlock({
          id: action.id,
          position: action.transform.position,
          rotation: action.transform.rotation,
          scale: action.transform.scale,
        });
      }
    } else if (action.type === "transform") {
      applyTransformSnapshot(action.id, action.after);
    } else if (action.type === "group") {
      editor.groupByIds(action.members.map((member) => member.id), action.groupId);
    } else if (action.type === "ungroup") {
      editor.setSelectionByIds([action.groupId]);
      editor.ungroupSelected();
    } else if (action.type === "multi-transform") {
      for (const entry of action.entries) {
        applyTransformSnapshot(entry.id, entry.after);
      }
      editor.setSelectionByIds(action.entries.map((entry) => entry.id));
    } else if (action.type === "delete") {
      const idsToRemove = action.restoredIds ?? action.ids;
      idsToRemove.forEach((id) => editor.removeBlock(id));
      editor.clearSelection();
    }

    undoStack.current.push(action);
    onChange?.();
  }, [editor, applyTransformSnapshot, onChange]);

  return { pushHistory, undo, redo };
}
