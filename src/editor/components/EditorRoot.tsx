import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Euler, Quaternion, Vector3 } from "three";
import EditorApp, { type EditorBlock, type SelectionTransform } from "../EditorApp";
import type { EditorItem } from "../types";
import { ItemMenu } from "./ItemMenu";
import { PropertiesPanel } from "./PropertiesPanel";

const items: EditorItem[] = [
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
  const [selection, setSelection] = useState<EditorBlock | null>(null);
  const [positionState, setPositionState] = useState({ x: 0, y: 0, z: 0 });
  const [scaleState, setScaleState] = useState({ x: 1, y: 1, z: 1 });
  const [rotationState, setRotationState] = useState({ x: 0, y: 0, z: 0 });

  const transformSessionRef = useRef<TransformSession | null>(null);
  const selectedItemRef = useRef<EditorItem | null>(null);

  const [transformMode, setTransformMode] = useState<TransformMode | null>(null);
  const [activeAxis, setActiveAxis] = useState<AxisConstraint>(null);

  type HistoryAction =
    | { type: "add"; id: string; transform: SelectionTransform }
    | { type: "transform"; id: string; before: SelectionTransform; after: SelectionTransform };

  const undoStack = useRef<HistoryAction[]>([]);
  const redoStack = useRef<HistoryAction[]>([]);

  const pushHistory = useCallback((action: HistoryAction) => {
    undoStack.current.push(action);
    redoStack.current = [];
  }, []);

  useEffect(() => {
    selectedItemRef.current = activeItem;
  }, [activeItem]);

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
    [editor, applyTransformToState, releasePointerLock],
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
    }
    undoStack.current.push(action);
  }, [editor, applyTransformSnapshot]);

  useEffect(() => {
    return editor.addSelectionListener((block) => {
      transformSessionRef.current = null;
      setTransformMode(null);
      setActiveAxis(null);
      setSelection(block);
      applyTransformToState(editor.getSelectionTransform());
    });
  }, [editor, applyTransformToState]);

  useEffect(() => {
    const canvas = editor.getCanvas();

    const handlePointerDown = (event: PointerEvent) => {
      if (transformSessionRef.current) {
        if (event.button === 0) {
          event.preventDefault();
          finishTransform(true);
        }
        return;
      }

      const picked = editor.pickBlock(event.clientX, event.clientY);
      if (picked) {
        // If a palette item was selected, clear it when user picks a world block
        if (selectedItemRef.current) {
          setActiveItem(null);
        }
      }
    };

    const handleDragOver = (event: DragEvent) => {
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
      const data = event.dataTransfer?.getData("text/plain");
      if (data !== "block") {
        return;
      }
      event.preventDefault();
      const placed = editor.placeBlockAt(event.clientX, event.clientY);
      if (placed) {
        const t = editor.getSelectionTransform();
        if (t) {
          pushHistory({ type: "add", id: placed.id, transform: t });
        }
      }
      setActiveItem(items[0]);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("drop", handleDrop);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("drop", handleDrop);
    };
  }, [editor, finishTransform]);

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
  }, [editor, finishTransform, startTransform, applyTransform]);

  useEffect(() => {
    if (!selection) {
      return;
    }
    if (transformSessionRef.current) {
      return;
    }
    editor.updateSelectedBlockPosition(new Vector3(positionState.x, positionState.y, positionState.z));
  }, [editor, positionState, selection]);

  useEffect(() => {
    if (!selection) {
      return;
    }
    if (transformSessionRef.current) {
      return;
    }
    editor.updateSelectedBlockScale(new Vector3(scaleState.x, scaleState.y, scaleState.z));
  }, [editor, scaleState, selection]);

  useEffect(() => {
    if (!selection) {
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

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col text-white">
      <header className="pointer-events-auto flex h-14 items-center justify-between border-b border-white/10 bg-[#1e1e1e]/90 px-6">
        <div className="text-xs uppercase tracking-widest text-white/70">World Builder</div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-white/50">Current route: /editor</div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="pointer-events-auto flex w-64 flex-col border-r border-white/10 bg-[#202020]/95 p-4">
          <div className="mb-4 text-xs uppercase text-white/50">Library</div>
          <ItemMenu
            items={items}
            activeItem={activeItem}
            onItemSelect={setActiveItem}
            onItemDragStart={(itemId) => {
              const item = items.find((entry) => entry.id === itemId) ?? null;
              setActiveItem(item);
            }}
          />
        </aside>
        <main className="pointer-events-none relative flex-1">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-6 top-6 flex flex-col gap-1 rounded bg-black/40 px-3 py-2 text-xs text-white/70">
              <span>Orbit with right click · Pan with Shift + right click · Zoom with scroll</span>
              <span>Select with left click · Move (G) · Rotate (R) · Scale (F) · constrain with X / Y / Z</span>
              <span>Move camera with WASD</span>
              {transformLabel ? (
                <span className="mt-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80">
                  {transformLabel}
                </span>
              ) : null}
            </div>
            {activeItem ? (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded bg-[#2b2b2b]/90 px-4 py-2 text-xs text-white/80">
                Drag the {activeItem.label.toLowerCase()} from the library onto the canvas to place it
              </div>
            ) : null}
          </div>
        </main>
        <aside
          className={`pointer-events-auto w-72 border-l border-white/10 bg-[#1c1c1c]/95 p-4 transition-opacity ${
            inspectorVisible ? "opacity-100" : "pointer-events-none opacity-40"
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
          />
        </aside>
      </div>
    </div>
  );
}
