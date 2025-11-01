import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type SetStateAction } from "react";
import { Euler, Group, Vector3, Object3D, Quaternion as ThreeQuaternion } from "three";
import { FaPlay, FaStop } from "react-icons/fa";
import { EditorApp } from "@/features/editor/core";
import type { EditorBlock, EditorSelection, SelectionTransform, SerializedNode } from "@/features/editor/types";
import type { EditorItem } from "@/features/editor/types";
import { addComponent, getComponent } from "@/features/editor/components-system";
import { useComponentRegistry } from "../hooks/useComponentRegistry";
import { ItemMenu } from "./ItemMenu";
import { PropertiesPanel } from "./PropertiesPanel";
import { useHistoryStack, type GroupMember } from "../hooks/useHistoryStack";
import type { EditorModeManager, TransformMode, AxisConstraint } from "@/features/editor/core";
import { ScenarioModal } from "./ScenarioModal";
import { Portal } from "./Portal";
import { ComponentDeleteModal } from "./ComponentDeleteModal";
import { GameTab } from "./GameTab";
import {
  AUTO_SAVE_SCENARIO_NAME,
  listScenarios,
  prepareScenarioExport,
  removeScenario,
  saveScenario,
  type StoredScenario,
} from "@/features/editor/scenarios";
import type { SerializedScenario } from "@/features/editor/scenarios";
import type { Alert } from "@/features/editor/core";
import { AlertIcon } from "./AlertIcon";
import { CategoryFilter, type ComponentCategory } from "./CategoryFilter";

type VectorState = { x: number; y: number; z: number };
type ClipboardPayload = {
  nodes: SerializedNode[];
  componentIds: string[];
};

const builtinItems: EditorItem[] = [
  { id: "block", label: "Block", category: "primitive" },
  { id: "randomTargetGen", label: "Random Target Generator", category: "target" },
  // COMMENTED OUT: Moving Target Generator - Not implemented yet
  // { id: "movingTargetGen", label: "Moving Target Generator", category: "target" },
  { id: "spawn", label: "Spawn Point", category: "gameLogic" },
];

