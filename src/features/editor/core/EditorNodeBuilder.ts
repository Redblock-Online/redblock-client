import { Group, Object3D, Vector3 } from "three";
import type { EditorBlock, SerializedNode } from "@/features/editor/types";
import type { SavedComponent } from "@/features/editor/components-system";
import { loadComponents } from "@/features/editor/components-system";
import type { BlockStore } from "./BlockStore";
import type { ComponentManager } from "./ComponentManager";
import type { EditorSerializer } from "./EditorSerializer";

export class EditorNodeBuilder {
  private readonly blocks: BlockStore;
  private readonly components: ComponentManager;
  private readonly serializer: EditorSerializer;

  constructor(blocks: BlockStore, components: ComponentManager, serializer: EditorSerializer) {
    this.blocks = blocks;
    this.components = components;
    this.serializer = serializer;
  }

  public instantiateRootNode(node: SerializedNode, componentMap: Map<string, SavedComponent>): EditorBlock | null {
    switch (node.type) {
      case "block": {
        const transform = this.serializer.transformFromSerialized(node.transform);
        const block = this.blocks.createBlock({
          position: transform.position,
          rotation: transform.rotation,
          scale: transform.scale,
        });
        
        // Restore generator configuration
        if (node.isGenerator && node.generatorConfig) {
          block.mesh.userData.isGenerator = true;
          block.generatorConfig = node.generatorConfig;
          block.mesh.userData.generatorConfig = node.generatorConfig;
          console.log('[EditorNodeBuilder] Restored generator config for block:', block.id, node.generatorConfig);
        }
        
        // Mark as spawn point if needed
        if (node.isSpawnPoint) {
          block.mesh.userData.isSpawnPoint = true;
        }
        
        // Restore custom name
        if (node.name) {
          block.name = node.name;
        }
        
        return block;
      }
      case "component": {
        if (!node.componentId) return null;
        const definition = componentMap.get(node.componentId);
        if (!definition) return null;
        const transform = this.serializer.transformFromSerialized(node.transform);
        return this.components.instantiateComponent(definition, transform);
      }
      case "group": {
        const group = this.buildGroupFromNode(node, componentMap);
        if (group) return this.blocks.registerGroup(group);
        return null;
      }
    }
    return null;
  }

  public buildGroupFromNode(node: SerializedNode, componentMap: Map<string, SavedComponent>): Group | null {
    const group = new Group();
    this.serializer.applySerializedTransform(group, node.transform);

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const childObject = this.buildChildObject(child, componentMap);
        if (childObject) group.add(childObject);
      }
    }

    return group;
  }

  public buildChildObject(child: SerializedNode, componentMap: Map<string, SavedComponent>): Object3D | null {
    switch (child.type) {
      case "block": {
        const mesh = this.blocks.createPrimitiveBlockMesh();
        this.serializer.applySerializedTransform(mesh, child.transform);
        return mesh;
      }
      case "group": {
        return this.buildGroupFromNode(child, componentMap);
      }
      case "component": {
        if (!child.componentId) return null;
        const definition = componentMap.get(child.componentId);
        if (!definition) return null;
        const group = new Group();
        this.serializer.applySerializedTransform(group, child.transform);
        definition.members.forEach((member) => {
          const mesh = this.blocks.createPrimitiveBlockMesh();
          mesh.position.set(member.position.x, member.position.y, member.position.z);
          mesh.rotation.set(member.rotation.x, member.rotation.y, member.rotation.z);
          mesh.scale.set(member.scale.x, member.scale.y, member.scale.z);
          group.add(mesh);
        });
        (group as Object3D & { userData: Record<string, unknown> }).userData.componentId = definition.id;
        (group as Object3D & { userData: Record<string, unknown> }).userData.componentRole = "instance";
        return group;
      }
    }
  }

  public instantiateSerializedNodes(
    nodes: SerializedNode[],
    componentIds: string[],
    offset?: Vector3
  ): EditorBlock[] {
    const created: EditorBlock[] = [];
    const requiredComponentIds = new Set(componentIds);
    
    const collectComponentIds = (node: SerializedNode): void => {
      if (node.componentId) requiredComponentIds.add(node.componentId);
      if (node.children) node.children.forEach(collectComponentIds);
    };
    nodes.forEach(collectComponentIds);

    const componentMap = new Map<string, SavedComponent>();
    const definitions = loadComponents();
    for (const definition of definitions) {
      if (requiredComponentIds.has(definition.id)) {
        componentMap.set(definition.id, definition);
      }
    }

    for (const node of nodes) {
      const clone = this.serializer.cloneSerializedNode(node);
      if (offset) {
        clone.transform = this.serializer.addOffsetToSerializedTransform(clone.transform, offset);
      }
      const block = this.instantiateRootNode(clone, componentMap);
      if (block) created.push(block);
    }

    if (created.length > 0) {
      this.components.syncActiveComponentEdits();
    }

    return created;
  }
}
