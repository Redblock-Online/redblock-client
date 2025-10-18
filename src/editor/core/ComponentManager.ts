import { Euler, Group, LineSegments, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from "three";
import { addComponent, type ComponentMemberTransform, type SavedComponent } from "../componentsStore";
import type { BlockStore } from "./BlockStore";
import type { SelectionManager } from "./SelectionManager";
import type { GroupManager } from "./GroupManager";
import type { EditorBlock, SelectionTransform } from "../types";

export class ComponentManager {
  private readonly components = new Map<string, RuntimeComponent>();
  private readonly groupIdToComponentId = new Map<string, string>();

  private static readonly MASTER_OUTLINE_COLOR = 0x9b5cff;
  private static readonly INSTANCE_OUTLINE_COLOR = 0xff4dff;

  constructor(
    private readonly blocks: BlockStore,
    private readonly selection: SelectionManager,
    private readonly groups: GroupManager,
  ) {}

  public placeComponentAt(point: Vector3, component: SavedComponent): EditorBlock {
    const group = new Group();
    group.position.copy(point.setY(0.5));

    component.members.forEach((member, index) => {
      const mesh = this.blocks.createPrimitiveBlockMesh();
      mesh.position.set(member.position.x, member.position.y, member.position.z);
      mesh.rotation.set(member.rotation.x, member.rotation.y, member.rotation.z);
      mesh.scale.set(member.scale.x, member.scale.y, member.scale.z);
      (mesh as Object3D & { userData: Record<string, unknown> }).userData.componentMemberIndex = index;
      group.add(mesh);
      (mesh as Object3D).userData.componentRole = "instance";
      this.blocks.setOutlineColor(mesh, ComponentManager.INSTANCE_OUTLINE_COLOR);
    });

    const block = this.blocks.registerGroup(group);
    group.userData.componentId = component.id;
    group.userData.componentRole = "instance";
    this.blocks.setOutlineColor(group, ComponentManager.INSTANCE_OUTLINE_COLOR);
    this.groupIdToComponentId.set(block.id, component.id);

    const runtime = this.ensureRuntime(component);
    if (!runtime.instanceGroupIds.includes(block.id)) {
      runtime.instanceGroupIds.push(block.id);
    }

    this.selection.setSelectionSingle(block);
    return block;
  }

  public instantiateComponent(component: SavedComponent, transform: SelectionTransform, id?: string): EditorBlock {
    const group = new Group();
    component.members.forEach((member, index) => {
      const mesh = this.blocks.createPrimitiveBlockMesh();
      mesh.position.set(member.position.x, member.position.y, member.position.z);
      mesh.rotation.set(member.rotation.x, member.rotation.y, member.rotation.z);
      mesh.scale.set(member.scale.x, member.scale.y, member.scale.z);
      (mesh as Object3D & { userData: Record<string, unknown> }).userData.componentMemberIndex = index;
      group.add(mesh);
      (mesh as Object3D).userData.componentRole = "instance";
      this.blocks.setOutlineColor(mesh, ComponentManager.INSTANCE_OUTLINE_COLOR);
    });

    group.position.copy(transform.position);
    group.rotation.copy(transform.rotation);
    group.scale.copy(transform.scale);

    const block = this.blocks.registerGroup(group, id);
    group.userData.componentId = component.id;
    group.userData.componentRole = "instance";
    this.blocks.setOutlineColor(group, ComponentManager.INSTANCE_OUTLINE_COLOR);
    this.groupIdToComponentId.set(block.id, component.id);

    const runtime = this.ensureRuntime(component);
    if (!runtime.instanceGroupIds.includes(block.id)) {
      runtime.instanceGroupIds.push(block.id);
    }

    return block;
  }

  public createComponentFromSelectedGroup(label: string, id: string): string | null {
    const selection = this.selection.getSelection();
    if (!selection || !(selection.mesh instanceof Group)) {
      return null;
    }

    const runtime = this.ensureRuntime({ id, label, members: [] });
    runtime.groupId = undefined;
    runtime.editing = false;
    runtime.editingBasis = undefined;
    runtime.masterChildIds = [];
    this.groupIdToComponentId.set(selection.id, id);
    selection.mesh.userData.componentId = id;
    selection.mesh.userData.componentRole = "instance";
    this.blocks.setOutlineColor(selection.mesh, ComponentManager.INSTANCE_OUTLINE_COLOR);
    if (!runtime.instanceGroupIds.includes(selection.id)) {
      runtime.instanceGroupIds.push(selection.id);
    }
    return id;
  }

  public getComponentIdForSelection(selection: EditorBlock | null): string | null {
    if (!selection || !(selection.mesh instanceof Group)) {
      return null;
    }
    return this.getComponentIdForBlock(selection);
  }

  public getComponentIdForBlock(block: EditorBlock): string | null {
    const fromMap = this.groupIdToComponentId.get(block.id);
    if (fromMap) {
      return fromMap;
    }
    return (block.mesh.userData?.componentId as string | undefined) ?? null;
  }

  public isComponentEditing(id: string): boolean {
    const runtime = this.components.get(id);
    return !!runtime?.editing;
  }

  public getEditingComponentId(): string | null {
    for (const runtime of this.components.values()) {
      if (runtime.editing) {
        return runtime.id;
      }
    }
    return null;
  }

  public startEditingComponent(id: string): boolean {
    const runtime = this.components.get(id);
    if (!runtime) {
      return false;
    }

    const selection = this.selection.getSelection();
    if (!selection || !(selection.mesh instanceof Group)) {
      return false;
    }

    const componentId = selection.mesh.userData?.componentId as string | undefined;
    if (componentId !== runtime.id) {
      return false;
    }

    const role = selection.mesh.userData?.componentRole as string | undefined;

    if (role === "master" && runtime.groupId && selection.id === runtime.groupId) {
      const group = selection.mesh as Group;
      group.updateWorldMatrix(true, false);
      runtime.editingBasis = group.matrixWorld.clone();

      const restored = this.groups.ungroupSelected();
      if (!restored || restored.length === 0) {
        return false;
      }

      runtime.masterChildIds = restored.map((block) => block.id);
      runtime.masterChildIds.forEach((childId) => {
        const child = this.blocks.getBlock(childId);
        if (child) {
          child.mesh.userData.componentRole = "master";
          child.mesh.userData.componentId = runtime.id;
          this.blocks.setOutlineColor(child.mesh, ComponentManager.MASTER_OUTLINE_COLOR);
        }
      });

      runtime.editing = true;
      runtime.editingSourceId = undefined;
      return true;
    }

    // Treat the current selection as an instance to edit.
    const instanceId = selection.id;
    const group = selection.mesh as Group;
    group.updateWorldMatrix(true, false);
    runtime.editingBasis = group.matrixWorld.clone();
    runtime.editingSourceId = instanceId;

    const restored = this.groups.ungroupSelected();
    if (!restored || restored.length === 0) {
      runtime.editingSourceId = undefined;
      return false;
    }

    runtime.masterChildIds = restored.map((block) => block.id);
    runtime.masterChildIds.forEach((childId) => {
      const child = this.blocks.getBlock(childId);
      if (child) {
        child.mesh.userData.componentRole = "master";
        child.mesh.userData.componentId = runtime.id;
        this.blocks.setOutlineColor(child.mesh, ComponentManager.MASTER_OUTLINE_COLOR);
      }
    });

    runtime.instanceGroupIds = runtime.instanceGroupIds.filter((value) => value !== instanceId);
    this.groupIdToComponentId.delete(instanceId);
    runtime.editing = true;
    return true;
  }

  public finishEditingComponent(id: string): boolean {
    const runtime = this.components.get(id);
    if (!runtime || !runtime.editing) {
      return false;
    }

    const sourceId = runtime.editingSourceId;
    const groupId = runtime.groupId;

    if (sourceId) {
      const basis = runtime.editingBasis ?? new Matrix4();
      const grouped = this.groups.groupByIdsWithWorldMatrix(runtime.masterChildIds, basis, sourceId);
      if (!grouped) {
        return false;
      }
      grouped.mesh.userData.componentId = runtime.id;
      grouped.mesh.userData.componentRole = "instance";
      this.blocks.setOutlineColor(grouped.mesh, ComponentManager.INSTANCE_OUTLINE_COLOR);
      this.groupIdToComponentId.set(grouped.id, runtime.id);
      if (!runtime.instanceGroupIds.includes(grouped.id)) {
        runtime.instanceGroupIds.push(grouped.id);
      }
    } else if (groupId) {
      const basis = runtime.editingBasis ?? new Matrix4();
      const grouped = this.groups.groupByIdsWithWorldMatrix(runtime.masterChildIds, basis, groupId);
      if (!grouped) {
        return false;
      }
      grouped.mesh.userData.componentId = runtime.id;
      grouped.mesh.userData.componentRole = "master";
      this.blocks.setOutlineColor(grouped.mesh, ComponentManager.MASTER_OUTLINE_COLOR);
      runtime.groupId = grouped.id;
    }

    runtime.editing = false;
    runtime.masterChildIds = [];
    runtime.editingBasis = undefined;
    runtime.editingSourceId = undefined;
    return true;
  }

  public getSelectedGroupMembersLocalTransforms(selection: EditorBlock | null): ComponentMemberTransform[] | null {
    if (!selection || !(selection.mesh instanceof Group)) {
      return null;
    }

    const extractMemberTransforms = (selection: EditorBlock): ComponentMemberTransform[] => {
      const group = selection.mesh as Group;
      const transforms: ComponentMemberTransform[] = [];

      const extractRecursive = (parent: Object3D) => {
        for (const child of parent.children) {
          if (child instanceof LineSegments) {
            continue;
          }

          if (child instanceof Group) {
            extractRecursive(child);
          } else if (child instanceof Mesh) {
            child.updateWorldMatrix(true, false);
            const worldPos = new Vector3();
            const worldQuat = new Quaternion();
            const worldScale = new Vector3();
            child.matrixWorld.decompose(worldPos, worldQuat, worldScale);

            group.updateWorldMatrix(true, false);
            const groupInverse = new Matrix4().copy(group.matrixWorld).invert();
            const localMatrix = new Matrix4().multiplyMatrices(groupInverse, child.matrixWorld);

            const localPos = new Vector3();
            const localQuat = new Quaternion();
            const localScale = new Vector3();
            localMatrix.decompose(localPos, localQuat, localScale);
            const localRot = new Euler().setFromQuaternion(localQuat);

            transforms.push({
              position: { x: localPos.x, y: localPos.y, z: localPos.z },
              rotation: { x: localRot.x, y: localRot.y, z: localRot.z },
              scale: { x: localScale.x, y: localScale.y, z: localScale.z },
            });
          }
        }
      };

      extractRecursive(group);
      return transforms;
    };

    return extractMemberTransforms(selection);
  }

  public syncActiveComponentEdits(): void {
    const runtime = Array.from(this.components.values()).find((entry) => entry.editing && entry.editingBasis);
    if (!runtime || !runtime.editingBasis) {
      return;
    }

    const basisInverse = new Matrix4().copy(runtime.editingBasis).invert();
    const locals: LocalTransformSnapshot[] = [];

    for (let index = 0; index < runtime.masterChildIds.length; index += 1) {
      const childId = runtime.masterChildIds[index];
      const block = this.blocks.getBlock(childId);
      if (!block) {
        continue;
      }
      const child = block.mesh;
      child.updateWorldMatrix(true, false);
      const localMatrix = new Matrix4().multiplyMatrices(basisInverse, child.matrixWorld);
      const position = new Vector3();
      const quaternion = new Quaternion();
      const scale = new Vector3();
      localMatrix.decompose(position, quaternion, scale);
      const rotation = new Euler().setFromQuaternion(quaternion);
      locals[index] = { position, rotation, scale };
    }

    const serialized: ComponentMemberTransform[] = locals.map((entry) => ({
      position: { x: entry.position.x, y: entry.position.y, z: entry.position.z },
      rotation: { x: entry.rotation.x, y: entry.rotation.y, z: entry.rotation.z },
      scale: { x: entry.scale.x, y: entry.scale.y, z: entry.scale.z },
    }));

    addComponent({ id: runtime.id, label: runtime.label, members: serialized });

    for (const groupId of runtime.instanceGroupIds) {
      const instanceBlock = this.blocks.getBlock(groupId);
      const group = instanceBlock?.mesh as Group | undefined;
      if (!group) {
        continue;
      }
      for (let i = 0; i < group.children.length && i < locals.length; i += 1) {
        const child = group.children[i] as Object3D & { position: Vector3; rotation: Euler; scale: Vector3 };
        const snapshot = locals[i];
        child.position.copy(snapshot.position);
        child.rotation.copy(snapshot.rotation);
        child.scale.copy(snapshot.scale);
      }
    }
  }

  public isBlockWithinActiveEdit(blockId: string): boolean {
    const runtime = Array.from(this.components.values()).find((entry) => entry.editing);
    if (!runtime) {
      return true;
    }
    if (runtime.masterChildIds.length === 0) {
      return true;
    }
    return runtime.masterChildIds.includes(blockId);
  }

  public registerComponentDefinitions(definitions: SavedComponent[]): void {
    for (const def of definitions) {
      addComponent({ id: def.id, label: def.label, members: def.members });
      const runtime = this.ensureRuntime(def);
      runtime.instanceGroupIds = runtime.instanceGroupIds.filter((instanceId) => this.blocks.hasBlock(instanceId));
    }
  }

  public resetRuntimeState(): void {
    this.groupIdToComponentId.clear();
    for (const runtime of this.components.values()) {
      runtime.instanceGroupIds = [];
      runtime.editing = false;
      runtime.editingBasis = undefined;
      runtime.masterChildIds = [];
      runtime.editingSourceId = undefined;
    }
  }

  public disposeComponent(id: string): string[] {
    const runtime = this.components.get(id);
    if (!runtime) {
      return [];
    }

    if (runtime.editing) {
      this.finishEditingComponent(id);
    }

    const removed = new Set<string>();
    if (runtime.groupId) {
      removed.add(runtime.groupId);
      this.groupIdToComponentId.delete(runtime.groupId);
    }
    for (const instanceId of runtime.instanceGroupIds) {
      removed.add(instanceId);
      this.groupIdToComponentId.delete(instanceId);
    }

    this.components.delete(id);

    return Array.from(removed);
  }

  public handleBlockRemoved(block: EditorBlock): void {
    const componentId = block.mesh.userData?.componentId as string | undefined;
    if (!componentId) {
      this.groupIdToComponentId.delete(block.id);
      return;
    }

    const runtime = this.components.get(componentId);
    if (runtime) {
      runtime.instanceGroupIds = runtime.instanceGroupIds.filter((value) => value !== block.id);
      if (runtime.groupId === block.id) {
        runtime.groupId = undefined;
      }
      if (runtime.editingSourceId === block.id) {
        runtime.editingSourceId = undefined;
      }
    }

    this.groupIdToComponentId.delete(block.id);
  }

  private ensureRuntime(component: SavedComponent): RuntimeComponent {
    let runtime = this.components.get(component.id);
    if (!runtime) {
      runtime = {
        id: component.id,
        label: component.label,
        groupId: undefined,
        editing: false,
        editingBasis: undefined,
        masterChildIds: [],
        instanceGroupIds: [],
        editingSourceId: undefined,
      };
      this.components.set(component.id, runtime);
    } else {
      runtime.label = component.label;
    }
    return runtime;
  }
}

type LocalTransformSnapshot = {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
};

type RuntimeComponent = {
  id: string;
  label: string;
  groupId?: string;
  editing: boolean;
  editingBasis?: Matrix4;
  masterChildIds: string[];
  instanceGroupIds: string[];
  editingSourceId?: string;
};
