import { Vector3 } from "three";
import type { EditorBlock, SerializedNode } from "@/features/editor/types";
import type { SavedComponent } from "@/features/editor/components-system";
import { loadComponents } from "@/features/editor/components-system";
import type { SerializedScenario } from "@/features/editor/scenarios";
import type { BlockStore } from "./BlockStore";
import type { SelectionManager } from "./SelectionManager";
import type { ComponentManager } from "./ComponentManager";
import type { EditorSerializer } from "./EditorSerializer";
import type { EditorNodeBuilder } from "./EditorNodeBuilder";

export class EditorScenarioManager {
  private readonly blocks: BlockStore;
  private readonly selection: SelectionManager;
  private readonly components: ComponentManager;
  private readonly serializer: EditorSerializer;
  private readonly nodeBuilder: EditorNodeBuilder;

  constructor(
    blocks: BlockStore,
    selection: SelectionManager,
    components: ComponentManager,
    serializer: EditorSerializer,
    nodeBuilder: EditorNodeBuilder
  ) {
    this.blocks = blocks;
    this.selection = selection;
    this.components = components;
    this.serializer = serializer;
    this.nodeBuilder = nodeBuilder;
  }

  public exportScenario(name: string): SerializedScenario {
    const usedComponentIds = new Set<string>();
    const serializedBlocks: SerializedNode[] = [];
    
    const allBlocks = this.blocks.getAllBlocks();
    console.log(`[EditorScenarioManager] Exporting scenario with ${allBlocks.length} blocks`);
    
    for (const block of allBlocks) {
      console.log(`[EditorScenarioManager] Processing block ${block.id}, isGenerator: ${block.mesh.userData.isGenerator}`);
      const node = this.serializer.serializeEditorBlock(block, usedComponentIds);
      if (node) {
        serializedBlocks.push(node);
        console.log(`[EditorScenarioManager] Block ${block.id} serialized successfully`);
      } else {
        console.warn(`[EditorScenarioManager] Block ${block.id} returned null from serializer`);
      }
    }

    const definitions = loadComponents().filter((component) => usedComponentIds.has(component.id));

    return {
      version: 1,
      name,
      createdAt: new Date().toISOString(),
      blocks: serializedBlocks,
      componentDefinitions: definitions,
    };
  }

  public importScenario(scenario: SerializedScenario): void {
    this.resetScene();

    const componentMap = new Map<string, SavedComponent>();
    for (const definition of scenario.componentDefinitions) {
      componentMap.set(definition.id, definition);
    }
    this.components.registerComponentDefinitions(scenario.componentDefinitions);

    for (const node of scenario.blocks) {
      this.nodeBuilder.instantiateRootNode(node, componentMap);
    }

    this.selection.clearSelection();
  }

  public resetScene(): void {
    this.selection.clearSelection();
    this.blocks.clearAll();
    this.components.resetRuntimeState();
  }

  public serializeBlocksByIds(ids: string[]): { nodes: SerializedNode[]; componentIds: string[] } {
    return this.serializer.serializeBlocksByIds(ids);
  }

  public instantiateSerializedNodes(nodes: SerializedNode[], componentIds: string[], offset?: Vector3): EditorBlock[] {
    return this.nodeBuilder.instantiateSerializedNodes(nodes, componentIds, offset);
  }
}
