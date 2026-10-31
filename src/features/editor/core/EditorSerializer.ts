import { Euler, Group, LineSegments, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from "three";
import type { SavedComponent } from "@/features/editor/components-system";
import type {
  EditorBlock,
  SelectionTransform,
  SerializedNode,
  SerializedTransform,
} from "@/features/editor/types";
import { DEFAULT_RANDOM_STATIC_CONFIG, type GeneratorConfig } from "@/features/editor/types/generatorConfig";
import type { BlockStore } from "./BlockStore";
import type { ComponentManager } from "./ComponentManager";
import { createSpawnPointMesh, markMeshAsGenerator } from "./blockFactory";

export type InstantiateOptions = {
  /** Added to the world position of every root node (used by paste). */
  offset?: Vector3;
  /**
   * Reuse the ids stored in the nodes (scenario import, undo of a delete, redo of a create).
   * When false (paste) every block gets a fresh id and generator event links that point inside
   * the pasted set are remapped to the new ids.
   */
  preserveIds?: boolean;
};

type InstantiateContext = {
  preserveIds: boolean;
  allowSpawn: boolean;
  idMap: Map<string, string>;
};

type EditorObjectData = {
  editorId?: string;
  editorName?: string;
  isSpawnPoint?: boolean;
  isGenerator?: boolean;
  generatorConfig?: GeneratorConfig;
  componentId?: string;
  componentRole?: string;
};

function dataOf(object: Object3D): EditorObjectData {
  return object.userData as EditorObjectData;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Converts editor blocks to the `.rbonline` node format and back.
 *
 * @remarks
 * Kept free of rendering dependencies (only `BlockStore` and `ComponentManager`) so the
 * round-trip can be unit tested. Every field the editor stores per block (id, name, rotation,
 * scale, spawn flag, generator config with events, component instances, nested groups) must
 * survive `serialize -> instantiate`.
 */
export class EditorSerializer {
  constructor(
    private readonly blocks: BlockStore,
    private readonly components: ComponentManager,
  ) {}

  public serializeBlocksByIds(ids: string[]): { nodes: SerializedNode[]; componentIds: string[] } {
    const used = new Set<string>();
    const nodes: SerializedNode[] = [];
    for (const id of ids) {
      const block = this.blocks.getBlock(id);
      if (!block) continue;
      const node = this.serializeBlock(block, used);
      if (node) nodes.push(node);
    }
    return { nodes, componentIds: Array.from(used) };
  }

  /**
   * Serialize the whole scene. A component being edited is written back as one instance
   * (its members are loose blocks while the edit session is open).
   */
  public serializeScene(): { nodes: SerializedNode[]; componentIds: string[] } {
    const used = new Set<string>();
    const nodes: SerializedNode[] = [];
    const edit = this.components.getActiveEdit();
    const skip = new Set(edit?.childIds ?? []);

    for (const block of this.blocks.getAllBlocks()) {
      if (skip.has(block.id)) continue;
      const node = this.serializeBlock(block, used);
      if (node) nodes.push(node);
    }

    if (edit) {
      used.add(edit.componentId);
      nodes.push({
        type: "component",
        componentId: edit.componentId,
        transform: transformFromMatrix(edit.basis),
        ...(edit.instanceId && { id: edit.instanceId }),
      });
    }

    return { nodes, componentIds: Array.from(used) };
  }

  public serializeBlock(block: EditorBlock, used: Set<string>): SerializedNode | null {
    const mesh = block.mesh;
    const transform = toSerializedTransform(mesh, "world");

    if (mesh instanceof Group) {
      const componentId = this.components.getComponentIdForBlock(block);
      if (componentId) {
        used.add(componentId);
        return {
          type: "component",
          id: block.id,
          componentId,
          transform,
          ...(block.name && { name: block.name }),
        };
      }
      return {
        type: "group",
        id: block.id,
        transform,
        children: this.serializeChildren(mesh, used),
        ...(block.name && { name: block.name }),
      };
    }

    if (mesh instanceof Mesh) {
      return this.serializeMesh(mesh, transform, block.id, block.name, block.generatorConfig);
    }

    return null;
  }

  private serializeChildren(group: Object3D, used: Set<string>): SerializedNode[] {
    const children: SerializedNode[] = [];
    for (const child of group.children) {
      const node = this.serializeObject(child, used);
      if (node) children.push(node);
    }
    return children;
  }

  /** Serialize an object nested in a group (local transform). */
  private serializeObject(object: Object3D, used: Set<string>): SerializedNode | null {
    if (object instanceof LineSegments) return null;
    const data = dataOf(object);
    const transform = toSerializedTransform(object, "local");

    if (object instanceof Group) {
      if (data.componentId) {
        used.add(data.componentId);
        return {
          type: "component",
          componentId: data.componentId,
          transform,
          ...(data.editorId && { id: data.editorId }),
          ...(data.editorName && { name: data.editorName }),
        };
      }
      return {
        type: "group",
        transform,
        children: this.serializeChildren(object, used),
        ...(data.editorId && { id: data.editorId }),
        ...(data.editorName && { name: data.editorName }),
      };
    }

    if (object instanceof Mesh) {
      return this.serializeMesh(object, transform, data.editorId, data.editorName, data.generatorConfig);
    }

    return null;
  }

  private serializeMesh(
    mesh: Mesh,
    transform: SerializedTransform,
    id: string | undefined,
    name: string | undefined,
    generatorConfig: GeneratorConfig | undefined,
  ): SerializedNode {
    const data = dataOf(mesh);
    const isSpawnPoint = data.isSpawnPoint === true;
    const isGenerator = data.isGenerator === true;
    const config = generatorConfig ?? data.generatorConfig;
    return {
      type: "block",
      transform,
      ...(id && { id }),
      ...(name && { name }),
      ...(isSpawnPoint && { isSpawnPoint: true }),
      ...(isGenerator && { isGenerator: true }),
      // Clone so stored snapshots (history, clipboard, scenarios) never alias live config objects
      ...(isGenerator && config && { generatorConfig: cloneJson(config) }),
    };
  }

  /**
   * Create editor blocks from serialized nodes.
   *
   * @param componentMap - Component definitions referenced by the nodes
   */
  public instantiateNodes(
    nodes: SerializedNode[],
    componentMap: Map<string, SavedComponent>,
    options: InstantiateOptions = {},
  ): EditorBlock[] {
    const preserveIds = options.preserveIds ?? false;
    const context: InstantiateContext = {
      preserveIds,
      // Only one spawn point may exist; pasting one must not create a second
      allowSpawn: preserveIds || !this.hasSpawnPoint(),
      idMap: new Map(),
    };

    const created: EditorBlock[] = [];
    for (const original of nodes) {
      const node = cloneJson(original);
      if (options.offset) {
        node.transform.position.x += options.offset.x;
        node.transform.position.y += options.offset.y;
        node.transform.position.z += options.offset.z;
      }
      const block = this.instantiateRootNode(node, componentMap, context);
      if (block) created.push(block);
    }

    if (!preserveIds) {
      this.remapEventLinks(created, context.idMap);
    }

    return created;
  }

  private hasSpawnPoint(): boolean {
    return this.blocks.getAllBlocks().some((block) => {
      let found = false;
      block.mesh.traverse((child) => {
        if (dataOf(child).isSpawnPoint === true) found = true;
      });
      return found;
    });
  }

  private instantiateRootNode(
    node: SerializedNode,
    componentMap: Map<string, SavedComponent>,
    context: InstantiateContext,
  ): EditorBlock | null {
    const id = context.preserveIds ? node.id : undefined;
    let block: EditorBlock | null = null;

    switch (node.type) {
      case "block": {
        const transform = transformFromSerialized(node.transform);
        if (node.isSpawnPoint) {
          if (!context.allowSpawn) {
            return null;
          }
          context.allowSpawn = false;
          block = this.blocks.createSpawnPoint({ ...transform, id });
        } else {
          block = this.blocks.createBlock({ ...transform, id });
          if (node.isGenerator) {
            const config = node.generatorConfig ?? cloneJson(DEFAULT_RANDOM_STATIC_CONFIG);
            markMeshAsGenerator(block.mesh as Mesh, config);
            block.generatorConfig = config;
          }
        }
        break;
      }
      case "component": {
        if (!node.componentId) {
          return null;
        }
        const definition = componentMap.get(node.componentId);
        if (definition) {
          block = this.components.instantiateComponent(definition, transformFromSerialized(node.transform), id);
        } else {
          // Keep a tagged placeholder so the instance (and its id) survives a missing definition
          const placeholder = new Group();
          applySerializedTransform(placeholder, node.transform);
          placeholder.userData.componentId = node.componentId;
          placeholder.userData.componentRole = "instance";
          block = this.blocks.registerGroup(placeholder, id);
        }
        break;
      }
      case "group": {
        block = this.blocks.registerGroup(this.buildGroup(node, componentMap, context), id);
        break;
      }
    }

    if (!block) {
      return null;
    }
    if (node.id) {
      context.idMap.set(node.id, block.id);
    }
    if (node.name) {
      block.name = node.name;
      block.mesh.userData.editorName = node.name;
    }
    return block;
  }

  private buildGroup(node: SerializedNode, componentMap: Map<string, SavedComponent>, context: InstantiateContext): Group {
    const group = new Group();
    applySerializedTransform(group, node.transform);
    for (const child of node.children ?? []) {
      const object = this.buildChildObject(child, componentMap, context);
      if (object) group.add(object);
    }
    return group;
  }

  private buildChildObject(
    child: SerializedNode,
    componentMap: Map<string, SavedComponent>,
    context: InstantiateContext,
  ): Object3D | null {
    let object: Object3D | null = null;
    let prefix: "block" | "group" | "spawn" = "block";

    switch (child.type) {
      case "block": {
        if (child.isSpawnPoint) {
          if (!context.allowSpawn) {
            return null;
          }
          context.allowSpawn = false;
          prefix = "spawn";
        }
        const mesh = child.isSpawnPoint ? createSpawnPointMesh() : this.blocks.createPrimitiveBlockMesh();
        applySerializedTransform(mesh, child.transform);
        if (child.isGenerator && !child.isSpawnPoint) {
          markMeshAsGenerator(mesh, child.generatorConfig ?? cloneJson(DEFAULT_RANDOM_STATIC_CONFIG));
        }
        object = mesh;
        break;
      }
      case "group": {
        object = this.buildGroup(child, componentMap, context);
        prefix = "group";
        break;
      }
      case "component": {
        if (!child.componentId) {
          return null;
        }
        const group = new Group();
        applySerializedTransform(group, child.transform);
        const definition = componentMap.get(child.componentId);
        definition?.members.forEach((member, index) => {
          const mesh = this.blocks.createPrimitiveBlockMesh();
          mesh.position.set(member.position.x, member.position.y, member.position.z);
          mesh.rotation.set(member.rotation.x, member.rotation.y, member.rotation.z);
          mesh.scale.set(member.scale.x, member.scale.y, member.scale.z);
          mesh.userData.componentMemberIndex = index;
          mesh.userData.componentRole = "instance";
          group.add(mesh);
        });
        group.userData.componentId = child.componentId;
        group.userData.componentRole = "instance";
        object = group;
        prefix = "group";
        break;
      }
    }

    if (!object) {
      return null;
    }
    // Nested objects keep their id in userData.editorId; it becomes the block id on ungroup.
    const editorId = context.preserveIds && child.id ? child.id : this.blocks.allocateId(prefix);
    object.userData.editorId = editorId;
    if (child.id) {
      context.idMap.set(child.id, editorId);
    }
    if (child.name) {
      object.userData.editorName = child.name;
    }
    return object;
  }

  /** Point "startGenerator" events of pasted generators at the pasted copies of their targets. */
  private remapEventLinks(created: EditorBlock[], idMap: Map<string, string>): void {
    if (idMap.size === 0) return;
    for (const block of created) {
      block.mesh.traverse((object) => {
        const data = dataOf(object);
        const config = data.generatorConfig;
        if (!data.isGenerator || !config?.events?.onComplete?.length) return;
        let changed = false;
        const onComplete = config.events.onComplete.map((event) => {
          if (event.type === "startGenerator" && idMap.has(event.targetGeneratorId)) {
            changed = true;
            return { ...event, targetGeneratorId: idMap.get(event.targetGeneratorId)! };
          }
          return event;
        });
        if (!changed) return;
        const next: GeneratorConfig = { ...config, events: { ...config.events, onComplete } };
        data.generatorConfig = next;
        if (object === block.mesh) {
          block.generatorConfig = next;
        }
      });
    }
  }
}

export function toSerializedTransform(object: Object3D, space: "world" | "local"): SerializedTransform {
  if (space === "world") {
    object.updateWorldMatrix(true, false);
    return transformFromMatrix(object.matrixWorld);
  }
  return {
    position: { x: object.position.x, y: object.position.y, z: object.position.z },
    rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
    scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
  };
}

export function transformFromMatrix(matrix: Matrix4): SerializedTransform {
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, quaternion, scale);
  const rotation = new Euler().setFromQuaternion(quaternion);
  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
    scale: { x: scale.x, y: scale.y, z: scale.z },
  };
}

export function transformFromSerialized(transform: SerializedTransform): SelectionTransform {
  return {
    position: new Vector3(transform.position.x, transform.position.y, transform.position.z),
    rotation: new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z),
    scale: new Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
  };
}

export function applySerializedTransform(target: Object3D, transform: SerializedTransform): void {
  target.position.set(transform.position.x, transform.position.y, transform.position.z);
  target.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  target.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
}
