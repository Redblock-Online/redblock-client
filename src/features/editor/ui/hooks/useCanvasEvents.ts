import { useEffect } from "react";
import type { EditorApp } from "@/features/editor/core";
import type { EditorBlock, EditorItem, SelectionTransform } from "@/features/editor/types";
import { getComponent } from "@/features/editor/components-system";
import type { TransformMode } from "./useTransformSession";
import type { HistoryAction } from "./useHistoryStack";

const builtinItems: EditorItem[] = [{ id: "block", label: "Block", category: "primitive" }];

interface UseCanvasEventsProps {
  editor: EditorApp;
  transformMode: TransformMode | null;
  editingActive: boolean;
  selectedItemRef: React.MutableRefObject<EditorItem | null>;
  finishTransform: (commit: boolean) => void;
  updatePointerDelta: (dx: number, dy: number) => void;
  pushHistory: (entry: HistoryAction) => void;
  autoSaveScenario: () => void;
  setActiveItem: (item: EditorItem | null) => void;
  applyTransformToState: (transform: SelectionTransform | null) => void;
}

export function useCanvasEvents({
  editor,
  transformMode,
  editingActive,
  selectedItemRef,
  finishTransform,
  updatePointerDelta,
  pushHistory,
  autoSaveScenario,
  setActiveItem,
  applyTransformToState,
}: UseCanvasEventsProps) {
  // Canvas pointer events
  useEffect(() => {
    const canvas = editor.getCanvas();

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (transformMode) {
        event.preventDefault();
        finishTransform(true);
        return;
      }

      const additive = (event.ctrlKey ?? false) || (event.metaKey ?? false);
      const picked = editor.pickBlock(event.clientX, event.clientY, additive);
      if (picked && selectedItemRef.current) {
        setActiveItem(null);
      }
      editor.clearMovementState?.();
    };

    const handleDragOver = (event: DragEvent) => {
      if (editingActive) return;
      if (!selectedItemRef.current) {
        const hasBlock = event.dataTransfer?.types.includes("text/plain");
        if (!hasBlock) return;
      }
      event.preventDefault();
      event.dataTransfer!.dropEffect = "copy";
    };

    const handleDrop = (event: DragEvent) => {
      if (editingActive) {
        event.preventDefault();
        return;
      }
      const data = event.dataTransfer?.getData("text/plain");
      if (!data) return;
      event.preventDefault();
      
      let placed: EditorBlock | null = null;
      if (data === "block") {
        placed = editor.placeBlockAt(event.clientX, event.clientY);
      } else if (data.startsWith("component:")) {
        const id = data.slice("component:".length);
        const def = getComponent(id);
        if (def) placed = editor.placeComponentAt(event.clientX, event.clientY, def);
      }
      
      if (placed) {
        const t = editor.getSelectionTransform();
        if (t) pushHistory({ type: "add", id: placed.id, transform: t });
        autoSaveScenario();
      }
      setActiveItem(builtinItems[0]);
      editor.clearMovementState?.();
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("drop", handleDrop);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("drop", handleDrop);
    };
  }, [autoSaveScenario, editor, finishTransform, editingActive, pushHistory, transformMode, selectedItemRef, setActiveItem]);

  // Pointer move for transform
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!transformMode) return;
      event.preventDefault();
      updatePointerDelta(event.movementX, event.movementY);
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [transformMode, updatePointerDelta]);

  // Pointer up listener
  useEffect(() => {
    const removeListener = editor.addPointerUpListener((event, context) => {
      if (event.type !== "pointerup" || event.button !== 0) return;
      if (context.dragged) return;
      if (transformMode) finishTransform(true);
    });
    return removeListener;
  }, [editor, finishTransform, transformMode]);

  // Drag commit listener
  useEffect(() => {
    const removeListener = editor.addDragCommitListener((changes) => {
      if (changes.length === 0) return;
      if (changes.length === 1) {
        const [entry] = changes;
        pushHistory({ type: "transform", id: entry.id, before: entry.before, after: entry.after });
        applyTransformToState(entry.after);
      } else {
        pushHistory({ type: "multi-transform", entries: changes });
        applyTransformToState(changes[0]?.after ?? null);
      }
    });
    return removeListener;
  }, [applyTransformToState, editor, pushHistory]);
}
