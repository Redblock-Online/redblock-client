import { useCallback, useEffect, useRef, useState } from "react";
import { Quaternion, Vector3 } from "three";
import type EditorApp from "../EditorApp";
import type { SelectionTransform } from "../types";
import type { HistoryAction } from "./useHistoryStack";
import { cloneTransform, hasTransformChanged } from "../core/EditorTransformUtils";

export type TransformMode = "translate" | "rotate" | "scale";
export type AxisConstraint = "x" | "y" | "z" | null;

type TransformTarget = {
  id: string;
  origin: SelectionTransform;
};

type TransformSession = {
  mode: TransformMode;
  axis: AxisConstraint;
  targets: TransformTarget[];
  delta: { x: number; y: number };
};

const MOVE_SENSITIVITY = 0.02;
const ROTATE_SENSITIVITY = 0.005;
const SCALE_SENSITIVITY = 0.01;
const MIN_SCALE = 0.1;

const AXIS_VECTORS: Record<Exclude<AxisConstraint, null>, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

export function useTransformSession(
  editor: EditorApp,
  applyTransformToState: (transform: SelectionTransform | null) => void,
  pushHistory: (action: HistoryAction) => void,
  onCommit?: () => void,
): {
  transformMode: TransformMode | null;
  activeAxis: AxisConstraint;
  startTransform: (mode: TransformMode) => void;
  finishTransform: (commit: boolean) => void;
  updatePointerDelta: (movementX: number, movementY: number) => void;
  toggleAxis: (axis: Exclude<AxisConstraint, null>) => void;
  resetSession: () => void;
  releasePointerLock: () => void;
} {
  const transformSessionRef = useRef<TransformSession | null>(null);
  const pointerLockRequestedRef = useRef(false);
  const [transformMode, setTransformMode] = useState<TransformMode | null>(null);
  const [activeAxis, setActiveAxis] = useState<AxisConstraint>(null);

  const releasePointerLock = useCallback(() => {
    pointerLockRequestedRef.current = false;
    if (typeof document === "undefined") {
      return;
    }
    const canvas = editor.getCanvas();
    if (document.pointerLockElement === canvas) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore pointer lock exit errors
      }
    }
  }, [editor]);

  const applyTransform = useCallback(() => {
    const session = transformSessionRef.current;
    if (!session || session.targets.length === 0) {
      return;
    }

    const updates: Array<{ id: string; transform: SelectionTransform }> = [];

    switch (session.mode) {
      case "translate": {
        const cameraQuaternion = editor.getCamera().getWorldQuaternion(new Quaternion());
        const cameraRight = new Vector3(1, 0, 0).applyQuaternion(cameraQuaternion);
        const cameraUp = new Vector3(0, 1, 0).applyQuaternion(cameraQuaternion);
        const pointerWorld = cameraRight
          .clone()
          .multiplyScalar(session.delta.x)
          .addScaledVector(cameraUp, -session.delta.y);

        const translationDelta = new Vector3();
        if (session.axis === null) {
          const groundDelta = pointerWorld.clone();
          groundDelta.y = 0;
          translationDelta.copy(groundDelta.multiplyScalar(MOVE_SENSITIVITY));
        } else {
          const axisVector = AXIS_VECTORS[session.axis];
          const amount = pointerWorld.dot(axisVector) * MOVE_SENSITIVITY;
          translationDelta.copy(axisVector).multiplyScalar(amount);
        }

        for (const target of session.targets) {
          const position = target.origin.position.clone().add(translationDelta);
          updates.push({
            id: target.id,
            transform: {
              position,
              rotation: target.origin.rotation.clone(),
              scale: target.origin.scale.clone(),
            },
          });
        }
        break;
      }
      case "rotate": {
        const deltaX = session.delta.x * ROTATE_SENSITIVITY;
        const deltaY = session.delta.y * ROTATE_SENSITIVITY;
        for (const target of session.targets) {
          const rotation = target.origin.rotation.clone();
          if (session.axis === null) {
            rotation.y = target.origin.rotation.y + deltaX;
          } else if (session.axis === "x") {
            rotation.x = target.origin.rotation.x + deltaY;
          } else if (session.axis === "y") {
            rotation.y = target.origin.rotation.y + deltaX;
          } else if (session.axis === "z") {
            rotation.z = target.origin.rotation.z + deltaX;
          }
          updates.push({
            id: target.id,
            transform: {
              position: target.origin.position.clone(),
              rotation,
              scale: target.origin.scale.clone(),
            },
          });
        }
        break;
      }
      case "scale": {
        const ratio = 1 - session.delta.y * SCALE_SENSITIVITY;
        const safeRatio = ratio <= 0 ? 0.01 : ratio;
        for (const target of session.targets) {
          const scale = target.origin.scale.clone();
          if (session.axis === null) {
            scale.set(
              Math.max(MIN_SCALE, target.origin.scale.x * safeRatio),
              Math.max(MIN_SCALE, target.origin.scale.y * safeRatio),
              Math.max(MIN_SCALE, target.origin.scale.z * safeRatio),
            );
          } else {
            if (session.axis === "x") {
              scale.x = Math.max(MIN_SCALE, target.origin.scale.x * safeRatio);
            }
            if (session.axis === "y") {
              scale.y = Math.max(MIN_SCALE, target.origin.scale.y * safeRatio);
            }
            if (session.axis === "z") {
              scale.z = Math.max(MIN_SCALE, target.origin.scale.z * safeRatio);
            }
          }
          updates.push({
            id: target.id,
            transform: {
              position: target.origin.position.clone(),
              rotation: target.origin.rotation.clone(),
              scale,
            },
          });
        }
        break;
      }
    }

    if (updates.length > 0) {
      editor.applyTransformsForIds(updates);
      applyTransformToState(updates[0]?.transform ?? null);
    }
  }, [editor, applyTransformToState]);

  const finishTransform = useCallback(
    (commit: boolean) => {
      console.log('[useTransformSession] finishTransform called, commit:', commit);
      const session = transformSessionRef.current;
      if (!session || session.targets.length === 0) {
        console.log('[useTransformSession] No active session');
        return;
      }
      console.log('[useTransformSession] Session mode:', session.mode, 'targets:', session.targets.length);

      if (!commit) {
        console.log('[useTransformSession] Reverting transforms (commit=false)');
        editor.applyTransformsForIds(
          session.targets.map((target) => ({ id: target.id, transform: cloneTransform(target.origin) })),
        );
        applyTransformToState(session.targets[0]?.origin ?? null);
      } else {
        console.log('[useTransformSession] Committing transforms');
        const ids = session.targets.map((target) => target.id);
        const current = editor.getTransformsForIds(ids);
        console.log('[useTransformSession] Current transforms:', current);
        const changes: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }> = [];
        for (const target of session.targets) {
          const currentEntry = current.find((entry) => entry.id === target.id);
          if (!currentEntry) {
            console.log('[useTransformSession] No current entry for', target.id);
            continue;
          }
          const hasChanged = hasTransformChanged(target.origin, currentEntry.transform);
          console.log('[useTransformSession] Block', target.id, 'changed:', hasChanged);
          if (hasChanged) {
            changes.push({ id: target.id, before: cloneTransform(target.origin), after: cloneTransform(currentEntry.transform) });
          }
        }

        console.log('[useTransformSession] Collected', changes.length, 'changes');
        if (changes.length > 0) {
          if (changes.length === 1) {
            const entry = changes[0];
            console.log('[useTransformSession] Pushing single transform to history');
            pushHistory({ type: "transform", id: entry.id, before: entry.before, after: entry.after });
            applyTransformToState(entry.after);
          } else {
            console.log('[useTransformSession] Pushing multi-transform to history');
            pushHistory({ type: "multi-transform", entries: changes });
            applyTransformToState(changes[0]?.after ?? null);
          }
          onCommit?.();
        } else {
          console.log('[useTransformSession] No changes detected, not pushing to history');
          applyTransformToState(session.targets[0]?.origin ?? null);
        }
      }

      transformSessionRef.current = null;
      setTransformMode(null);
      setActiveAxis(null);
      releasePointerLock();
    },
    [editor, applyTransformToState, pushHistory, releasePointerLock, onCommit],
  );

  const startTransform = useCallback(
    (mode: TransformMode) => {
      console.log('[useTransformSession] startTransform called, mode:', mode);
      const selectionArray = editor.getSelectionArray();
      console.log('[useTransformSession] Selection array:', selectionArray.length, 'blocks');
      if (!selectionArray.length) {
        console.log('[useTransformSession] No selection, aborting');
        return;
      }
      const targets = editor.getTransformsForIds(selectionArray.map((block) => block.id)).map((entry) => ({
        id: entry.id,
        origin: cloneTransform(entry.transform),
      }));
      if (targets.length === 0) {
        console.log('[useTransformSession] No targets, aborting');
        return;
      }

      if (transformSessionRef.current) {
        console.log('[useTransformSession] Finishing previous transform session');
        finishTransform(true);
      }

      transformSessionRef.current = {
        mode,
        axis: null,
        targets,
        delta: { x: 0, y: 0 },
      };
      console.log('[useTransformSession] Transform session started with', targets.length, 'targets');

      setTransformMode(mode);
      setActiveAxis(null);

      if (typeof document !== "undefined") {
        const canvas = editor.getCanvas();
        if (document.pointerLockElement !== canvas) {
          pointerLockRequestedRef.current = true;
          try {
            const result = (canvas.requestPointerLock as unknown as () => void | Promise<void>)();
            if (result && typeof (result as Promise<void>).catch === "function") {
              (result as Promise<void>).catch(() => {
                pointerLockRequestedRef.current = false;
              });
            }
          } catch {
            pointerLockRequestedRef.current = false;
            // ignore pointer lock errors
          }
        }
      }
    },
    [editor, finishTransform],
  );

  const updatePointerDelta = useCallback(
    (movementX: number, movementY: number) => {
      const session = transformSessionRef.current;
      if (!session) {
        return;
      }
      session.delta.x += movementX;
      session.delta.y += movementY;
      applyTransform();
    },
    [applyTransform],
  );

  const toggleAxis = useCallback(
    (axis: Exclude<AxisConstraint, null>) => {
      console.log('[useTransformSession] toggleAxis called, axis:', axis);
      const session = transformSessionRef.current;
      if (!session) {
        console.log('[useTransformSession] No active session');
        return;
      }
      const next = session.axis === axis ? null : axis;
      console.log('[useTransformSession] Axis constraint changed from', session.axis, 'to', next);
      session.axis = next;
      setActiveAxis(next);
      applyTransform();
    },
    [applyTransform],
  );

  const resetSession = useCallback(() => {
    transformSessionRef.current = null;
    setTransformMode(null);
    setActiveAxis(null);
    releasePointerLock();
  }, [releasePointerLock]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const canvas = editor.getCanvas();
    const handlePointerLockChange = () => {
      const lockedElement = document.pointerLockElement;
      if (lockedElement === canvas) {
        if (!pointerLockRequestedRef.current) {
          try {
            document.exitPointerLock();
          } catch {
            // ignore pointer lock exit errors
          }
        }
        return;
      }

      pointerLockRequestedRef.current = false;
      if (transformSessionRef.current) {
        finishTransform(false);
      }
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockChange);
    };
  }, [editor, finishTransform]);

  return {
    transformMode,
    activeAxis,
    startTransform,
    finishTransform,
    updatePointerDelta,
    toggleAxis,
    resetSession,
    releasePointerLock,
  };
}

