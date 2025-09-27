import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Euler, Group, Quaternion, Vector3 } from "three";
import EditorApp, { type EditorBlock, type EditorSelection, type SelectionTransform } from "../EditorApp";
import { Object3D, Quaternion as ThreeQuaternion } from "three";
import type { EditorItem } from "../types";
import { addComponent, getComponent, loadComponents, removeComponent } from "../componentsStore";
import { ItemMenu } from "./ItemMenu";
import { PropertiesPanel } from "./PropertiesPanel";
import type { SavedComponent } from "../componentsStore";

const builtinItems: EditorItem[] = [
  { id: "block", label: "Block" },
];

const MOVE_SENSITIVITY = 0.02;
const ROTATE_SENSITIVITY = 0.005;
const SCALE_SENSITIVITY = 0.01;
const MIN_SCALE = 0.1;

type TransformMode = "translate" | "rotate" | "scale";
type AxisConstraint = "x" | "y" | "z" | null;

const AXIS_VECTORS: Record<Exclude<AxisConstraint, null>, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

type TransformSession = {
  mode: TransformMode;
  axis: AxisConstraint;
  origin: SelectionTransform;
  delta: { x: number; y: number };
};

const cloneTransformSnapshot = (input: SelectionTransform): SelectionTransform => ({
  position: input.position.clone(),
  rotation: input.rotation.clone(),
  scale: input.scale.clone(),
});

