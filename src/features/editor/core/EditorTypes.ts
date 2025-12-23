import type { SelectionTransform } from "@/features/editor/types";

export type DragAxisConstraint = "x" | "y" | "z" | null;

export type PointerUpListener = (event: PointerEvent, context: { dragged: boolean }) => void;

export type DragCommitEntry = {
  id: string;
  before: SelectionTransform;
  after: SelectionTransform;
};

export const DRAG_AXIS_VECTORS = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
} as const;

export const DRAG_VERTICAL_SENSITIVITY = 0.02;
export const COMPONENT_MASTER_OUTLINE_COLOR = 0x9b5cff;
export const COMPONENT_INSTANCE_OUTLINE_COLOR = 0xff4dff;
