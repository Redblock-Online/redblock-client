import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  Color,
  DirectionalLight,
  Euler,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  MOUSE,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ComponentMemberTransform, SavedComponent } from "./componentsStore";
import { loadComponents } from "./componentsStore";
import type {
  EditorBlock,
  SelectionListener,
  SelectionTransform,
  SerializedNode,
  SerializedTransform,
} from "./types";
import { BlockStore } from "./core/BlockStore";
import { SelectionManager } from "./core/SelectionManager";
import { MovementController } from "./core/MovementController";
import { GroupManager } from "./core/GroupManager";
import { ComponentManager } from "./core/ComponentManager";
import type { SerializedScenario } from "./scenarioStore";

const COMPONENT_MASTER_OUTLINE_COLOR = 0x9b5cff;
const COMPONENT_INSTANCE_OUTLINE_COLOR = 0xff4dff;

export type DragCommitEntry = {
  id: string;
  before: SelectionTransform;
  after: SelectionTransform;
};

type PointerUpListener = (event: PointerEvent, context: { dragged: boolean }) => void;

export default class EditorApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly groundPlane = new Mesh(
    new BoxGeometry(200, 0.1, 200),
    new MeshStandardMaterial({ color: new Color(0xe5e7eb) }),
  );

  private readonly blocks: BlockStore;
  private readonly selection: SelectionManager;
  private readonly groups: GroupManager;
  private readonly movement: MovementController;
  private readonly components: ComponentManager;
  private readonly pointerUpListeners = new Set<PointerUpListener>();
  private readonly dragCommitListeners = new Set<(changes: DragCommitEntry[]) => void>();

  private leftButtonActive = false;
  private isDragging = false;
  private dragStartPoint: Vector3 | null = null;
  private dragTargets: Array<{ id: string; origin: SelectionTransform }> = [];
  private animationFrame?: number;
  private lastFrameTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = SRGBColorSpace;

    this.scene = new Scene();
    this.scene.background = new Color(0xffffff);

    this.camera = new PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(8, 10, 14);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI - 0.1;
    this.controls.target.set(0, 0, 0);
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    this.controls.mouseButtons.RIGHT = MOUSE.ROTATE;

    this.blocks = new BlockStore(this.scene);
    this.selection = new SelectionManager(this.scene, this.blocks, {
      getBlockColor: (block, selected) => this.resolveBlockOutlineColor(block, selected),
      setOutlineColor: (block, color) => {
        this.blocks.setOutlineColor(block.mesh, color);
      },
    });
    this.groups = new GroupManager(this.scene, this.blocks, this.selection);
    this.movement = new MovementController(this.camera, this.controls);
    this.components = new ComponentManager(this.blocks, this.selection, this.groups);

    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("pointerdown", this.handlePointerDownCapture, true);
    canvas.addEventListener("pointermove", this.handlePointerMoveCapture, true);
    canvas.addEventListener("pointerup", this.handlePointerUpCapture, true);
    canvas.addEventListener("pointercancel", this.handleWindowPointerUpCapture, true);

    window.addEventListener("pointerup", this.handleWindowPointerUpCapture, true);
    window.addEventListener("pointercancel", this.handleWindowPointerUpCapture, true);
    window.addEventListener("keydown", this.handleMovementKeyChange, true);
    window.addEventListener("keyup", this.handleMovementKeyChange, true);

    document.addEventListener("keydown", this.handleMovementKeyChange, true);
    document.addEventListener("keyup", this.handleMovementKeyChange, true);
    this.canvas.addEventListener("keydown", this.handleMovementKeyChange, true);
    this.canvas.addEventListener("keyup", this.handleMovementKeyChange, true);

    this.setupScene();
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getCamera(): PerspectiveCamera {
    return this.camera;
  }

  public addSelectionListener(listener: SelectionListener): () => void {
    return this.selection.addListener(listener);
  }

  public addPointerUpListener(listener: PointerUpListener): () => void {
    this.pointerUpListeners.add(listener);
    return () => {
      this.pointerUpListeners.delete(listener);
    };
  }

  public addDragCommitListener(listener: (changes: DragCommitEntry[]) => void): () => void {
    this.dragCommitListeners.add(listener);
    return () => {
      this.dragCommitListeners.delete(listener);
    };
  }

  public start(): void {
    const renderLoop = (time: number) => {
      if (this.lastFrameTime === 0) {
        this.lastFrameTime = time;
      }
      const deltaSeconds = (time - this.lastFrameTime) / 1000;
      this.lastFrameTime = time;

      this.updateCameraMovement(deltaSeconds);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.animationFrame = requestAnimationFrame(renderLoop);
    };

    this.animationFrame = requestAnimationFrame(renderLoop);
  }

  public dispose(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    window.removeEventListener("resize", this.handleResize);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDownCapture, true);
    this.canvas.removeEventListener("pointermove", this.handlePointerMoveCapture, true);
    this.canvas.removeEventListener("pointerup", this.handlePointerUpCapture, true);
    this.canvas.removeEventListener("pointercancel", this.handleWindowPointerUpCapture, true);
    window.removeEventListener("pointerup", this.handleWindowPointerUpCapture, true);
    window.removeEventListener("pointercancel", this.handleWindowPointerUpCapture, true);
    window.removeEventListener("keydown", this.handleMovementKeyChange, true);
    window.removeEventListener("keyup", this.handleMovementKeyChange, true);
    document.removeEventListener("keydown", this.handleMovementKeyChange, true);
    document.removeEventListener("keyup", this.handleMovementKeyChange, true);
    this.canvas.removeEventListener("keydown", this.handleMovementKeyChange, true);
    this.canvas.removeEventListener("keyup", this.handleMovementKeyChange, true);
    this.controls.dispose();
    this.renderer.dispose();
  }

  public clearMovementState(): void {
    this.movement.clearState();
  }

  public placeBlockAt(clientX: number, clientY: number): EditorBlock | null {
    const point = this.intersectGround(clientX, clientY);
    if (!point) {
      this.clearMovementState();
      return null;
    }

    const block = this.blocks.createBlock({ position: point.setY(0.5) });
    this.clearMovementState();
    this.selection.setSelectionSingle(block);
    return block;
  }

  public createBlock(options: {
    position: Vector3;
    rotation?: Euler;
    scale?: Vector3;
    id?: string;
  }): EditorBlock {
    const block = this.blocks.createBlock(options);
    return block;
  }

  public removeBlock(id: string): boolean {
    const block = this.blocks.getBlock(id);
    if (block) {
      this.components.handleBlockRemoved(block);
    }
    this.selection.removeId(id);
    return this.blocks.removeBlock(id);
  }

  public getBlock(id: string): EditorBlock | undefined {
    return this.blocks.getBlock(id);
  }

  public applyTransform(id: string, transform: SelectionTransform): boolean {
    const block = this.blocks.getBlock(id);
    if (!block) {
      return false;
    }
    block.mesh.position.copy(transform.position);
    block.mesh.rotation.copy(transform.rotation);
    block.mesh.scale.copy(transform.scale);
    if (this.selection.getSelection()?.id === id) {
      this.selection.updatePosition(block.mesh.position);
      this.selection.updateRotation(block.mesh.rotation);
      this.selection.updateScale(block.mesh.scale);
    }
    this.components.syncActiveComponentEdits();
    return true;
  }

  public pickBlock(clientX: number, clientY: number, additive: boolean = false): EditorBlock | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects(this.blocks.getMeshes(), true);
    const editingId = this.getEditingComponentId();

    if (intersects.length === 0) {
      if (!additive) {
        this.selection.clearSelection();
      }
      return null;
    }

    let hit: EditorBlock | null = null;
    for (const result of intersects) {
      // Ignore outline helpers and any line-only helpers
      if (result.object instanceof LineSegments) {
        continue;
      }
      // Only count actual Mesh or Group objects that belong to blocks
      const mesh = result.object as Object3D;
      const block = this.blocks.findBlockByMesh(mesh);
      if (!block) {
        continue;
      }
      if (editingId && !this.components.isBlockWithinActiveEdit(block.id)) {
        continue;
      }
      hit = block;
      break;
    }

    if (hit) {
      if (additive) {
        this.selection.toggleSelection(hit);
      } else {
        this.selection.setSelectionSingle(hit);
      }
    } else if (!additive) {
      this.selection.clearSelection();
    }

    return hit;
  }

  public getSelection(): EditorBlock | null {
    return this.selection.getSelection();
  }

  public clearSelection(): void {
    this.selection.clearSelection();
  }

  public getSelectionArray(): EditorBlock[] {
    return this.selection.getSelectionArray();
  }

  public updateSelectedBlockPosition(position: Vector3): void {
    if (!this.selection.getSelection()) {
      return;
    }
    this.selection.updatePosition(position);
    this.components.syncActiveComponentEdits();
  }

  public updateSelectedBlockScale(scale: Vector3): void {
    if (!this.selection.getSelection()) {
      return;
    }
    this.selection.updateScale(scale);
    this.components.syncActiveComponentEdits();
  }

  public updateSelectedBlockRotation(rotation: Euler): void {
    if (!this.selection.getSelection()) {
      return;
    }
    this.selection.updateRotation(rotation);
    this.components.syncActiveComponentEdits();
  }

  public getSelectionTransform(): SelectionTransform | null {
    return this.selection.getSelectionTransform();
  }

  public getSelectedGroupMembersLocalTransforms(): ComponentMemberTransform[] | null {
    return this.components.getSelectedGroupMembersLocalTransforms(this.selection.getSelection());
  }

  public placeComponentAt(clientX: number, clientY: number, component: SavedComponent): EditorBlock | null {
    const point = this.intersectGround(clientX, clientY);
    if (!point) {
      this.clearMovementState();
      return null;
    }
    const block = this.components.placeComponentAt(point, component);
    this.clearMovementState();
    return block;
  }

  public createComponentFromSelectedGroup(label: string, id: string): string | null {
    return this.components.createComponentFromSelectedGroup(label, id);
  }

  public getComponentIdForSelectedGroup(): string | null {
    return this.components.getComponentIdForSelection(this.selection.getSelection());
  }

  public isComponentEditing(id: string): boolean {
    return this.components.isComponentEditing(id);
  }

  public getEditingComponentId(): string | null {
    return this.components.getEditingComponentId();
  }

  public startEditingComponent(id: string): boolean {
    return this.components.startEditingComponent(id);
  }

  public finishEditingComponent(id: string): boolean {
    return this.components.finishEditingComponent(id);
  }

  public groupSelection(): EditorBlock | null {
    return this.groups.groupSelection();
  }

  public groupByIds(ids: string[], groupId?: string): EditorBlock | null {
    return this.groups.groupByIds(ids, groupId);
  }

  public ungroupSelected(): EditorBlock[] | null {
    return this.groups.ungroupSelected();
  }

  public setSelectionByIds(ids: string[]): void {
    this.selection.setSelectionByIds(ids);
  }

  public applyTransformsForIds(entries: Array<{ id: string; transform: SelectionTransform }>): void {
    this.selection.applyTransformsForIds(entries);
    this.components.syncActiveComponentEdits();
  }

  public getTransformsForIds(ids: string[]): Array<{ id: string; transform: SelectionTransform }> {
    const results: Array<{ id: string; transform: SelectionTransform }> = [];
    for (const id of ids) {
      const block = this.blocks.getBlock(id);
      if (!block) {
        continue;
      }
      results.push({
        id,
        transform: {
          position: block.mesh.position.clone(),
          rotation: block.mesh.rotation.clone(),
          scale: block.mesh.scale.clone(),
        },
      });
    }
    return results;
  }

  public serializeBlocksByIds(ids: string[]): { nodes: SerializedNode[]; componentIds: string[] } {
    const usedComponents = new Set<string>();
    const nodes: SerializedNode[] = [];
    for (const id of ids) {
      const block = this.blocks.getBlock(id);
      if (!block) {
        continue;
      }
      const node = this.serializeEditorBlock(block, usedComponents);
      if (node) {
        nodes.push(node);
      }
    }
    return { nodes, componentIds: Array.from(usedComponents) };
  }

  public instantiateSerializedNodes(
    nodes: SerializedNode[],
    componentIds: string[],
    offset?: Vector3,
  ): EditorBlock[] {
    const created: EditorBlock[] = [];
    const requiredComponentIds = new Set(componentIds);
    const collectComponentIds = (node: SerializedNode): void => {
      if (node.componentId) {
        requiredComponentIds.add(node.componentId);
      }
      if (node.children) {
        node.children.forEach(collectComponentIds);
      }
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
      const clone = this.cloneSerializedNode(node);
      if (offset) {
        clone.transform = this.addOffsetToSerializedTransform(clone.transform, offset);
      }
      const block = this.instantiateRootNode(clone, componentMap);
      if (block) {
        created.push(block);
      }
    }

    if (created.length > 0) {
      this.components.syncActiveComponentEdits();
    }

    return created;
  }

  public removeComponentDefinition(id: string): void {
    const toRemove = this.components.disposeComponent(id);
    for (const blockId of toRemove) {
      this.removeBlock(blockId);
    }
  }

  public resetScene(): void {
    this.selection.clearSelection();
    this.blocks.clearAll();
    this.components.resetRuntimeState();
  }

  public exportScenario(name: string): SerializedScenario {
    const usedComponentIds = new Set<string>();
    const serializedBlocks: SerializedNode[] = [];
    for (const block of this.blocks.getAllBlocks()) {
      const node = this.serializeEditorBlock(block, usedComponentIds);
      if (node) {
        serializedBlocks.push(node);
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
      this.instantiateRootNode(node, componentMap);
    }

    this.selection.clearSelection();
  }

  private serializeEditorBlock(block: EditorBlock, usedComponents: Set<string>): SerializedNode | null {
    const componentId = this.components.getComponentIdForBlock(block);
    if (componentId) {
      usedComponents.add(componentId);
      return {
        type: "component",
        componentId,
        transform: this.toSerializedTransform(block.mesh, "world"),
      };
    }

    if (block.mesh instanceof Group) {
      const children: SerializedNode[] = [];
      for (const child of block.mesh.children) {
        const serializedChild = this.serializeObject(child, usedComponents, "local");
        if (serializedChild) {
          children.push(serializedChild);
        }
      }
      return {
        type: "group",
        transform: this.toSerializedTransform(block.mesh, "world"),
        children,
      };
    }

    if (block.mesh instanceof Mesh) {
      return {
        type: "block",
        transform: this.toSerializedTransform(block.mesh, "world"),
      };
    }

    return null;
  }

  private serializeObject(object: Object3D, usedComponents: Set<string>, space: "world" | "local"): SerializedNode | null {
    if (object instanceof LineSegments) {
      return null;
    }

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
        if (serializedChild) {
          children.push(serializedChild);
        }
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

  private toSerializedTransform(object: Object3D, space: "world" | "local"): SerializedTransform {
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

  private instantiateRootNode(node: SerializedNode, componentMap: Map<string, SavedComponent>): EditorBlock | null {
    switch (node.type) {
      case "block": {
        const transform = this.transformFromSerialized(node.transform);
        return this.createBlock({
          position: transform.position,
          rotation: transform.rotation,
          scale: transform.scale,
        });
      }
      case "component": {
        if (!node.componentId) {
          return null;
        }
        const definition = componentMap.get(node.componentId);
        if (!definition) {
          return null;
        }
        const transform = this.transformFromSerialized(node.transform);
        return this.components.instantiateComponent(definition, transform);
      }
      case "group": {
        const group = this.buildGroupFromNode(node, componentMap);
        if (group) {
          return this.blocks.registerGroup(group);
        }
        return null;
      }
    }
    return null;
  }

  private buildGroupFromNode(node: SerializedNode, componentMap: Map<string, SavedComponent>): Group | null {
    const group = new Group();
    this.applySerializedTransform(group, node.transform);

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const childObject = this.buildChildObject(child, componentMap);
        if (childObject) {
          group.add(childObject);
        }
      }
    }

    return group;
  }

  private buildChildObject(child: SerializedNode, componentMap: Map<string, SavedComponent>): Object3D | null {
    switch (child.type) {
      case "block": {
        const mesh = this.blocks.createPrimitiveBlockMesh();
        this.applySerializedTransform(mesh, child.transform);
        return mesh;
      }
      case "group": {
        return this.buildGroupFromNode(child, componentMap);
      }
      case "component": {
        return null;
      }
    }
  }

  private applySerializedTransform(target: Object3D, transform: SerializedTransform): void {
    target.position.set(transform.position.x, transform.position.y, transform.position.z);
    target.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    target.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
  }

  private transformFromSerialized(transform: SerializedTransform): SelectionTransform {
    return {
      position: new Vector3(transform.position.x, transform.position.y, transform.position.z),
      rotation: new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z),
      scale: new Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
    };
  }

  private cloneSerializedNode(node: SerializedNode): SerializedNode {
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

  private addOffsetToSerializedTransform(transform: SerializedTransform, offset: Vector3): SerializedTransform {
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

  private resolveBlockOutlineColor(block: EditorBlock, selected: boolean): number {
    const role = (block.mesh.userData?.componentRole as string | undefined) ?? null;
    if (role === "master") {
      return COMPONENT_MASTER_OUTLINE_COLOR;
    }
    if (role === "instance") {
      return COMPONENT_INSTANCE_OUTLINE_COLOR;
    }
    return selected ? 0xff0000 : 0x000000;
  }

  private setupScene(): void {
    const ambient = new AmbientLight(0xffffff, 3.0);
    const directional = new DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 12, 6);

    this.groundPlane.receiveShadow = true;
    this.groundPlane.position.set(0, -0.05, 0);
    this.groundPlane.visible = true;

    const grid = new GridHelper(200, 40, 0x000000, 0x505050);
    const gridMaterial = grid.material as LineBasicMaterial;
    gridMaterial.depthTest = true;
    gridMaterial.transparent = false;
    gridMaterial.opacity = 1;
    grid.renderOrder = 1;

    const axes = new AxesHelper(8);
    const axesMaterial = axes.material as LineBasicMaterial;
    axesMaterial.depthTest = false;
    axes.renderOrder = 2;

    this.scene.add(ambient, directional, grid, axes);
  }

  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private emitPointerUp(event: PointerEvent, context: { dragged: boolean }): void {
    for (const listener of this.pointerUpListeners) {
      listener(event, context);
    }
  }

  private emitDragCommit(changes: DragCommitEntry[]): void {
    if (changes.length === 0) {
      return;
    }
    for (const listener of this.dragCommitListeners) {
      listener(changes.map((entry) => ({
        id: entry.id,
        before: cloneTransform(entry.before),
        after: cloneTransform(entry.after),
      })));
    }
  }

  private collectDragChanges(targets: Array<{ id: string; origin: SelectionTransform }>): DragCommitEntry[] {
    if (targets.length === 0) {
      return [];
    }
    const ids = targets.map((target) => target.id);
    const current = this.getTransformsForIds(ids);
    const changes: DragCommitEntry[] = [];
    for (const target of targets) {
      const currentEntry = current.find((entry) => entry.id === target.id);
      if (!currentEntry) {
        continue;
      }
      if (hasTransformChanged(target.origin, currentEntry.transform)) {
        changes.push({
          id: target.id,
          before: cloneTransform(target.origin),
          after: cloneTransform(currentEntry.transform),
        });
      }
    }
    return changes;
  }

  private finalizePointerRelease(event: PointerEvent, commit: boolean): void {
    const wasDragging = this.isDragging;
    const dragTargets = this.dragTargets;
    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragTargets = [];

    if (commit && wasDragging) {
      const changes = this.collectDragChanges(dragTargets);
      this.emitDragCommit(changes);
    }

    this.emitPointerUp(event, { dragged: wasDragging });
  }

  private handlePointerDownCapture = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.leftButtonActive = true;
      this.controls.enabled = false;
      // Prevent OrbitControls from attempting pointer capture
      event.preventDefault();
      event.stopImmediatePropagation();

      // Try to pick a block under the cursor; update selection accordingly
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      const hit = this.pickBlock(event.clientX, event.clientY, additive);

      // Start drag only if we hit something directly
      const selection = this.getSelectionArray();
      const shouldDrag = !!hit;
      if (shouldDrag) {
        const start = this.intersectGround(event.clientX, event.clientY);
        if (start) {
          this.isDragging = true;
          this.dragStartPoint = start;
          const ids = selection.map((b) => b.id);
          this.dragTargets = this.getTransformsForIds(ids).map((entry) => ({ id: entry.id, origin: entry.transform }));
        }
      }
      return;
    }

    if (event.button === 2) {
      this.controls.enabled = true;
    }
  };

  private handlePointerMoveCapture = (event: PointerEvent): void => {
    if (!this.isDragging || !this.leftButtonActive) {
      return;
    }
    // Prevent OrbitControls gestures while dragging
    event.preventDefault();
    event.stopImmediatePropagation();
    const current = this.intersectGround(event.clientX, event.clientY);
    if (!current || !this.dragStartPoint || this.dragTargets.length === 0) {
      return;
    }

    // Compute horizontal delta on XZ plane
    const delta = new Vector3(
      current.x - this.dragStartPoint.x,
      0,
      current.z - this.dragStartPoint.z,
    );

    const updates = this.dragTargets.map(({ id, origin }) => {
      const newPos = origin.position.clone().add(delta);
      // keep Y from origin to constrain movement to ground plane
      newPos.y = origin.position.y;
      return {
        id,
        transform: {
          position: newPos,
          rotation: origin.rotation.clone(),
          scale: origin.scale.clone(),
        },
      };
    });

    this.applyTransformsForIds(updates);
  };

  private handlePointerUpCapture = (event: PointerEvent): void => {
    if (event.button === 0 && this.leftButtonActive) {
      this.leftButtonActive = false;
      this.controls.enabled = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.finalizePointerRelease(event, true);
    }
  };

  private handleWindowPointerUpCapture = (event: PointerEvent): void => {
    const isPrimaryButton = event.button === 0 || event.type === "pointercancel";
    if (isPrimaryButton && this.leftButtonActive) {
      this.leftButtonActive = false;
      this.controls.enabled = true;
      const commit = event.type === "pointerup";
      this.finalizePointerRelease(event, commit);
    }
  };

  private handleMovementKeyChange = (event: KeyboardEvent): void => {
    if (event.type === "keydown" && (event.key === "Control" || event.key === "Meta")) {
      this.movement.clearState();
    }
    if (this.movement.handleKeyChange(event)) {
      event.preventDefault();
    }
  };

  private updateCameraMovement(deltaSeconds: number): void {
    this.movement.update(deltaSeconds);
  }

  private intersectGround(clientX: number, clientY: number): Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const planeNormal = new Vector3(0, 1, 0);
    const planePoint = new Vector3(0, 0, 0);
    const ray = this.raycaster.ray;
    const denom = planeNormal.dot(ray.direction);
    if (Math.abs(denom) < 1e-6) {
      return null;
    }
    const t = planePoint.clone().sub(ray.origin).dot(planeNormal) / denom;
    if (t < 0) {
      return null;
    }
    return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
  }
}

function cloneTransform(input: SelectionTransform): SelectionTransform {
  return {
    position: input.position.clone(),
    rotation: input.rotation.clone(),
    scale: input.scale.clone(),
  };
}

function hasTransformChanged(before: SelectionTransform, after: SelectionTransform): boolean {
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
