import { useCallback, useRef, useState } from "react";
import type { VectorState, ComponentPendingDelete } from "../types/editorTypes";

export function useEditorState() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const unsavedChangesRef = useRef(false);
  const panelAutoSavePendingRef = useRef(false);

  const markUnsaved = useCallback(() => {
    if (!unsavedChangesRef.current) {
      unsavedChangesRef.current = true;
      setHasUnsavedChanges(true);
    }
  }, []);

  const clearUnsaved = useCallback(() => {
    if (unsavedChangesRef.current) {
      unsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
    }
    panelAutoSavePendingRef.current = false;
  }, []);

  return {
    hasUnsavedChanges,
    markUnsaved,
    clearUnsaved,
    panelAutoSavePendingRef,
  };
}

export function useTransformState() {
  const [positionState, setPositionState] = useState<VectorState>({ x: 0, y: 0, z: 0 });
  const [scaleState, setScaleState] = useState<VectorState>({ x: 1, y: 1, z: 1 });
  const [rotationState, setRotationState] = useState<VectorState>({ x: 0, y: 0, z: 0 });

  return {
    positionState,
    setPositionState,
    scaleState,
    setScaleState,
    rotationState,
    setRotationState,
  };
}

export function useComponentDelete() {
  const [componentPendingDelete, setComponentPendingDelete] = useState<ComponentPendingDelete>(null);

  const handleCancelDeleteComponent = useCallback(() => {
    setComponentPendingDelete(null);
  }, []);

  return {
    componentPendingDelete,
    setComponentPendingDelete,
    handleCancelDeleteComponent,
  };
}
