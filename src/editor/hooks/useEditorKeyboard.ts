import { useEffect } from "react";
import type EditorApp from "../EditorApp";
import type { EditorSelection, EditorItem } from "../types";
import type { AxisConstraint, TransformMode } from "./useTransformSession";

interface UseEditorKeyboardProps {
  editor: EditorApp;
  selection: EditorSelection;
  transformMode: TransformMode | null;
  autoSaveScenario: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  deleteSelection: () => void;
  finishTransform: (commit: boolean) => void;
  startTransform: (mode: TransformMode) => void;
  toggleAxis: (axis: Exclude<AxisConstraint, null>) => void;
  undo: () => void;
  redo: () => void;
  setActiveItem: (item: EditorItem | null) => void;
  handleSaveCurrentScenario: () => void;
}

export function useEditorKeyboard({
  editor,
  selection,
  transformMode,
  autoSaveScenario,
  copySelection,
  pasteClipboard,
  deleteSelection,
  handleSaveCurrentScenario,
  finishTransform,
  startTransform,
  toggleAxis,
  undo,
  redo,
  setActiveItem,
}: UseEditorKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (event.key === "Escape") {
        if (transformMode) {
          event.preventDefault();
          finishTransform(false);
          return;
        }
        setActiveItem(null);
        editor.clearSelection();
        return;
      }

      const key = event.key.toLowerCase();
      const meta = event.metaKey;
      const ctrl = event.ctrlKey;

      if ((meta || ctrl) && key === "c") {
        event.preventDefault();
        copySelection();
        return;
      }

      if ((meta || ctrl) && key === "v") {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if ((meta || ctrl) && key === "s") {
        event.preventDefault();
        handleSaveCurrentScenario();
        return;
      }

      if (event.key === "Enter") {
        const editingId = editor.getEditingComponentId();
        if (editingId) {
          event.preventDefault();
          editor.finishEditingComponent(editingId);
          autoSaveScenario();
          return;
        }
      }

      const isMac = navigator.platform.toLowerCase().includes("mac");
      const shift = event.shiftKey;
      if ((ctrl && key === "z") || (isMac && meta && key === "z" && !shift)) {
        event.preventDefault();
        undo();
        return;
      }
      if ((ctrl && key === "y") || (isMac && meta && key === "z" && shift)) {
        event.preventDefault();
        redo();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && (selection || editor.getSelectionArray().length > 0)) {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (transformMode) {
        if (key === "x" || key === "y" || key === "z") {
          event.preventDefault();
          toggleAxis(key as Exclude<AxisConstraint, null>);
          return;
        }
        if (event.key === "Enter" || event.key === "Return" || event.key === " ") {
          event.preventDefault();
          finishTransform(true);
          return;
        }
      }

      if (!transformMode && editor.isDraggingBlock()) {
        if (key === "x" || key === "y" || key === "z") {
          event.preventDefault();
          editor.toggleDragAxis(key as "x" | "y" | "z");
          return;
        }
      }

      if (key === "g" || key === "r" || key === "f") {
        const hasSelection = editor.getSelection() !== null || editor.getSelectionArray().length > 0;
        if (!hasSelection) return;
        event.preventDefault();
        const mode: TransformMode = key === "g" ? "translate" : key === "r" ? "rotate" : "scale";
        startTransform(mode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    autoSaveScenario,
    copySelection,
    deleteSelection,
    editor,
    finishTransform,
    handleSaveCurrentScenario,
    pasteClipboard,
    selection,
    startTransform,
    transformMode,
    toggleAxis,
    undo,
    redo,
    setActiveItem,
  ]);
}
