import { useCallback, useRef } from "react";
import { Vector3 } from "three";
import type { EditorApp } from "@/features/editor/core";
import type { EditorSelection } from "@/features/editor/types";
import type { ClipboardPayload } from "@/features/editor/types";
import type { HistoryAction } from "./useHistoryStack";

export function useClipboard(
  editor: EditorApp,
  selection: EditorSelection,
  autoSaveScenario: () => void,
  pushHistory: (entry: HistoryAction) => void
) {
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const pasteOffsetRef = useRef(0);

  const copySelection = useCallback(() => {
    const currentSelection = selection
      ? Array.isArray(selection) ? selection : [selection]
      : editor.getSelectionArray();
    if (currentSelection.length === 0) return;
    
    const ids = currentSelection.map((block) => block.id);
    const payload = editor.serializeBlocksByIds(ids);
    if (payload.nodes.length === 0) return;
    
    clipboardRef.current = payload;
    pasteOffsetRef.current = 0;
  }, [editor, selection]);

  const pasteClipboard = useCallback(() => {
    const payload = clipboardRef.current;
    if (!payload || payload.nodes.length === 0) return;
    
    pasteOffsetRef.current += 1;
    const offsetMagnitude = pasteOffsetRef.current * 1.5;
    const offset = new Vector3(offsetMagnitude, 0, offsetMagnitude);
    const created = editor.instantiateSerializedNodes(payload.nodes, payload.componentIds, offset);
    if (created.length > 0) {
      editor.setSelectionByIds(created.map((block) => block.id));
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor]);

  const deleteSelection = useCallback(() => {
    const currentSelection = selection
      ? Array.isArray(selection) ? selection : [selection]
      : editor.getSelectionArray();
    if (currentSelection.length === 0) return;
    
    const ids = currentSelection.map((item) => item.id);
    const payload = editor.serializeBlocksByIds(ids);

    const removedIds: string[] = [];
    ids.forEach((id) => {
      if (editor.removeBlock(id)) {
        removedIds.push(id);
      }
    });

    if (removedIds.length === 0) return;

    if (payload.nodes.length > 0) {
      pushHistory({ type: "delete", ids: removedIds, payload });
    }

    editor.clearSelection();
    clipboardRef.current = null;
    pasteOffsetRef.current = 0;
    autoSaveScenario();
  }, [autoSaveScenario, editor, pushHistory, selection]);

  return {
    copySelection,
    pasteClipboard,
    deleteSelection,
  };
}
