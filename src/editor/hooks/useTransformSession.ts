import { useCallback, useEffect, useRef, useState } from "react";
import { Quaternion, Vector3 } from "three";
import type EditorApp from "../EditorApp";
import type { SelectionTransform } from "../types";
import type { HistoryAction } from "./useHistoryStack";

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
  const [transformMode, setTransformMode] = useState<TransformMode | null>(null);
  const [activeAxis, setActiveAxis] = useState<AxisConstraint>(null);

  const releasePointerLock = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    const canvas = editor.getCanvas();
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
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
      const session = transformSessionRef.current;
      if (!session || session.targets.length === 0) {
        return;
      }

      if (!commit) {
        editor.applyTransformsForIds(
          session.targets.map((target) => ({ id: target.id, transform: cloneTransform(target.origin) })),
        );
        applyTransformToState(session.targets[0]?.origin ?? null);
      } else {
        const ids = session.targets.map((target) => target.id);
        const current = editor.getTransformsForIds(ids);
        const changes: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }> = [];
        for (const target of session.targets) {
          const currentEntry = current.find((entry) => entry.id === target.id);
          if (!currentEntry) {
            continue;
          }
          if (hasTransformChanged(target.origin, currentEntry.transform)) {
            changes.push({ id: target.id, before: cloneTransform(target.origin), after: cloneTransform(currentEntry.transform) });
          }
        }

        if (changes.length > 0) {
          if (changes.length === 1) {
            const entry = changes[0];
            pushHistory({ type: "transform", id: entry.id, before: entry.before, after: entry.after });
            applyTransformToState(entry.after);
          } else {
            pushHistory({ type: "multi-transform", entries: changes });
            applyTransformToState(changes[0]?.after ?? null);
          }
          onCommit?.();
        } else {
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
      const selectionArray = editor.getSelectionArray();
      if (!selectionArray.length) {
        return;
      }
      const targets = editor.getTransformsForIds(selectionArray.map((block) => block.id)).map((entry) => ({
        id: entry.id,
        origin: cloneTransform(entry.transform),
      }));
      if (targets.length === 0) {
        return;
      }

      if (transformSessionRef.current) {
        finishTransform(true);
      }

      transformSessionRef.current = {
        mode,
        axis: null,
        targets,
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
      const session = transformSessionRef.current;
      if (!session) {
        return;
      }
      const next = session.axis === axis ? null : axis;
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
  }, []);

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

function cloneTransform(input: SelectionTransform): SelectionTransform {
  return {
    position: input.position.clone(),
    rotation: input.rotation.clone(),
    scale: input.scale.clone(),
  };
}

function hasTransformChanged(before: SelectionTransform, after: SelectionTransform): boolean {
  return (
    Math.abs(after.position.x - before.position.x) > 1e-6 ||
    Math.abs(after.position.y - before.position.y) > 1e-6 ||
    Math.abs(after.position.z - before.position.z) > 1e-6 ||
    Math.abs(after.rotation.x - before.rotation.x) > 1e-6 ||
    Math.abs(after.rotation.y - before.rotation.y) > 1e-6 ||
    Math.abs(after.rotation.z - before.rotation.z) > 1e-6 ||
    Math.abs(after.scale.x - before.scale.x) > 1e-6 ||
    Math.abs(after.scale.y - before.scale.y) > 1e-6 ||
    Math.abs(after.scale.z - before.scale.z) > 1e-6
  );
}
