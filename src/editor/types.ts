import type { Euler, LineSegments, Object3D, Vector3 } from "three";

export type EditorItem = {
  id: string;
  label: string;
};

export type EditorBlock = {
  id: string;
  mesh: Object3D;
  outline?: LineSegments;
};

export type EditorSelection = EditorBlock | EditorBlock[] | null;

export type SelectionTransform = {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
};

export type SelectionListener = (selection: EditorSelection) => void;

export type SerializedVector3 = {
  x: number;
  y: number;
  z: number;
};

export type SerializedTransform = {
  position: SerializedVector3;
  rotation: SerializedVector3;
  scale: SerializedVector3;
};

export type SerializedNode = {
  type: "block" | "component" | "group";
  transform: SerializedTransform;
  componentId?: string;
  children?: SerializedNode[];
};
