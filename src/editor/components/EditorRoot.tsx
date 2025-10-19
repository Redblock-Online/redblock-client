import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type SetStateAction } from "react";
import { Euler, Group, Vector3, Object3D, Quaternion as ThreeQuaternion } from "three";
import { FaPlay, FaStop } from "react-icons/fa";
import EditorApp from "../EditorApp";
import type { EditorBlock, EditorSelection, SelectionTransform, SerializedNode } from "../types";
import type { EditorItem } from "../types";
import { addComponent, getComponent } from "../componentsStore";
import { useComponentRegistry } from "../hooks/useComponentRegistry";
import { ItemMenu } from "./ItemMenu";
import { PropertiesPanel } from "./PropertiesPanel";
import { useHistoryStack, type GroupMember } from "../hooks/useHistoryStack";
import type { TransformMode, AxisConstraint } from "../core/EditorModeManager";
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
} from "../scenarioStore";
import type { SerializedScenario } from "../scenarioStore";
import type { Alert } from "../core/AlertManager";
import { AlertIcon } from "./AlertIcon";

type VectorState = { x: number; y: number; z: number };
type ClipboardPayload = {
  nodes: SerializedNode[];
  componentIds: string[];
};

const builtinItems: EditorItem[] = [
  { id: "block", label: "Block" },
  { id: "spawn", label: "Spawn Point" },
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
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  const selectedItemRef = useRef<EditorItem | null>(null);

  const [scenarioRecords, setScenarioRecords] = useState<StoredScenario[]>([]);
  const [activeScenarioName, setActiveScenarioName] = useState<string>(AUTO_SAVE_SCENARIO_NAME);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const menuAnchors = useRef<Record<string, HTMLButtonElement | null>>({});
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
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [openMenuId, updateMenuPosition]);

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
        id: "components",
        label: "Components",
        items: [{ id: "components-refresh", label: "Refresh list", action: handleRefreshComponentsMenu }],
      },
    ],
    [handleLoadScenario, handleNewScenario, handleRefreshComponentsMenu, handleSaveCurrentScenario, handleSaveScenarioAs, hasUnsavedChanges],
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
      ...components.map((c) => ({ id: `component:${c.id}`, label: c.label })),
    ];
  }, [components]);

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
  }, [editor, applyTransformToState, editingActive]);

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
    const currentSelection = selection
      ? Array.isArray(selection)
        ? selection
        : [selection]
      : editor.getSelectionArray();
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
  }, [editor, selection]);

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
      panelAutoSavePendingRef.current = false;
      autoSaveScenario();
    }
  }, [autoSaveScenario, editor]);

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

      // Delete
      if ((event.key === "Delete" || event.key === "Backspace") && (selection || editor.getSelectionArray().length > 0)) {
        event.preventDefault();
        deleteSelection();
        return;
      }

      // Escape to clear selection
      if (event.key === "Escape" && !transformMode) {
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
          <Image
            src="/logo.png"
            alt="Redblock logo"
            width={498}
            height={410}
            className="h-8 w-auto"
          />
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
                  onClick={() => {
                    if (openMenuId === menu.id) {
                      closeMenus();
                    } else {
                      setOpenMenuId(menu.id);
                      updateMenuPosition(menu.id);
                    }
                  }}
                >
                  {menu.label}
                </button>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <AlertIcon alerts={alerts} />
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
            <div className="fixed inset-0 z-[900]" onMouseDown={closeMenus}>
              <div
                className="absolute min-w-[180px] overflow-hidden rounded border border-[#1a1a1a] bg-[#323232] shadow-lg"
                style={{ left: menuPosition.left, top: menuPosition.top, minWidth: Math.max(menuPosition.width, 160) }}
                onMouseDown={(event) => event.stopPropagation()}
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
              {showSidebar && (
                <aside className="relative z-10 flex w-64 flex-col gap-2 rounded border border-[#1a1a1a] bg-[#383838] p-3 pointer-events-auto overflow-auto">
          <div className="text-[11px] text-[#999999] mb-1">Components</div>
          <ItemMenu
            items={items}
            activeItem={activeItem}
            onItemSelect={setActiveItem}
            onItemDragStart={(itemId) => {
              const item = items.find((entry) => entry.id === itemId) ?? null;
              setActiveItem(item);
            }}
            disabledItems={hasSpawnPoint ? ["spawn"] : []}
          />
          {activeItem && activeItem.id.startsWith("component:") ? (
            <div className="mt-4 flex flex-col gap-2">
              <button
                className="h-7 rounded border border-[#1a1a1a] bg-[#ef4444] text-[11px] text-white transition hover:bg-[#dc2626]"
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
            <div className="absolute left-4 top-4 flex max-w-md flex-col gap-1.5 rounded border border-[#1a1a1a] bg-[#323232]/95 px-3 py-2.5 text-[11px] text-[#cccccc]">
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
              <span className="leading-relaxed text-[10px]">Toggle Components (B) · Toggle Inspector (I)</span>
              {transformLabel ? (
                <span className="mt-1 w-fit rounded border border-[#1a1a1a] bg-[#4772b3] px-2.5 py-1 text-[10px] text-white">
                  {transformLabel}
                </span>
              ) : null}
            </div>
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
        {showInspector && (
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
