import { useCallback, useEffect, useRef } from "react";
import type EditorApp from "../EditorApp";
import { AUTO_SAVE_SCENARIO_NAME, saveScenario } from "../scenarioStore";

export function useAutoSave(
  editor: EditorApp,
  refreshScenarios: () => void,
  markUnsaved: () => void
) {
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const performAutoSave = useCallback(() => {
    const data = editor.exportScenario(AUTO_SAVE_SCENARIO_NAME);
    saveScenario(AUTO_SAVE_SCENARIO_NAME, data);
    if (isMountedRef.current) {
      refreshScenarios();
    }
  }, [editor, refreshScenarios]);

  const autoSaveScenario = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    markUnsaved();
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      performAutoSave();
      autoSaveTimeoutRef.current = null;
    }, 500);
  }, [markUnsaved, performAutoSave]);

  const flushAutoSave = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    performAutoSave();
  }, [performAutoSave]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      flushAutoSave();
    };
  }, [flushAutoSave]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      flushAutoSave();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [flushAutoSave]);

  return {
    autoSaveScenario,
    flushAutoSave,
    performAutoSave,
  };
}
