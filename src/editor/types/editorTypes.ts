import type { SerializedNode } from "../types";

export type VectorState = { x: number; y: number; z: number };

export type ClipboardPayload = {
  nodes: SerializedNode[];
  componentIds: string[];
};

export type MenuPosition = { 
  left: number; 
  top: number; 
  width: number;
} | null;

export type ComponentPendingDelete = {
  id: string;
  label: string;
} | null;
