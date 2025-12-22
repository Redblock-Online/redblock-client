import { useEffect } from "react";
import { Vector3, Euler } from "three";
import type { EditorApp } from "@/features/editor/core";
import type { EditorSelection } from "@/features/editor/types";
import type { VectorState } from "@/features/editor/types";
import type { TransformMode } from "./useTransformSession";

export function useTransformSync(
  editor: EditorApp,
  selection: EditorSelection,
  transformMode: TransformMode | null,
  positionState: VectorState,
  scaleState: VectorState,
  rotationState: VectorState,
  panelAutoSavePendingRef: React.MutableRefObject<boolean>,
  autoSaveScenario: () => void
) {
  // Sync position changes to editor
  useEffect(() => {
    if (!selection || Array.isArray(selection)) return;
    if (transformMode) return;
    editor.updateSelectedBlockPosition(new Vector3(positionState.x, positionState.y, positionState.z));
    if (panelAutoSavePendingRef.current) {
      panelAutoSavePendingRef.current = false;
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, positionState, selection, transformMode, panelAutoSavePendingRef]);

  // Sync scale changes to editor
  useEffect(() => {
    if (!selection || Array.isArray(selection)) return;
    if (transformMode) return;
    editor.updateSelectedBlockScale(new Vector3(scaleState.x, scaleState.y, scaleState.z));
    if (panelAutoSavePendingRef.current) {
      panelAutoSavePendingRef.current = false;
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, scaleState, selection, transformMode, panelAutoSavePendingRef]);

  // Sync rotation changes to editor
  useEffect(() => {
    if (!selection || Array.isArray(selection)) return;
    if (transformMode) return;
    editor.updateSelectedBlockRotation(
      new Euler(
        (rotationState.x * Math.PI) / 180,
        (rotationState.y * Math.PI) / 180,
        (rotationState.z * Math.PI) / 180
      )
    );
    if (panelAutoSavePendingRef.current) {
      panelAutoSavePendingRef.current = false;
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, rotationState, selection, transformMode, panelAutoSavePendingRef]);
}
