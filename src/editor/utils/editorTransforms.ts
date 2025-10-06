import { Vector3, Object3D, Quaternion as ThreeQuaternion, Euler } from "three";
import type { EditorBlock, SelectionTransform } from "../types";
import type { VectorState } from "../types/editorTypes";

export function snapshotFromBlock(block: EditorBlock): SelectionTransform {
  return {
    position: block.mesh.position.clone(),
    rotation: block.mesh.rotation.clone(),
    scale: block.mesh.scale.clone(),
  };
}

export function snapshotFromWorldObject(obj: Object3D): SelectionTransform {
  const p = new Vector3();
  const q = new ThreeQuaternion();
  const s = new Vector3();
  obj.getWorldPosition(p);
  obj.getWorldQuaternion(q);
  obj.getWorldScale(s);
  const euler = new Euler().setFromQuaternion(q);
  return { position: p, rotation: euler, scale: s };
}

export function transformToVectorState(transform: SelectionTransform | null): {
  position: VectorState;
  rotation: VectorState;
  scale: VectorState;
} {
  if (!transform) {
    return {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
  }

  return {
    position: { x: transform.position.x, y: transform.position.y, z: transform.position.z },
    rotation: { x: transform.rotation.x, y: transform.rotation.y, z: transform.rotation.z },
    scale: { x: transform.scale.x, y: transform.scale.y, z: transform.scale.z },
  };
}