export function EditorRoot({ editor }: { editor: EditorApp }): ReactElement {
  const [activeItem, setActiveItem] = useState<EditorItem | null>(null);
  const {
    components,
    refresh: refreshComponents,
    remove: removeComponentFromLibrary,
  } = useComponentRegistry();
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [positionState, setPositionState] = useState<VectorState>({ x: 0, y: 0, z: 0 });
  const [scaleState, setScaleState] = useState<VectorState>({ x: 1, y: 1, z: 1 });
  const [rotationState, setRotationState] = useState<VectorState>({ x: 0, y: 0, z: 0 });
  
  // Generator selection mode for event linking
  const [generatorSelectionMode, setGeneratorSelectionMode] = useState<{
    active: boolean;
    eventId: string;
    sourceGeneratorId: string;
  } | null>(null);
  const generatorSelectionModeRef = useRef<{
    active: boolean;
    eventId: string;
    sourceGeneratorId: string;
  } | null>(null);
  
  // Keep ref in sync with state and notify editor
  useEffect(() => {
    generatorSelectionModeRef.current = generatorSelectionMode;
    // Notify editor to prevent dragging during generator selection
    editor.setSelectingGeneratorTarget(!!generatorSelectionMode);
  }, [generatorSelectionMode, editor]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [simpleMode, setSimpleMode] = useState(false);

  const selectedItemRef = useRef<EditorItem | null>(null);

  const [scenarioRecords, setScenarioRecords] = useState<StoredScenario[]>([]);
  const [activeScenarioName, setActiveScenarioName] = useState<string>(AUTO_SAVE_SCENARIO_NAME);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const menuAnchors = useRef<Record<string, HTMLButtonElement | null>>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const panelAutoSavePendingRef = useRef(false);
  const isMountedRef = useRef(true);
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const pasteOffsetRef = useRef(0);
  const unsavedChangesRef = useRef(false);
  const [componentPendingDelete, setComponentPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [hasSpawnPoint, setHasSpawnPoint] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [gameScenario, setGameScenario] = useState<SerializedScenario | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<ComponentCategory>>(
    new Set(["primitive", "target", "gameLogic", "myComponents"])
  );

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
  }, []);

  const refreshScenarios = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    setScenarioRecords(listScenarios());
  }, []);

  const performAutoSave = useCallback(() => {
    const data = editor.exportScenario(AUTO_SAVE_SCENARIO_NAME);
    saveScenario(AUTO_SAVE_SCENARIO_NAME, data);
    if (isMountedRef.current) {
      refreshScenarios();
    }
  }, [editor, refreshScenarios]);

  // Auto-load scenario from sessionStorage if coming from game
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const scenarioToLoad = sessionStorage.getItem("editor-load-scenario");
    if (scenarioToLoad) {
      // Clear the flag
      sessionStorage.removeItem("editor-load-scenario");
      
      // Find and load the scenario
      const scenarios = listScenarios();
      const scenario = scenarios.find(s => s.name === scenarioToLoad);
      
      if (scenario) {
        console.log("[EditorRoot] Auto-loading scenario from game:", scenarioToLoad);
        editor.importScenario(scenario.data);
        setActiveScenarioName(scenario.name);
        saveScenario(AUTO_SAVE_SCENARIO_NAME, scenario.data);
        refreshComponents();
      }
    }
  }, [editor, refreshComponents]);

  // Subscribe to alerts
  useEffect(() => {
    const unsubscribe = editor.alerts.addListener((newAlerts) => {
      setAlerts(newAlerts);
    });
    
    // Initial validation
    editor.validateScene();
    
    return unsubscribe;
  }, [editor]);

  // Keyboard shortcuts for toggling panels
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (editor.isUserTyping()) return;
      
      // Ignore if any modifier keys are pressed
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      
      switch (event.key.toLowerCase()) {
        case "b":
          event.preventDefault();
          setShowSidebar(prev => !prev);
          break;
        case "i":
          event.preventDefault();
          setShowInspector(prev => !prev);
          break;
        case "c":
          event.preventDefault();
          setShowControls(prev => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const autoSaveScenario = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    markUnsaved();
    // Validate scene when auto-saving
    editor.validateScene();
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      performAutoSave();
      autoSaveTimeoutRef.current = null;
    }, 500);
  }, [editor, markUnsaved, performAutoSave]);

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

  const updateMenuPosition = useCallback(
    (id: string) => {
      const anchor = menuAnchors.current[id];
      if (!anchor) {
        setMenuPosition(null);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      setMenuPosition({ left: rect.left, top: rect.bottom + 4, width: rect.width });
    },
    [],
  );

  const closeMenus = useCallback(() => {
    setOpenMenuId(null);
    setMenuPosition(null);
  }, []);

  const scheduleCloseMenus = useCallback((delay: number = 300) => {
    // Cancel any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Schedule new close timeout
    hoverTimeoutRef.current = setTimeout(() => {
      closeMenus();
      hoverTimeoutRef.current = null;
    }, delay);
  }, [closeMenus]);

  const handleMenuHover = useCallback((menuId: string) => {
    // Cancel any pending close timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    setOpenMenuId(menuId);
    updateMenuPosition(menuId);
  }, [updateMenuPosition]);

  const handleMenuLeave = useCallback(() => {
    scheduleCloseMenus();
  }, [scheduleCloseMenus]);

  useEffect(() => {
    refreshScenarios();
  }, [refreshScenarios]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      flushAutoSave();
    };
  }, [flushAutoSave]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unsavedChangesRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
      flushAutoSave();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [flushAutoSave]);

  useEffect(() => {
    if (scenarioRecords.length === 0) {
      performAutoSave();
      return;
    }
    if (!scenarioRecords.some((record) => record.name === AUTO_SAVE_SCENARIO_NAME)) {
      performAutoSave();
    }
  }, [scenarioRecords, performAutoSave]);

  useEffect(() => {
    if (scenarioRecords.length === 0) {
      if (activeScenarioName !== AUTO_SAVE_SCENARIO_NAME) {
        setActiveScenarioName(AUTO_SAVE_SCENARIO_NAME);
      }
      return;
    }
    const hasActive = scenarioRecords.some((record) => record.name === activeScenarioName);
    if (!hasActive) {
      const fallback =
        scenarioRecords.find((record) => record.name === AUTO_SAVE_SCENARIO_NAME)?.name ?? scenarioRecords[0]?.name;
      if (fallback && fallback !== activeScenarioName) {
        setActiveScenarioName(fallback);
      }
    }
  }, [scenarioRecords, activeScenarioName]);

  useEffect(() => {
    if (!openMenuId) {
      return undefined;
    }
    updateMenuPosition(openMenuId);
    const handleReposition = () => updateMenuPosition(openMenuId);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    // Close on outside click (but allow clicks on the anchor button and the menu container)
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const anchor = menuAnchors.current[openMenuId];
      const container = menuContainerRef.current;
      if (
        target &&
        (container?.contains(target) || (anchor && anchor.contains(target)))
      ) {
        return;
      }
      closeMenus();
    };
    document.addEventListener("mousedown", handleDocumentMouseDown, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      document.removeEventListener("mousedown", handleDocumentMouseDown, true);
    };
  }, [closeMenus, openMenuId, updateMenuPosition]);

  useEffect(() => {
    if (!openMenuId) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenus, openMenuId]);

  const handleRefreshComponentsMenu = useCallback(() => {
    refreshComponents();
    closeMenus();
  }, [refreshComponents, closeMenus]);

  const handleNewScenario = useCallback(() => {
    closeMenus();
    if (!window.confirm("Start a new scenario? This clears the current scene.")) {
      return;
    }
    editor.resetScene();
    setActiveScenarioName(AUTO_SAVE_SCENARIO_NAME);
    refreshScenarios();
    flushAutoSave();
    clearUnsaved();
    panelAutoSavePendingRef.current = false;
  }, [clearUnsaved, closeMenus, editor, refreshScenarios, flushAutoSave, setActiveScenarioName]);

  const handleSaveScenarioAs = useCallback(() => {
    closeMenus();
    const defaultName = scenarioRecords.find((entry) => entry.name !== AUTO_SAVE_SCENARIO_NAME)?.name ??
      `Scenario ${scenarioRecords.length + 1}`;
    const input = window.prompt("Scenario name", defaultName ?? "Scenario");
    if (!input) {
      return;
    }
    const name = input.trim();
    if (name === "") {
      return;
    }
    if (name.toLowerCase() === AUTO_SAVE_SCENARIO_NAME.toLowerCase()) {
      window.alert("This name is reserved by the auto-save system.");
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
    panelAutoSavePendingRef.current = false;
  }, [clearUnsaved, closeMenus, editor, flushAutoSave, refreshScenarios, scenarioRecords, setActiveScenarioName]);

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
    if (typeof window !== "undefined" && autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    flushAutoSave();
    clearUnsaved();
    panelAutoSavePendingRef.current = false;
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
      panelAutoSavePendingRef.current = false;
    },
    [clearUnsaved, editor, flushAutoSave, refreshComponents, refreshScenarios, setActiveScenarioName],
  );

  const handleDeleteScenario = useCallback(
    (id: string) => {
      if (!window.confirm("Delete this scenario?")) {
        return;
      }
      const target = scenarioRecords.find((entry) => entry.id === id);
      removeScenario(id);
      refreshScenarios();
      if (target && target.name === activeScenarioName) {
        setActiveScenarioName(AUTO_SAVE_SCENARIO_NAME);
        clearUnsaved();
      }
    },
    [activeScenarioName, clearUnsaved, refreshScenarios, scenarioRecords, setActiveScenarioName],
  );

  const handleDownloadScenario = useCallback((scenario: StoredScenario) => {
    // Create a blob with the scenario data
    const jsonString = JSON.stringify(scenario.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scenario.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.rbonline`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleCancelDeleteComponent = useCallback(() => {
    setComponentPendingDelete(null);
  }, []);

  const handleConfirmDeleteComponent = useCallback(() => {
    if (!componentPendingDelete) {
      return;
    }
    editor.removeComponentDefinition(componentPendingDelete.id);
    removeComponentFromLibrary(componentPendingDelete.id);
    refreshComponents();
    setComponentPendingDelete(null);
    if (activeItem?.id === `component:${componentPendingDelete.id}`) {
      setActiveItem(null);
    }
    autoSaveScenario();
  }, [activeItem, autoSaveScenario, componentPendingDelete, editor, refreshComponents, removeComponentFromLibrary]);

  const handleImportScenarioFiles = useCallback(
    async (files: FileList | File[]) => {
      const collection = Array.from(files instanceof FileList ? Array.from(files) : files);
      if (collection.length === 0) {
        return;
      }

      let imported = 0;
      for (const file of collection) {
        if (!file.name.toLowerCase().endsWith(".rbonline")) {
          continue;
        }
        try {
          const text = await file.text();
          const parsed = JSON.parse(text) as Partial<SerializedScenario> & { fileName?: string };
          const scenarioName = (parsed.name ?? file.name.replace(/\.rbonline$/i, "")).trim() || file.name;
          const scenarioData: SerializedScenario = {
            version: 1,
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
    [refreshComponents, refreshScenarios],
  );

  const menuGroups = useMemo(
    () => [
      {
        id: "scenario",
        label: "Scenario",
        items: [
          { id: "scenario-new", label: "New", action: handleNewScenario },
          {
            id: "scenario-save",
            label: hasUnsavedChanges ? "Save *" : "Save",
            action: handleSaveCurrentScenario,
            disabled: !hasUnsavedChanges,
          },
          { id: "scenario-save-as", label: "Save As…", action: handleSaveScenarioAs },
          { id: "scenario-load", label: "Load…", action: handleLoadScenario },
        ],
      },
      {
        id: "view",
        label: "View",
        items: [
          { 
            id: "view-toggle-sidebar", 
            label: showSidebar ? "Hide Components (B)" : "Show Components (B)", 
            action: () => setShowSidebar(prev => !prev) 
          },
          { 
            id: "view-toggle-inspector", 
            label: showInspector ? "Hide Inspector (I)" : "Show Inspector (I)", 
            action: () => setShowInspector(prev => !prev) 
          },
          { 
            id: "view-toggle-controls", 
            label: showControls ? "Hide Controls (C)" : "Show Controls (C)", 
            action: () => setShowControls(prev => !prev) 
          },
        ],
      },
      {
        id: "components",
        label: "Components",
        items: [{ id: "components-refresh", label: "Refresh list", action: handleRefreshComponentsMenu }],
      },
    ],
    [handleLoadScenario, handleNewScenario, handleRefreshComponentsMenu, handleSaveCurrentScenario, handleSaveScenarioAs, hasUnsavedChanges, showSidebar, showInspector, showControls],
  );

  const activeMenu = useMemo(() => {
    if (!openMenuId) {
      return null;
    }
    return menuGroups.find((menu) => menu.id === openMenuId) ?? null;
  }, [menuGroups, openMenuId]);


  const snapshotFromBlock = (b: EditorBlock): SelectionTransform => ({
    position: b.mesh.position.clone(),
    rotation: b.mesh.rotation.clone(),
    scale: b.mesh.scale.clone(),
  });

  const snapshotFromWorldObject = (obj: Object3D): SelectionTransform => {
    const p = new Vector3();
    const q = new ThreeQuaternion();
    const s = new Vector3();
    obj.updateWorldMatrix(true, false);
    obj.matrixWorld.decompose(p, q, s);
    const e = new Euler().setFromQuaternion(q);
    return { position: p, rotation: e, scale: s };
  };

  useEffect(() => {
    selectedItemRef.current = activeItem;
  }, [activeItem]);

  const items: EditorItem[] = useMemo(() => {
    return [
      ...builtinItems,
      ...components.map((c) => ({ 
        id: `component:${c.id}`, 
        label: c.label,
        category: c.category ?? "myComponents" // User components default to "myComponents"
      })),
    ];
  }, [components]);

  // Filtered items based on selected categories
  const filteredItems: EditorItem[] = useMemo(() => {
    return items.filter((item) => selectedCategories.has(item.category));
  }, [items, selectedCategories]);

  const handleToggleCategory = useCallback((category: ComponentCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Whether a component edit session is active. Must be declared before effects that depend on it.
  const editingActive = !!editor.getEditingComponentId();

  const applyTransformToState = useCallback((transform: SelectionTransform | null) => {
    if (!transform) {
      setPositionState({ x: 0, y: 0, z: 0 });
      setScaleState({ x: 1, y: 1, z: 1 });
      setRotationState({ x: 0, y: 0, z: 0 });
      return;
    }

    setPositionState({ x: transform.position.x, y: transform.position.y, z: transform.position.z });
    setScaleState({ x: transform.scale.x, y: transform.scale.y, z: transform.scale.z });
    setRotationState({
      x: (transform.rotation.x * 180) / Math.PI,
      y: (transform.rotation.y * 180) / Math.PI,
      z: (transform.rotation.z * 180) / Math.PI,
    });
  }, []);

  const applyTransformSnapshot = useCallback(
    (id: string, snap: SelectionTransform) => {
      const ok = editor.applyTransform(id, snap);
      if (ok) applyTransformToState(editor.getSelectionTransform());
    },
    [editor, applyTransformToState],
  );

  const { pushHistory, undo, redo } = useHistoryStack(editor, applyTransformSnapshot, autoSaveScenario);

  // NEW: Use mode system instead of useTransformSession
  const [transformMode, setTransformMode] = useState<TransformMode | null>(null);
  const [activeAxis, setActiveAxis] = useState<AxisConstraint>(null);

  // Listen to mode changes from the new system
  useEffect(() => {
    const removeListener = editor.modeManager.addListener((mode) => {
      if (mode.type === "transforming") {
        setTransformMode(mode.mode);
        setActiveAxis(mode.axis);
      } else {
        setTransformMode(null);
        setActiveAxis(null);
      }
    });
    return removeListener;
  }, [editor]);

  useEffect(() => {
    return editor.addSelectionListener((block) => {
      const currentMode = generatorSelectionModeRef.current;
      console.log('[EditorRoot] Selection listener triggered, block:', Array.isArray(block) ? 'multiple' : block?.id);
      console.log('[EditorRoot] Generator selection mode active:', !!currentMode);
      
      // Handle generator selection mode
      if (currentMode) {
        console.log('[EditorRoot] In generator selection mode, source:', currentMode.sourceGeneratorId);
        // In selection mode, ignore all selection changes except valid generator clicks
        if (block && !Array.isArray(block)) {
          const isGenerator = block.mesh.userData?.isGenerator === true;
          console.log('[EditorRoot] Clicked block is generator:', isGenerator);
          console.log('[EditorRoot] Clicked block ID:', block.id);
          if (isGenerator && block.id !== currentMode.sourceGeneratorId) {
            console.log('[EditorRoot] Valid generator selected! Linking...');
            // User selected a valid generator - link it to the event
            const sourceBlock = editor.getBlock(currentMode.sourceGeneratorId);
            if (sourceBlock && sourceBlock.generatorConfig) {
              const updatedConfig = { ...sourceBlock.generatorConfig };
              if (updatedConfig.events) {
                updatedConfig.events = {
                  ...updatedConfig.events,
                  onComplete: updatedConfig.events.onComplete.map(event => 
                    event.id === currentMode.eventId && event.type === "startGenerator"
                      ? { ...event, targetGeneratorId: block.id }
                      : event
                  ),
                };
                editor.updateGeneratorConfig(currentMode.sourceGeneratorId, updatedConfig);
                markUnsaved();
                console.log('[EditorRoot] Config updated, re-selecting source block');
              }
            }
            
            // Clear alert
            editor.alerts.clearAll();
            
            // Re-select the source block to show updated config
            // Use setTimeout to let the current selection event finish
            setTimeout(() => {
              const freshSourceBlock = editor.getBlock(currentMode.sourceGeneratorId);
              if (freshSourceBlock) {
                console.log('[EditorRoot] Re-selecting source block:', freshSourceBlock.id);
                editor.setSelectionByIds([currentMode.sourceGeneratorId]);
              }
              // Exit selection mode AFTER re-selecting to prevent accidental deletion
              setGeneratorSelectionMode(null);
            }, 0);
          } else if (!isGenerator) {
            // User selected a non-generator - show warning but don't change selection
            editor.alerts.clearAll();
            editor.alerts.publish(
              `gen-select-error-${Date.now()}`,
              "warning",
              "Please select a Target Generator block"
            );
            setTimeout(() => {
              editor.alerts.clearAll();
            }, 3000);
          } else if (block.id === currentMode.sourceGeneratorId) {
            // User clicked the same generator - cancel selection mode
            setGeneratorSelectionMode(null);
            editor.alerts.clearAll();
            editor.alerts.publish(
              `gen-select-cancel-${Date.now()}`,
              "info",
              "Selection cancelled"
            );
            setTimeout(() => {
              editor.alerts.clearAll();
            }, 2000);
          }
        }
        // IMPORTANT: Always return early when in selection mode to prevent any inspector updates
        return;
      }
      
      // Normal selection behavior (not in generator selection mode)
      setSelection(block);
      const t = editor.getSelectionTransform();
      // When entering component edit mode, selection becomes multiple and getSelectionTransform() returns null.
      // Avoid resetting the inspector state to defaults in that case; keep previous values instead.
      if (t || !editingActive) {
        applyTransformToState(t);
      }
      // Check if there's a spawn point
      setHasSpawnPoint(editor.hasSpawnPoint());
    });
  }, [editor, applyTransformToState, editingActive, markUnsaved]);

  // NOTE: Event handling (pointer, keyboard) is now done by InputRouter in EditorApp
  // We only need to handle drag/drop from the palette
  useEffect(() => {
    const canvas = editor.getCanvas();

    const handleDragOver = (event: DragEvent) => {
      if (editingActive) return;
      if (!selectedItemRef.current) {
        const hasBlock = event.dataTransfer?.types.includes("text/plain");
        if (!hasBlock) {
          return;
        }
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
      } else if (data === "randomTargetGen") {
        placed = editor.placeRandomTargetGeneratorAt(event.clientX, event.clientY);
      } else if (data === "movingTargetGen") {
        // COMMENTED OUT: Moving Target Generator - Not implemented yet
        // placed = editor.placeMovingTargetGeneratorAt(event.clientX, event.clientY);
        console.warn('[EditorRoot] Moving Target Generator not implemented yet');
      } else if (data === "spawn") {
        placed = editor.placeSpawnAt(event.clientX, event.clientY);
      } else if (data.startsWith("component:")) {
        const id = data.slice("component:".length);
        const def = getComponent(id);
        if (def) {
          placed = editor.placeComponentAt(event.clientX, event.clientY, def);
        }
      }
      if (placed) {
        const t = editor.getSelectionTransform();
        if (t) {
          pushHistory({ type: "add", id: placed.id, transform: t });
        }
        autoSaveScenario();
        // Update spawn point status
        setHasSpawnPoint(editor.hasSpawnPoint());
      }
      setActiveItem(builtinItems[0]);
      editor.clearMovementState?.();
    };

    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("drop", handleDrop);
    return () => {
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("drop", handleDrop);
    };
  }, [autoSaveScenario, editor, editingActive, pushHistory]);

  useEffect(() => {
    const removeListener = editor.addDragCommitListener((changes) => {
      if (changes.length === 0) {
        return;
      }
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

  // Clipboard helpers must be declared before effects that depend on them
  const copySelection = useCallback(() => {
    // Always query the live selection from the editor to avoid React state races
    const currentSelection = editor.getSelectionArray();
    if (currentSelection.length === 0) {
      return;
    }
    const ids = currentSelection.map((block) => block.id);
    const payload = editor.serializeBlocksByIds(ids);
    if (payload.nodes.length === 0) {
      return;
    }
    clipboardRef.current = payload;
    pasteOffsetRef.current = 0;
  }, [editor]);

  const pasteClipboard = useCallback(() => {
    const payload = clipboardRef.current;
    if (!payload || payload.nodes.length === 0) {
      return;
    }
    pasteOffsetRef.current += 1;
    const offsetMagnitude = pasteOffsetRef.current * 1.5;
    const offset = new Vector3(offsetMagnitude, 0, offsetMagnitude);
    const created = editor.instantiateSerializedNodes(payload.nodes, payload.componentIds, offset);
    if (created.length > 0) {
      editor.setSelectionByIds(created.map((block) => block.id));
      // Add each pasted block to history so undo works
      // Serialize the created blocks to preserve all their data (including generator config)
      const createdIds = created.map((block) => block.id);
      const serializedPayload = editor.serializeBlocksByIds(createdIds);
      serializedPayload.nodes.forEach((node, index) => {
        const block = created[index];
        const transform = editor.getTransformsForIds([block.id])[0]?.transform;
        if (transform) {
          pushHistory({ type: "add", id: block.id, transform, node });
        }
      });
      panelAutoSavePendingRef.current = false;
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, pushHistory]);

  const renameSelection = useCallback((id: string, newName: string) => {
    if (!editor) return;
    
    const success = editor.renameBlock(id, newName);
    if (success) {
      // Force re-render to show new name
      const block = editor.getBlock(id);
      if (block) {
        setSelection({ ...block });
      }
      markUnsaved();
    }
  }, [editor, markUnsaved]);
  
  const setTyping = useCallback((typing: boolean) => {
    if (editor) {
      editor.setTyping(typing);
    }
  }, [editor]);

  const deleteSelection = useCallback(() => {
    const currentSelection = selection
      ? Array.isArray(selection)
        ? selection
        : [selection]
      : editor.getSelectionArray();
    if (currentSelection.length === 0) {
      return;
    }
    const ids = currentSelection.map((item) => item.id);
    const payload = editor.serializeBlocksByIds(ids);

    const removedIds: string[] = [];
    ids.forEach((id) => {
      if (editor.removeBlock(id)) {
        removedIds.push(id);
      }
    });

    if (removedIds.length === 0) {
      return;
    }

    if (payload.nodes.length > 0) {
      pushHistory({ type: "delete", ids: removedIds, payload });
    }

    editor.clearSelection();
    setSelection(null);
    clipboardRef.current = null;
    pasteOffsetRef.current = 0;
    panelAutoSavePendingRef.current = false;
    autoSaveScenario();
    // Update spawn point status
    setHasSpawnPoint(editor.hasSpawnPoint());
  }, [autoSaveScenario, editor, pushHistory, selection]);

  // NOTE: Keyboard handling is now done by InputRouter in EditorApp
  // We only keep UI-specific shortcuts here (copy/paste/save/undo/redo/delete)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const key = event.key.toLowerCase();
      const meta = event.metaKey;
      const ctrl = event.ctrlKey;

      // Copy/Paste/Save
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

      // Undo/Redo
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

      // Delete (but not when in generator selection mode)
      if ((event.key === "Delete" || event.key === "Backspace") && (selection || editor.getSelectionArray().length > 0)) {
        // Don't delete when in generator selection mode
        if (generatorSelectionModeRef.current) {
          return;
        }
        event.preventDefault();
        deleteSelection();
        return;
      }

      // Escape to clear selection or cancel generator selection mode
      if (event.key === "Escape" && !transformMode) {
        // If in generator selection mode, cancel it
        if (generatorSelectionModeRef.current) {
          setGeneratorSelectionMode(null);
          editor.alerts.clearAll();
          // Re-select the source generator
          const sourceBlock = editor.getBlock(generatorSelectionModeRef.current.sourceGeneratorId);
          if (sourceBlock) {
            editor.setSelectionByIds([generatorSelectionModeRef.current.sourceGeneratorId]);
          }
          return;
        }
        setActiveItem(null);
        editor.clearSelection();
        return;
      }

      // Component editing
      if (event.key === "Enter") {
        const editingId = editor.getEditingComponentId();
        if (editingId) {
          event.preventDefault();
          editor.finishEditingComponent(editingId);
          autoSaveScenario();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [autoSaveScenario, copySelection, deleteSelection, editor, handleSaveCurrentScenario, pasteClipboard, selection, transformMode, undo, redo]);

  useEffect(() => {
    if (!selection || Array.isArray(selection)) {
      return;
    }
    if (transformMode) {
      return;
    }
    editor.updateSelectedBlockPosition(new Vector3(positionState.x, positionState.y, positionState.z));
    if (panelAutoSavePendingRef.current) {
      panelAutoSavePendingRef.current = false;
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, positionState, selection, transformMode]);

  useEffect(() => {
    if (!selection || Array.isArray(selection)) {
      return;
    }
    if (transformMode) {
      return;
    }
    editor.updateSelectedBlockScale(new Vector3(scaleState.x, scaleState.y, scaleState.z));
    if (panelAutoSavePendingRef.current) {
      panelAutoSavePendingRef.current = false;
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, scaleState, selection, transformMode]);

  useEffect(() => {
    if (!selection || Array.isArray(selection)) {
      return;
    }
    if (transformMode) {
      return;
    }
    editor.updateSelectedBlockRotation(
      new Euler(
        (rotationState.x * Math.PI) / 180,
        (rotationState.y * Math.PI) / 180,
        (rotationState.z * Math.PI) / 180,
      ),
    );
    if (panelAutoSavePendingRef.current) {
      panelAutoSavePendingRef.current = false;
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor, rotationState, selection, transformMode]);

  const inspectorVisible = selection !== null;

  

  const handlePositionChange = useCallback((updater: SetStateAction<VectorState>) => {
    panelAutoSavePendingRef.current = true;
    setPositionState(updater);
  }, []);

  const handleScaleChange = useCallback((updater: SetStateAction<VectorState>) => {
    panelAutoSavePendingRef.current = true;
    setScaleState(updater);
  }, []);

  const handleRotationChange = useCallback((updater: SetStateAction<VectorState>) => {
    panelAutoSavePendingRef.current = true;
    setRotationState(updater);
  }, []);

  const title = useMemo(() => {
    if (selection) {
      if (Array.isArray(selection)) return "Multiple Objects";
      return selection.id;
    }
    if (activeItem) {
      return `${activeItem.label} ready to place`;
    }
    return "Select or drag blocks";
  }, [selection, activeItem]);

  const transformLabel = useMemo(() => {
    if (!transformMode) {
      return null;
    }
    const base = transformMode === "translate" ? "Move" : transformMode === "rotate" ? "Rotate" : "Scale";
    const axis = activeAxis ? `axis: ${activeAxis.toUpperCase()}` : "free";
    return `${base} (${axis})`;
  }, [transformMode, activeAxis]);

  // moved above to avoid temporal dead zone in effects

  const selectedComponentId = useMemo(() => {
    if (selection && !Array.isArray(selection)) {
      return editor.getComponentIdForSelectedGroup();
    }
    // If in edit mode, fall back to the active editing component id
    return editor.getEditingComponentId();
  }, [editor, selection]);

  const isEditingComponent = useMemo(() => {
    return selectedComponentId ? editor.isComponentEditing(selectedComponentId) : false;
  }, [editor, selectedComponentId]);

  const handleStartGame = useCallback(() => {
    if (!hasSpawnPoint || isTransitioning) return;
    
    setIsTransitioning(true);
    
    // Save current scenario
    const scenario = editor.exportScenario(activeScenarioName);
    console.log("[EditorRoot] Exported scenario:", scenario);
    console.log("[EditorRoot] Scenario blocks:", scenario.blocks);
    console.log("[EditorRoot] Number of blocks:", scenario.blocks.length);
    saveScenario(activeScenarioName, scenario);
    
    // Switch to game and load the scenario
    setGameScenario(scenario);
    setIsGameActive(true);
    
    // Allow transitions after a delay
    setTimeout(() => setIsTransitioning(false), 1000);
  }, [activeScenarioName, editor, hasSpawnPoint, isTransitioning]);

  const handleStopGame = useCallback(() => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setGameScenario(null);
    setIsGameActive(false);
    
    // Allow transitions after a delay
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning]);

  // Hide editor canvas when in game mode
  useEffect(() => {
    const editorCanvas = document.getElementById("editor-canvas");
    if (editorCanvas instanceof HTMLCanvasElement) {
      if (isGameActive) {
        editorCanvas.style.display = "none";
        editorCanvas.style.pointerEvents = "none";
        // Disable editor controls to prevent camera movement
        if (editor) {
          editor.disableControls();
        }
      } else {
        editorCanvas.style.display = "block";
        editorCanvas.style.pointerEvents = "auto";
        // Re-enable editor controls when returning from game
        if (editor) {
          editor.enableControls();
        }
      }
    }
  }, [isGameActive, editor]);

  return (
    <>
      <div className="absolute inset-0 flex flex-col text-[#cccccc]">
        {/* Header - Hidden during play mode */}
        {!isGameActive && (
          <header className="relative z-50 flex h-12 items-center justify-between border-b border-[#1a1a1a] bg-[#323232] px-4 pointer-events-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
            <Image
              src="/logo.png"
              alt="Redblock logo"
              width={498}
              height={410}
              className="h-8 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-0.5 text-[11px] text-[#cccccc]">
            {menuGroups.map((menu) => (
              <div key={menu.id} className="relative">
                <button
                  ref={(node) => {
                    menuAnchors.current[menu.id] = node;
                  }}
                  type="button"
                  className={`rounded px-3 py-1.5 text-[11px] transition ${
                    openMenuId === menu.id
                      ? "bg-[#4772b3] text-white"
                      : "text-[#cccccc] hover:bg-[#404040]"
                  }`}
                  onMouseEnter={() => handleMenuHover(menu.id)}
                  onMouseLeave={() => handleMenuLeave()}
                >
                  {menu.label}
                </button>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <AlertIcon alerts={alerts} />
          <button
            onClick={() => setSimpleMode(!simpleMode)}
            className="rounded px-3 py-1.5 text-[11px] transition bg-[#4a4a4a] text-[#cccccc] hover:bg-[#555555]"
            title={simpleMode ? "Switch to full editor mode" : "Switch to simple mode"}
          >
            {simpleMode ? "Switch to Full Mode" : "Switch to Simple Mode"}
          </button>
          {!isGameActive ? (
            <button
              onClick={handleStartGame}
              disabled={!hasSpawnPoint || isTransitioning}
              className={`flex h-8 items-center gap-2 rounded border border-[#1a1a1a] px-4 text-[11px] transition ${
                hasSpawnPoint && !isTransitioning
                  ? "bg-[#4772b3] text-white hover:bg-[#5a8fd6]"
                  : "bg-[#2b2b2b] text-[#666666] cursor-not-allowed"
              }`}
              title={!hasSpawnPoint ? "Add a Spawn Point to start the game" : isTransitioning ? "Loading..." : "Start the game"}
            >
              <FaPlay className="text-sm" />
              {isTransitioning ? "Loading..." : "Play"}
            </button>
          ) : (
            <button
              onClick={handleStopGame}
              disabled={isTransitioning}
              className={`flex h-8 items-center gap-2 rounded border border-[#1a1a1a] px-4 text-[11px] text-white transition ${
                isTransitioning
                  ? "bg-[#2b2b2b] cursor-not-allowed"
                  : "bg-[#ef4444] hover:bg-[#dc2626]"
              }`}
              title={isTransitioning ? "Loading..." : "Stop the game"}
            >
              <FaStop className="text-sm" />
              {isTransitioning ? "Loading..." : "Stop"}
            </button>
          )}
          <div className="flex flex-col items-end text-right">
            <div className="text-[11px] text-[#999999]">
              Scenario:{" "}
              <span className="text-[11px] text-[#cccccc]">
                {activeScenarioName}
              </span>
              {hasUnsavedChanges ? <span className="ml-1 text-[#cccccc]">*</span> : null}
            </div>
            <div className="text-[12px] font-medium text-[#cccccc]">{title}</div>
          </div>
        </div>
        </header>
        )}
        
        {openMenuId && activeMenu && menuPosition ? (
          <Portal>
            <div className="fixed inset-0 z-[900] pointer-events-none">
              <div
                ref={menuContainerRef}
                className="absolute min-w-[180px] overflow-hidden rounded border border-[#1a1a1a] bg-[#323232] shadow-lg pointer-events-auto"
                style={{ left: menuPosition.left, top: menuPosition.top, minWidth: Math.max(menuPosition.width, 160) }}
                onMouseDown={(event) => event.stopPropagation()}
                onMouseEnter={() => {
                  // Cancel any pending close timeout when mouse enters the menu
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                  }
                }}
                onMouseLeave={() => handleMenuLeave()}
              >
                {activeMenu.items.map((item) => {
                  const disabled = Boolean(item.disabled);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`block w-full px-3 py-1.5 text-left text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        disabled
                          ? "text-[#666666]"
                          : "text-[#cccccc] hover:bg-[#4772b3] hover:text-white"
                      }`}
                      onClick={() => {
                        if (disabled) {
                          return;
                        }
                        item.action();
                        closeMenus();
                      }}
                      disabled={disabled}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Portal>
        ) : null}
        
        {/* Editor Content */}
        <div className="relative flex flex-1 gap-2 overflow-hidden px-2 pb-2 pt-2">
              {showSidebar && !simpleMode && (
                <aside className="relative z-10 flex w-64 flex-col rounded border border-[#1a1a1a] bg-[#383838] pointer-events-auto overflow-auto">
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b border-[#1a1a1a]">
            <div className="text-[11px] text-[#999999] font-medium">Components</div>
            <CategoryFilter
              selectedCategories={selectedCategories}
              onToggleCategory={handleToggleCategory}
            />
          </div>
          <div className="flex-1 overflow-auto px-3 pb-3 pt-2">
            <ItemMenu
              items={filteredItems}
              activeItem={activeItem}
              onItemSelect={setActiveItem}
              onItemDragStart={(itemId) => {
                const item = filteredItems.find((entry) => entry.id === itemId) ?? null;
                setActiveItem(item);
              }}
              disabledItems={hasSpawnPoint ? ["spawn"] : []}
            />
          </div>
          {activeItem && activeItem.id.startsWith("component:") ? (
            <div className="border-t border-[#1a1a1a] px-3 py-2">
              <button
                className="w-full h-7 rounded border border-[#1a1a1a] bg-[#ef4444] text-[11px] text-white transition hover:bg-[#dc2626]"
                onClick={() => {
                  const id = activeItem.id.slice("component:".length);
                  const def = components.find((entry) => entry.id === id);
                  setComponentPendingDelete({ id, label: def?.label ?? "Componente" });
                }}
              >
                Remove Component
              </button>
            </div>
          ) : null}
        </aside>
              )}
        <main className="pointer-events-none relative flex-1">
          <div className="pointer-events-none absolute inset-0">
            {showControls && (
              <div className={`absolute left-4 top-4 flex max-w-md flex-col gap-1.5 rounded border border-[#1a1a1a] bg-[#323232]/95 text-[#cccccc] ${
                simpleMode ? 'px-4 py-2.5' : 'px-3 py-2.5'
              }`}>
                {/* Cruz blanca en la esquina superior - Solo visible en modo normal */}
                {!simpleMode && (
                  <button 
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center hover:bg-[#404040] rounded transition-colors pointer-events-auto"
                    onClick={() => setShowControls(false)}
                    title="Cerrar controles"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-white">
                      <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
                {simpleMode ? (
                  <span className="text-[11px] leading-relaxed">
                    Click to place block
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] text-[#999999] mb-0.5">
                      Controls
                    </span>
                    <span className="leading-relaxed text-[10px]">
                      Orbit with right click · Pan with Shift + right click · Zoom with scroll
                    </span>
                    <span className="leading-relaxed text-[10px]">
                      Select with left click · Move (G) · Rotate (R) · Scale (F) · constrain with X / Y / Z
                    </span>
                    <span className="leading-relaxed text-[10px]">Move camera with WASD</span>
                    <span className="leading-relaxed text-[10px]">Toggle Components (B) · Toggle Inspector (I) · Toggle Controls (C)</span>
                    {transformLabel ? (
                      <span className="mt-1 w-fit rounded border border-[#1a1a1a] bg-[#4772b3] px-2.5 py-1 text-[10px] text-white">
                        {transformLabel}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            )}
            {activeItem ? (
              <div className="absolute bottom-4 left-1/2 w-max -translate-x-1/2 rounded border border-[#1a1a1a] bg-[#323232]/95 px-4 py-2 text-[11px] text-[#cccccc]">
                Drag the {activeItem.label.toLowerCase()} from the components panel onto the canvas to place it
              </div>
            ) : null}
            {editingActive ? (
              <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded border border-[#1a1a1a] bg-[#4772b3] px-4 py-2 text-[11px] text-white">
                Press Enter to finish editing the component
              </div>
            ) : null}
          </div>
        </main>
        {showInspector && !simpleMode && (
          <aside
            className={`relative z-10 w-72 rounded border border-[#1a1a1a] bg-[#383838] p-3 transition-opacity overflow-auto ${
              inspectorVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-40"
            }`}
          >
          <PropertiesPanel
            selection={selection}
            positionState={positionState}
            scaleState={scaleState}
            rotationState={rotationState}
            onPositionChange={handlePositionChange}
            onScaleChange={handleScaleChange}
            onRotationChange={handleRotationChange}
            onGroupSelection={() => {
              // If editing a component, finish editing by regrouping into the original group id
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
            }}
            onUngroupSelection={() => {
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
            }}
            // Create a component using the currently selected group as the master
            onCreateComponent={() => {
              if (!selection || Array.isArray(selection)) return;
              // Persist definition from current group children
              const members = editor.getSelectedGroupMembersLocalTransforms();
              if (!members) return;
              const nextIndex = components.length + 1;
              const nextId = `comp-${nextIndex}`;
              const label = `Component ${nextIndex}`;
              addComponent({ id: nextId, label, members });
              editor.createComponentFromSelectedGroup(label, nextId);
              refreshComponents();
              autoSaveScenario();
            }}
            onModifyComponent={selectedComponentId ? () => {
              if (editor.isComponentEditing(selectedComponentId)) {
                editor.finishEditingComponent(selectedComponentId);
                autoSaveScenario();
              } else {
                editor.startEditingComponent(selectedComponentId);
              }
            } : undefined}
            componentEditing={isEditingComponent}
            onDeleteSelection={deleteSelection}
            onRenameSelection={renameSelection}
            onGeneratorConfigChange={(blockId, config) => {
              editor.updateGeneratorConfig(blockId, config);
              markUnsaved();
              // Force re-render by creating new selection object reference
              const currentSelection = editor.getSelection();
              if (currentSelection) {
                // Create a shallow copy to force React to detect the change
                setSelection({ ...currentSelection });
              }
            }}
            onRequestGeneratorSelection={(eventId) => {
              console.log('[EditorRoot] onRequestGeneratorSelection called with eventId:', eventId);
              console.log('[EditorRoot] Current selection:', selection);
              // Enter generator selection mode
              if (selection && !Array.isArray(selection)) {
                console.log('[EditorRoot] Entering generator selection mode');
                setGeneratorSelectionMode({
                  active: true,
                  eventId,
                  sourceGeneratorId: selection.id,
                });
                // Show visual feedback
                editor.alerts.publish(
                  `gen-select-${Date.now()}`,
                  "info",
                  "Click on a Target Generator to link it"
                );
                console.log('[EditorRoot] Alert published');
                // Auto-clear after 5 seconds
                setTimeout(() => {
                  editor.alerts.clearAll();
                }, 5000);
              } else {
                console.warn('[EditorRoot] Cannot enter selection mode - no valid selection');
              }
            }}
            setTyping={setTyping}
          />
        </aside>
        )}
        </div>

        {/* Game Overlay - Full screen */}
        <div className={`absolute inset-0 z-40 pointer-events-auto ${!isGameActive ? 'hidden' : ''}`}>
          <GameTab 
            scenario={gameScenario} 
            isActive={isGameActive} 
            onStop={handleStopGame} 
          />
        </div>
      </div>
    <ScenarioModal
      open={isScenarioModalOpen}
      scenarios={scenarioRecords}
      onClose={() => setIsScenarioModalOpen(false)}
      onSelectScenario={handleSelectScenario}
      onDeleteScenario={handleDeleteScenario}
      onDownloadScenario={handleDownloadScenario}
      onImportFiles={handleImportScenarioFiles}
    />
    <ComponentDeleteModal
      open={componentPendingDelete !== null}
      componentName={componentPendingDelete?.label ?? ""}
      onCancel={handleCancelDeleteComponent}
      onConfirm={handleConfirmDeleteComponent}
    />
  </>
);
}
