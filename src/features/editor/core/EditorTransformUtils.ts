import { Euler, Vector3 } from "three";
import type { SelectionTransform } from "@/features/editor/types";

export function cloneTransform(input: SelectionTransform): SelectionTransform {
  return {
    position: input.position.clone(),
    rotation: input.rotation.clone(),
    scale: input.scale.clone(),
  };
}

export function hasTransformChanged(before: SelectionTransform, after: SelectionTransform): boolean {
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

export function createDefaultTransform(position?: Vector3): SelectionTransform {
  return {
    position: position ? position.clone() : new Vector3(0, 0, 0),
    rotation: new Euler(0, 0, 0),
    scale: new Vector3(1, 1, 1),
  };
}
