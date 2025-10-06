import { useCallback, useEffect, useState } from "react";
import type EditorApp from "../EditorApp";
import type { StoredScenario } from "../scenarioStore";
import {
  AUTO_SAVE_SCENARIO_NAME,
  listScenarios,
  prepareScenarioExport,
  removeScenario,
  saveScenario,
} from "../scenarioStore";

export function useScenarioManagement(
  editor: EditorApp,
  clearUnsaved: () => void,
  flushAutoSave: () => void,
  refreshComponents: () => void,
  closeMenus: () => void
) {
  const [scenarioRecords, setScenarioRecords] = useState<StoredScenario[]>([]);
  const [activeScenarioName, setActiveScenarioName] = useState<string>(AUTO_SAVE_SCENARIO_NAME);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);

  const refreshScenarios = useCallback(() => {
    if (typeof window === "undefined") return;
    setScenarioRecords(listScenarios());
  }, []);

  const handleNewScenario = useCallback(() => {
    closeMenus();
    if (!window.confirm("Start a new scenario? This clears the current scene.")) return;
    editor.resetScene();
    setActiveScenarioName(AUTO_SAVE_SCENARIO_NAME);
    refreshScenarios();
    flushAutoSave();
    clearUnsaved();
  }, [clearUnsaved, closeMenus, editor, refreshScenarios, flushAutoSave]);

  const handleSaveScenarioAs = useCallback(() => {
    closeMenus();
    const defaultName = scenarioRecords.find((e) => e.name !== AUTO_SAVE_SCENARIO_NAME)?.name ?? 
      `Scenario ${scenarioRecords.length + 1}`;
    const input = window.prompt("Scenario name", defaultName ?? "Scenario");
    if (!input) return;
    const name = input.trim();
    if (name === "" || name.toLowerCase() === AUTO_SAVE_SCENARIO_NAME.toLowerCase()) {
      if (name.toLowerCase() === AUTO_SAVE_SCENARIO_NAME.toLowerCase()) {
        window.alert("This name is reserved by the auto-save system.");
      }
      return;
    }
    const scenarioData = editor.exportScenario(name);
    saveScenario(name, scenarioData);
    setActiveScenarioName(name);
    refreshScenarios();

    const exportPayload = prepareScenarioExport(name, scenarioData);
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportPayload.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    flushAutoSave();
    clearUnsaved();
  }, [clearUnsaved, closeMenus, editor, flushAutoSave, refreshScenarios, scenarioRecords]);

  const handleLoadScenario = useCallback(() => {
    refreshScenarios();
    closeMenus();
    setIsScenarioModalOpen(true);
  }, [refreshScenarios, closeMenus]);

  const handleSaveCurrentScenario = useCallback(() => {
    const trimmed = activeScenarioName.trim();
    const name = trimmed === "" ? AUTO_SAVE_SCENARIO_NAME : trimmed;
    const scenarioData = editor.exportScenario(name);
    saveScenario(name, scenarioData);
    setActiveScenarioName(name);
    flushAutoSave();
    clearUnsaved();
  }, [activeScenarioName, clearUnsaved, editor, flushAutoSave]);

  const handleSelectScenario = useCallback(
    (record: StoredScenario) => {
      editor.importScenario(record.data);
      setActiveScenarioName(record.name);
      saveScenario(AUTO_SAVE_SCENARIO_NAME, record.data);
      setIsScenarioModalOpen(false);
      refreshScenarios();
      refreshComponents();
      flushAutoSave();
      clearUnsaved();
    },
    [clearUnsaved, editor, flushAutoSave, refreshComponents, refreshScenarios]
  );

  const handleDeleteScenario = useCallback(
    (id: string) => {
      if (!window.confirm("Delete this scenario?")) return;
      const target = scenarioRecords.find((e) => e.id === id);
      removeScenario(id);
      refreshScenarios();
      if (target && target.name === activeScenarioName) {
        setActiveScenarioName(AUTO_SAVE_SCENARIO_NAME);
        clearUnsaved();
      }
    },
    [activeScenarioName, clearUnsaved, refreshScenarios, scenarioRecords]
  );

  const handleImportScenarioFiles = useCallback(
    async (files: FileList | File[]) => {
      const collection = Array.from(files);
      if (collection.length === 0) return;

      let imported = 0;
      for (const file of collection) {
        if (!file.name.toLowerCase().endsWith(".rbonline")) continue;
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const scenarioName = (parsed.name ?? file.name.replace(/\.rbonline$/i, "")).trim() || file.name;
          const scenarioData = {
            version: 1 as const,
            name: scenarioName,
            createdAt: parsed.createdAt ?? new Date().toISOString(),
            blocks: parsed.blocks ?? [],
            componentDefinitions: parsed.componentDefinitions ?? [],
          };
          saveScenario(scenarioData.name, scenarioData);
          imported += 1;
        } catch (error) {
          console.error("Failed to import scenario", error);
          window.alert(`Could not import scenario from ${file.name}`);
        }
      }

      if (imported > 0) {
        refreshScenarios();
        refreshComponents();
      }
    },
    [refreshComponents, refreshScenarios]
  );

  useEffect(() => {
    refreshScenarios();
  }, [refreshScenarios]);

  useEffect(() => {
    if (scenarioRecords.length === 0) return;
    const hasActive = scenarioRecords.some((r) => r.name === activeScenarioName);
    if (!hasActive) {
      const fallback = scenarioRecords.find((r) => r.name === AUTO_SAVE_SCENARIO_NAME)?.name ?? 
        scenarioRecords[0]?.name;
      if (fallback && fallback !== activeScenarioName) {
        setActiveScenarioName(fallback);
      }
    }
  }, [scenarioRecords, activeScenarioName]);

  return {
    scenarioRecords,
    activeScenarioName,
    isScenarioModalOpen,
    setIsScenarioModalOpen,
    refreshScenarios,
    handleNewScenario,
    handleSaveScenarioAs,
    handleLoadScenario,
    handleSaveCurrentScenario,
    handleSelectScenario,
    handleDeleteScenario,
    handleImportScenarioFiles,
  };
}