export function EditorRoot({ editor }: { editor: EditorApp }): JSX.Element {
  const [activeItem, setActiveItem] = useState<EditorItem | null>(null);
  const [components, setComponents] = useState<SavedComponent[]>([]);
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [positionState, setPositionState] = useState({ x: 0, y: 0, z: 0 });
  const [scaleState, setScaleState] = useState({ x: 1, y: 1, z: 1 });
  const [rotationState, setRotationState] = useState({ x: 0, y: 0, z: 0 });

  const transformSessionRef = useRef<TransformSession | null>(null);
  const selectedItemRef = useRef<EditorItem | null>(null);

  const [transformMode, setTransformMode] = useState<TransformMode | null>(null);
  const [activeAxis, setActiveAxis] = useState<AxisConstraint>(null);

  type GroupMember = { id: string; transform: SelectionTransform };
  type HistoryAction =
    | { type: "add"; id: string; transform: SelectionTransform }
    | { type: "transform"; id: string; before: SelectionTransform; after: SelectionTransform }
    | { type: "group"; groupId: string; members: GroupMember[] }
    | { type: "ungroup"; groupId: string; members: GroupMember[] };

  const undoStack = useRef<HistoryAction[]>([]);
  const redoStack = useRef<HistoryAction[]>([]);

  const pushHistory = useCallback((action: HistoryAction) => {
    undoStack.current.push(action);
    redoStack.current = [];
  }, []);

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
    // load components from localStorage
    setComponents(loadComponents());
  }, []);
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

  const releasePointerLock = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (document.pointerLockElement === editor.getCanvas()) {
      document.exitPointerLock();
    }
  }, [editor]);

  useEffect(() => {
    return () => {
      releasePointerLock();
    };
  }, [releasePointerLock]);

  const finishTransform = useCallback(
    (commit: boolean) => {
      const session = transformSessionRef.current;
      if (!session) {
        return;
      }

      if (!commit) {
        const original = cloneTransformSnapshot(session.origin);
        editor.updateSelectedBlockPosition(original.position);
        editor.updateSelectedBlockRotation(original.rotation);
        editor.updateSelectedBlockScale(original.scale);
        applyTransformToState(original);
      } else {
        const after = editor.getSelectionTransform();
        const before = session.origin;
        if (after) {
          // Avoid no-op history (tiny deltas are ignored)
          const changed =
            Math.abs(after.position.x - before.position.x) > 1e-6 ||
            Math.abs(after.position.y - before.position.y) > 1e-6 ||
            Math.abs(after.position.z - before.position.z) > 1e-6 ||
            Math.abs(after.rotation.x - before.rotation.x) > 1e-6 ||
            Math.abs(after.rotation.y - before.rotation.y) > 1e-6 ||
            Math.abs(after.rotation.z - before.rotation.z) > 1e-6 ||
            Math.abs(after.scale.x - before.scale.x) > 1e-6 ||
            Math.abs(after.scale.y - before.scale.y) > 1e-6 ||
            Math.abs(after.scale.z - before.scale.z) > 1e-6;

          if (changed) {
            const sel = editor.getSelection();
            if (sel) {
              pushHistory({ type: "transform", id: sel.id, before: cloneTransformSnapshot(before), after });
            }
          }
          applyTransformToState(after);
        }
      }

      transformSessionRef.current = null;
      setTransformMode(null);
      setActiveAxis(null);
      releasePointerLock();
    },
    [editor, applyTransformToState, releasePointerLock, pushHistory],
  );

  const startTransform = useCallback(
    (mode: TransformMode) => {
      const currentSelection = editor.getSelection();
      if (!currentSelection) {
        return;
      }
      const currentTransform = editor.getSelectionTransform();
      if (!currentTransform) {
        return;
      }

      if (transformSessionRef.current) {
        finishTransform(true);
      }

      transformSessionRef.current = {
        mode,
        axis: null,
        origin: cloneTransformSnapshot(currentTransform),
        delta: { x: 0, y: 0 },
      };
      setTransformMode(mode);
      setActiveAxis(null);

      if (typeof document !== "undefined") {
        const canvas = editor.getCanvas();
        if (document.pointerLockElement !== canvas) {
          try {
            canvas.requestPointerLock();
          } catch {
            // ignore pointer lock errors (not supported / denied)
          }
        }
      }
    },
    [editor, finishTransform],
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const canvas = editor.getCanvas();
    const handlePointerLockChange = () => {
      if (document.pointerLockElement !== canvas && transformSessionRef.current) {
        finishTransform(false);
      }
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => document.removeEventListener("pointerlockchange", handlePointerLockChange);
  }, [editor, finishTransform]);

  const applyTransform = useCallback(() => {
    const session = transformSessionRef.current;
    if (!session) {
      return;
    }

    const snapshot = cloneTransformSnapshot(session.origin);

    switch (session.mode) {
      case "translate": {
        const cameraQuaternion = editor.getCamera().getWorldQuaternion(new Quaternion());
        const cameraRight = new Vector3(1, 0, 0).applyQuaternion(cameraQuaternion);
        const cameraUp = new Vector3(0, 1, 0).applyQuaternion(cameraQuaternion);
        const pointerWorld = cameraRight
          .clone()
          .multiplyScalar(session.delta.x)
          .addScaledVector(cameraUp, -session.delta.y);

        snapshot.position.copy(session.origin.position);

        if (session.axis === null) {
          const groundDelta = pointerWorld.clone();
          groundDelta.y = 0;
          snapshot.position.addScaledVector(groundDelta, MOVE_SENSITIVITY);
        } else {
          const axisVector = AXIS_VECTORS[session.axis];
          const amount = pointerWorld.dot(axisVector) * MOVE_SENSITIVITY;
          snapshot.position.addScaledVector(axisVector, amount);
        }

        editor.updateSelectedBlockPosition(snapshot.position);
        break;
      }
      case "rotate": {
        const deltaX = session.delta.x * ROTATE_SENSITIVITY;
        const deltaY = session.delta.y * ROTATE_SENSITIVITY;
        if (session.axis === null) {
          snapshot.rotation.y = session.origin.rotation.y + deltaX;
        } else if (session.axis === "x") {
          snapshot.rotation.x = session.origin.rotation.x + deltaY;
        } else if (session.axis === "y") {
          snapshot.rotation.y = session.origin.rotation.y + deltaX;
        } else if (session.axis === "z") {
          snapshot.rotation.z = session.origin.rotation.z + deltaX;
        }
        editor.updateSelectedBlockRotation(snapshot.rotation);
        break;
      }
      case "scale": {
        const ratio = 1 - session.delta.y * SCALE_SENSITIVITY;
        const safeRatio = ratio <= 0 ? 0.01 : ratio;
        if (session.axis === null) {
          snapshot.scale.set(
            Math.max(MIN_SCALE, session.origin.scale.x * safeRatio),
            Math.max(MIN_SCALE, session.origin.scale.y * safeRatio),
            Math.max(MIN_SCALE, session.origin.scale.z * safeRatio),
          );
        } else {
          if (session.axis === "x") {
            snapshot.scale.x = Math.max(MIN_SCALE, session.origin.scale.x * safeRatio);
          }
          if (session.axis === "y") {
            snapshot.scale.y = Math.max(MIN_SCALE, session.origin.scale.y * safeRatio);
          }
          if (session.axis === "z") {
            snapshot.scale.z = Math.max(MIN_SCALE, session.origin.scale.z * safeRatio);
          }
        }
        editor.updateSelectedBlockScale(snapshot.scale);
        break;
      }
    }

    applyTransformToState(snapshot);
  }, [applyTransformToState, editor]);

  const applyTransformSnapshot = useCallback(
    (id: string, snap: SelectionTransform) => {
      const ok = editor.applyTransform(id, snap);
      if (ok) applyTransformToState(editor.getSelectionTransform());
    },
    [editor, applyTransformToState],
  );

  const undo = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) return;
    if (action.type === "add") {
      editor.removeBlock(action.id);
    } else if (action.type === "transform") {
      applyTransformSnapshot(action.id, action.before);
    } else if (action.type === "group") {
      // Undo grouping: remove group, restore members
      editor.removeBlock(action.groupId);
      for (const m of action.members) {
        editor.createBlock({ id: m.id, position: m.transform.position, rotation: m.transform.rotation, scale: m.transform.scale });
      }
      // Reselect restored members for continuity
      editor.setSelectionByIds(action.members.map((m) => m.id));
    } else if (action.type === "ungroup") {
      // Undo ungroup: recreate the group from members
      editor.groupByIds(action.members.map((m) => m.id), action.groupId);
    }
    redoStack.current.push(action);
  }, [editor, applyTransformSnapshot]);

  const redo = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) return;
    if (action.type === "add") {
      editor.createBlock({
        id: action.id,
        position: action.transform.position,
        rotation: action.transform.rotation,
        scale: action.transform.scale,
      });
    } else if (action.type === "transform") {
      applyTransformSnapshot(action.id, action.after);
    } else if (action.type === "group") {
      // Redo grouping: group the members again with same groupId
      editor.groupByIds(action.members.map((m) => m.id), action.groupId);
    } else if (action.type === "ungroup") {
      // Redo ungroup: select group and ungroup
      editor.setSelectionByIds([action.groupId]);
      editor.ungroupSelected();
    }
    undoStack.current.push(action);
  }, [editor, applyTransformSnapshot]);

  useEffect(() => {
    return editor.addSelectionListener((block) => {
      transformSessionRef.current = null;
      setTransformMode(null);
      setActiveAxis(null);
      setSelection(block);
      // Only sync state from single selection
      applyTransformToState(editor.getSelectionTransform());
    });
  }, [editor, applyTransformToState]);

  useEffect(() => {
    const canvas = editor.getCanvas();

    const handlePointerDown = (event: PointerEvent) => {
      // Only react to left-click for selection/placement
      if (event.button !== 0) {
        return;
      }
      if (transformSessionRef.current) {
        if (event.button === 0) {
          event.preventDefault();
          finishTransform(true);
        }
        return;
      }

      const additive = (event.ctrlKey ?? false) || (event.metaKey ?? false);
      const picked = editor.pickBlock(event.clientX, event.clientY, additive);
      if (picked) {
        // If a palette item was selected, clear it when user picks a world block
        if (selectedItemRef.current) {
          setActiveItem(null);
        }
      }
      editor.clearMovementState?.();
    };

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
  }, [editor, finishTransform, editingActive, pushHistory]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = transformSessionRef.current;
      if (!session) {
        return;
      }
      session.delta.x += event.movementX;
      session.delta.y += event.movementY;
      event.preventDefault();
      applyTransform();
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [applyTransform]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.key === "Escape") {
        if (transformSessionRef.current) {
          event.preventDefault();
          finishTransform(false);
          return;
        }
        setActiveItem(null);
        editor.clearSelection();
        return;
      }

      const key = event.key.toLowerCase();

      // Finish component editing with Enter
      if (event.key === "Enter") {
        const editingId = editor.getEditingComponentId();
        if (editingId) {
          event.preventDefault();
          editor.finishEditingComponent(editingId);
          return;
        }
      }

      // Undo/Redo (Win/Linux: Ctrl+Z / Ctrl+Y, macOS: Cmd+Z / Cmd+Shift+Z)
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const meta = event.metaKey;
      const ctrl = event.ctrlKey;
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
      const session = transformSessionRef.current;

      if (session) {
        if (key === "x" || key === "y" || key === "z") {
          event.preventDefault();
          const targetAxis = key as AxisConstraint;
          const nextAxis = session.axis === targetAxis ? null : targetAxis;
          session.axis = nextAxis;
          setActiveAxis(nextAxis);
          applyTransform();
          return;
        }

        if (event.key === "Enter" || event.key === "Return" || event.key === " ") {
          event.preventDefault();
          finishTransform(true);
          return;
        }
      }

      if (key === "g" || key === "r" || key === "f") {
        if (!editor.getSelection()) {
          return;
        }
        event.preventDefault();
        const mode: TransformMode = key === "g" ? "translate" : key === "r" ? "rotate" : "scale";
        startTransform(mode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, finishTransform, startTransform, applyTransform, undo, redo]);

  useEffect(() => {
    if (!selection || Array.isArray(selection)) {
      return;
    }
    if (transformSessionRef.current) {
      return;
    }
    editor.updateSelectedBlockPosition(new Vector3(positionState.x, positionState.y, positionState.z));
  }, [editor, positionState, selection]);

  useEffect(() => {
    if (!selection || Array.isArray(selection)) {
      return;
    }
    if (transformSessionRef.current) {
      return;
    }
    editor.updateSelectedBlockScale(new Vector3(scaleState.x, scaleState.y, scaleState.z));
  }, [editor, scaleState, selection]);

  useEffect(() => {
    if (!selection || Array.isArray(selection)) {
      return;
    }
    if (transformSessionRef.current) {
      return;
    }
    editor.updateSelectedBlockRotation(
      new Euler(
        (rotationState.x * Math.PI) / 180,
        (rotationState.y * Math.PI) / 180,
        (rotationState.z * Math.PI) / 180,
      ),
    );
  }, [editor, rotationState, selection]);

  const inspectorVisible = selection !== null;

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

  return (
    <div className={`absolute inset-0 z-50 flex flex-col text-rb-text`}>
      <header className={`relative z-50 flex h-14 items-center justify-between border-b border-rb-border bg-white px-6 outline outline-3 outline-rb-border pointer-events-auto`}>
        <div className="text-xs uppercase tracking-widest text-rb-muted">World Builder</div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-rb-muted">Current route: /editor</div>
      </header>
      <div className="flex flex-1 overflow-hidden ">
        <aside className={`relative z-50 flex w-64 flex-col border-r border-rb-border bg-rb-panel p-4 outline outline-3 outline-rb-border pointer-events-auto`}>
          <div className="mb-4 text-xs uppercase text-rb-muted">Library</div>
          <ItemMenu
            items={items}
            activeItem={activeItem}
            onItemSelect={setActiveItem}
            onItemDragStart={(itemId) => {
              const item = items.find((entry) => entry.id === itemId) ?? null;
              setActiveItem(item);
            }}
          />
          {activeItem && activeItem.id.startsWith("component:") ? (
            <div className="mt-4 flex flex-col gap-2">
              <button
                className="h-9 rounded border border-rb-border bg-white px-3 text-xs font-semibold uppercase tracking-widest text-rb-text hover:bg-black hover:text-white"
                onClick={() => {
                  const id = activeItem.id.slice("component:".length);
                  removeComponent(id);
                  setComponents(loadComponents());
                  setActiveItem(null);
                }}
              >
                Remove Component
              </button>
            </div>
          ) : null}
        </aside>
        <main className="pointer-events-none relative flex-1">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-6 top-6 flex flex-col gap-1 rounded border border-rb-border bg-white/80 px-3 py-2 text-xs text-rb-muted shadow-sm outline outline-3 outline-rb-border">
              <span>Orbit with right click · Pan with Shift + right click · Zoom with scroll</span>
              <span>Select with left click · Move (G) · Rotate (R) · Scale (F) · constrain with X / Y / Z</span>
              <span>Move camera with WASD</span>
              {transformLabel ? (
                <span className="mt-1 rounded border border-rb-border bg-rb-panel px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-rb-muted outline outline-3 outline-rb-border">
                  {transformLabel}
                </span>
              ) : null}
            </div>
            {activeItem ? (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded border border-rb-border bg-white/90 px-4 py-2 text-xs text-rb-muted outline outline-3 outline-rb-border">
                Drag the {activeItem.label.toLowerCase()} from the library onto the canvas to place it
              </div>
            ) : null}
            {editingActive ? (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded border border-rb-border bg-black/80 px-4 py-2 text-xs font-semibold text-white outline outline-3 outline-rb-border z-20">
                Press Enter to finish editing the component
              </div>
            ) : null}
          </div>
        </main>
        <aside
          className={`relative z-50 w-72 border-l border-rb-border bg-rb-panel p-4 transition-opacity outline outline-3 outline-rb-border ${
            inspectorVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-40"
          }`}
        >
          <PropertiesPanel
            selection={selection}
            positionState={positionState}
            scaleState={scaleState}
            rotationState={rotationState}
            onPositionChange={setPositionState}
            onScaleChange={setScaleState}
            onRotationChange={setRotationState}
            onGroupSelection={() => {
              // If editing a component, finish editing by regrouping into the original group id
              const editingId = editor.getEditingComponentId();
              if (editingId) {
                editor.finishEditingComponent(editingId);
                return;
              }
              if (!selection || !Array.isArray(selection)) return;
              const members: GroupMember[] = selection.map((b) => ({ id: b.id, transform: snapshotFromBlock(b) }));
              const res = editor.groupSelection();
              if (res) {
                pushHistory({ type: "group", groupId: res.id, members });
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
              }
            }}
            // Create a component using the currently selected group as the master
            onCreateComponent={() => {
              if (!selection || Array.isArray(selection)) return;
              // Persist definition from current group children
              const members = editor.getSelectedGroupMembersLocalTransforms();
              if (!members) return;
              const existing = loadComponents();
              const nextIndex = existing.length + 1;
              const nextId = `comp-${nextIndex}`;
              const label = `Component ${nextIndex}`;
              addComponent({ id: nextId, label, members });
              editor.createComponentFromSelectedGroup(label, nextId);
              setComponents(loadComponents());
            }}
            onModifyComponent={selectedComponentId ? () => {
              if (editor.isComponentEditing(selectedComponentId)) {
                editor.finishEditingComponent(selectedComponentId);
              } else {
                editor.startEditingComponent(selectedComponentId);
              }
            } : undefined}
            componentEditing={isEditingComponent}
          />
        </aside>
      </div>
    </div>
  );
}
