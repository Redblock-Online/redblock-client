import type { Euler, LineSegments, Object3D, Vector3 } from "three";
import type { ComponentCategory } from "@/features/editor/ui/components/CategoryFilter";
import type { GeneratorConfig } from "./generatorConfig";

export type EditorItem = {
  id: string;
  label: string;
  category: ComponentCategory;
};

export type EditorBlock = {
  id: string; // Internal unique identifier
  name?: string; // Optional custom display name
  mesh: Object3D;
  outline?: LineSegments;
  generatorConfig?: GeneratorConfig; // Configuration for target generators
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
  id?: string; // Block ID for referencing (especially for generators)
  componentId?: string;
  children?: SerializedNode[];
  isSpawnPoint?: boolean;
  isGenerator?: boolean; // Is this a target generator?
  generatorConfig?: GeneratorConfig; // Configuration for target generators
  name?: string; // Custom display name for the block
};
