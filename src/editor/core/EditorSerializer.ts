import { Euler, Group, LineSegments, Mesh, Object3D, Quaternion, Vector3 } from "three";
import type { EditorBlock, SerializedNode, SerializedTransform, SelectionTransform } from "../types";
import type { BlockStore } from "./BlockStore";
import type { ComponentManager } from "./ComponentManager";

export class EditorSerializer {
  private readonly blocks: BlockStore;
  private readonly components: ComponentManager;

  constructor(blocks: BlockStore, components: ComponentManager) {
    this.blocks = blocks;
    this.components = components;
  }

  public serializeBlocksByIds(ids: string[]): { nodes: SerializedNode[]; componentIds: string[] } {
    const usedComponents = new Set<string>();
    const nodes: SerializedNode[] = [];
    for (const id of ids) {
      const block = this.blocks.getBlock(id);
      if (!block) continue;
      const node = this.serializeEditorBlock(block, usedComponents);
      if (node) nodes.push(node);
    }
    return { nodes, componentIds: Array.from(usedComponents) };
  }

  public serializeEditorBlock(block: EditorBlock, usedComponents: Set<string>): SerializedNode | null {
    console.log("[EditorSerializer] Serializing block:", block.id);
    const componentId = this.components.getComponentIdForBlock(block);
    if (componentId) {
      usedComponents.add(componentId);
      return {
        type: "component",
        componentId,
        transform: this.toSerializedTransform(block.mesh, "world"),
        id: block.id,
      };
    }

    if (block.mesh instanceof Group) {
      const children: SerializedNode[] = [];
      for (const child of block.mesh.children) {
        const serializedChild = this.serializeObject(child, usedComponents, "local");
        if (serializedChild) children.push(serializedChild);
      }
      return {
        type: "group",
        transform: this.toSerializedTransform(block.mesh, "world"),
        children,
        id: block.id,
      };
    }

    if (block.mesh instanceof Mesh) {
      return {
        type: "block",
        transform: this.toSerializedTransform(block.mesh, "world"),
        id: block.id,
      };
    }

    return null;
  }

  public serializeObject(object: Object3D, usedComponents: Set<string>, space: "world" | "local"): SerializedNode | null {
    if (object instanceof LineSegments) return null;

    if (object instanceof Group) {
      const componentId = (object.userData?.componentId as string | undefined) ?? null;
      if (componentId) {
        if (space === "world") {
          usedComponents.add(componentId);
          return {
            type: "component",
            componentId,
            transform: this.toSerializedTransform(object, space),
          };
        }
        return null;
      }

      const children: SerializedNode[] = [];
      for (const child of object.children) {
        const serializedChild = this.serializeObject(child, usedComponents, "local");
        if (serializedChild) children.push(serializedChild);
      }
      return {
        type: "group",
        transform: this.toSerializedTransform(object, space),
        children,
      };
    }

    if (object instanceof Mesh) {
      return {
        type: "block",
        transform: this.toSerializedTransform(object, space),
      };
    }

    return null;
  }

  public toSerializedTransform(object: Object3D, space: "world" | "local"): SerializedTransform {
    if (space === "world") {
      object.updateWorldMatrix(true, false);
      const position = new Vector3();
      const quaternion = new Quaternion();
      const scale = new Vector3();
      object.matrixWorld.decompose(position, quaternion, scale);
      const rotation = new Euler().setFromQuaternion(quaternion);
      return {
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
        scale: { x: scale.x, y: scale.y, z: scale.z },
      };
    }

    return {
      position: { x: object.position.x, y: object.position.y, z: object.position.z },
      rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
      scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
    };
  }

  public transformFromSerialized(transform: SerializedTransform): SelectionTransform {
    return {
      position: new Vector3(transform.position.x, transform.position.y, transform.position.z),
      rotation: new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z),
      scale: new Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
    };
  }

  public applySerializedTransform(target: Object3D, transform: SerializedTransform): void {
    target.position.set(transform.position.x, transform.position.y, transform.position.z);
    target.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    target.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
  }

  public cloneSerializedNode(node: SerializedNode): SerializedNode {
    return {
      type: node.type,
      componentId: node.componentId,
      transform: {
        position: { ...node.transform.position },
        rotation: { ...node.transform.rotation },
        scale: { ...node.transform.scale },
      },
      children: node.children ? node.children.map((child) => this.cloneSerializedNode(child)) : undefined,
    };
  }

  public addOffsetToSerializedTransform(transform: SerializedTransform, offset: Vector3): SerializedTransform {
    return {
      position: {
        x: transform.position.x + offset.x,
        y: transform.position.y + offset.y,
        z: transform.position.z + offset.z,
      },
      rotation: { ...transform.rotation },
      scale: { ...transform.scale },
    };
  }
}
