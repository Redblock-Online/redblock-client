import { useCallback, useEffect, useRef } from "react";
import type { SelectionTransform } from "@/features/editor/types";
import { EditorHistory, type HistoryAction, type HistoryEditor } from "@/features/editor/core/EditorHistory";

export type { HistoryAction } from "@/features/editor/core/EditorHistory";

/**
 * React wrapper around {@link EditorHistory}.
 *
 * @param onChange - Called after every push/undo/redo (autosave, validation, UI refresh)
 */
export function useHistoryStack(
  editor: HistoryEditor,
  applyTransformSnapshot: (id: string, transform: SelectionTransform) => void,
  onChange?: () => void,
): {
  pushHistory: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
} {
  // Keep the latest callbacks without recreating the history (which would drop its stacks)
  const applyRef = useRef(applyTransformSnapshot);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    applyRef.current = applyTransformSnapshot;
    onChangeRef.current = onChange;
  }, [applyTransformSnapshot, onChange]);

  const historyRef = useRef<EditorHistory | null>(null);
  if (historyRef.current === null) {
    historyRef.current = new EditorHistory(editor, (id, transform) => applyRef.current(id, transform));
  }

  const pushHistory = useCallback((action: HistoryAction) => {
    historyRef.current?.push(action);
    onChangeRef.current?.();
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current?.undo()) {
      onChangeRef.current?.();
    }
  }, []);

  const redo = useCallback(() => {
    if (historyRef.current?.redo()) {
      onChangeRef.current?.();
    }
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current?.clear();
  }, []);

  return { pushHistory, undo, redo, clearHistory };
}
