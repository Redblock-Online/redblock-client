import { Euler, Scene, Vector3 } from "three";
import { BlockStore } from "@/features/editor/core/BlockStore";
import { SelectionManager } from "@/features/editor/core/SelectionManager";
import { GroupManager } from "@/features/editor/core/GroupManager";
import { ComponentManager } from "@/features/editor/core/ComponentManager";
import { EditorSerializer } from "@/features/editor/core/EditorSerializer";
import { markMeshAsGenerator } from "@/features/editor/core/blockFactory";
import type { HistoryEditor } from "@/features/editor/core/EditorHistory";
import { loadComponents, type SavedComponent } from "@/features/editor/components-system";
import { DEFAULT_RANDOM_STATIC_CONFIG, type GeneratorConfig } from "@/features/editor/types/generatorConfig";
import type { EditorBlock, SelectionTransform, SerializedNode } from "@/features/editor/types";
import type { Mesh } from "three";

/**
 * The editor core without the WebGL renderer (EditorApp needs a real WebGL context).
 * Wires the same managers EditorApp uses so tests exercise the real logic.
 */
export class HeadlessEditor implements HistoryEditor {
  readonly scene = new Scene();
  readonly blocks = new BlockStore(this.scene);
  readonly selection = new SelectionManager(this.scene, this.blocks);
  readonly groups = new GroupManager(this.scene, this.blocks, this.selection);
  readonly components = new ComponentManager(this.blocks, this.selection, this.groups);
  readonly serializer = new EditorSerializer(this.blocks, this.components);

  addBlock(x = 0, z = 0): EditorBlock {
    return this.blocks.createBlock({ position: new Vector3(x, 0.5, z) });
  }

  addGenerator(x = 0, z = 0, overrides: Partial<GeneratorConfig> = {}): EditorBlock {
    const block = this.addBlock(x, z);
    const config = { ...JSON.parse(JSON.stringify(DEFAULT_RANDOM_STATIC_CONFIG)), ...overrides } as GeneratorConfig;
    markMeshAsGenerator(block.mesh as Mesh, config);
    block.generatorConfig = config;
    return block;
  }

  addSpawn(x = 0, z = 0): EditorBlock {
    return this.blocks.createSpawnPoint({ position: new Vector3(x, 0.5, z) });
  }

  applyTransform(id: string, transform: SelectionTransform): void {
    this.selection.applyTransformsForIds([{ id, transform }]);
  }

  transformOf(id: string): SelectionTransform {
    const mesh = this.blocks.getBlock(id)!.mesh;
    return { position: mesh.position.clone(), rotation: mesh.rotation.clone(), scale: mesh.scale.clone() };
  }

  ids(): string[] {
    return this.blocks.getAllBlocks().map((block) => block.id);
  }

  // --- HistoryEditor
  removeBlock(id: string): boolean {
    const block = this.blocks.getBlock(id);
    if (block) this.components.handleBlockRemoved(block);
    this.selection.removeId(id);
    return this.blocks.removeBlock(id);
  }

  getBlock(id: string): EditorBlock | undefined {
    return this.blocks.getBlock(id);
  }

  setSelectionByIds(ids: string[]): void {
    this.selection.setSelectionByIds(ids);
  }

  clearSelection(): void {
    this.selection.clearSelection();
  }

  instantiateSerializedNodes(
    nodes: SerializedNode[],
    componentIds: string[],
    options: { preserveIds?: boolean; offset?: Vector3 } = {},
  ): EditorBlock[] {
    const map = new Map<string, SavedComponent>();
    const wanted = new Set(componentIds);
    const collect = (node: SerializedNode) => {
      if (node.componentId) wanted.add(node.componentId);
      node.children?.forEach(collect);
    };
    nodes.forEach(collect);
    for (const def of loadComponents()) {
      if (wanted.has(def.id)) map.set(def.id, def);
    }
    return this.serializer.instantiateNodes(nodes, map, options);
  }

  groupByIds(ids: string[], groupId?: string): EditorBlock | null {
    return this.groups.groupByIds(ids, groupId);
  }

  ungroupSelected(): EditorBlock[] | null {
    return this.groups.ungroupSelected();
  }

  updateGeneratorConfig(id: string, config: GeneratorConfig): boolean {
    const block = this.blocks.getBlock(id);
    if (!block || !block.mesh.userData.isGenerator) return false;
    block.generatorConfig = config;
    block.mesh.userData.generatorConfig = config;
    return true;
  }

  renameBlock(id: string, name: string): boolean {
    return this.blocks.renameBlock(id, name);
  }
}

export function rotated(x: number, y: number, z: number): Euler {
  return new Euler(x, y, z);
}
