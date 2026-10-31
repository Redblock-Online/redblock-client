import {
  AmbientLight,
  AxesHelper,
  Color,
  DirectionalLight,
  Euler,
  LineBasicMaterial,
  LineSegments,
  Mesh,
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
import type { ComponentMemberTransform, SavedComponent } from "@/features/editor/components-system/componentsStore";
import { DEFAULT_RANDOM_STATIC_CONFIG, type GeneratorConfig } from "@/features/editor/types/generatorConfig";
import { loadComponents } from "@/features/editor/components-system/componentsStore";
import type {
  EditorBlock,
  SelectionListener,
  SelectionTransform,
  SerializedNode,
} from "@/features/editor/types";
import { BlockStore } from "@/features/editor/core/BlockStore";
import { SelectionManager } from "@/features/editor/core/SelectionManager";
import { MovementController } from "@/features/editor/core/MovementController";
import { GroupManager } from "@/features/editor/core/GroupManager";
import { ComponentManager } from "@/features/editor/core/ComponentManager";
import type { SerializedScenario } from "@/features/editor/scenarios/scenarioStore";
import { EditorModeManager } from "@/features/editor/core/EditorModeManager";
import { InputRouter } from "@/features/editor/core/InputRouter";
import { EditorSerializer } from "@/features/editor/core/EditorSerializer";
import { AlertManager } from "@/features/editor/core/AlertManager";
import { DragHandler } from "@/features/editor/core/handlers/DragHandler";
import { TransformHandler } from "@/features/editor/core/handlers/TransformHandler";
import { SelectionHandler } from "@/features/editor/core/handlers/SelectionHandler";
import { markMeshAsGenerator } from "@/features/editor/core/blockFactory";
import { cloneTransform } from "@/features/editor/core/EditorTransformUtils";
import { isEditableTarget } from "@/features/editor/core/inputUtils";

const COMPONENT_MASTER_OUTLINE_COLOR = 0x9b5cff;
const COMPONENT_INSTANCE_OUTLINE_COLOR = 0xff4dff;

type DragCommitEntry = {
  id: string;
  before: SelectionTransform;
  after: SelectionTransform;
};

export default class EditorApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  
  // Flag to disable keyboard shortcuts when user is typing in an input
  private isTyping = false;
  // Flag to prevent dragging when selecting a generator target
  private isSelectingGeneratorTarget = false;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();

  private readonly blocks: BlockStore;
  private readonly selection: SelectionManager;
  private readonly groups: GroupManager;
  private readonly movement: MovementController;
  private readonly components: ComponentManager;
  public readonly alerts: AlertManager;
  private readonly serializer: EditorSerializer;
  private readonly dragCommitListeners = new Set<(changes: DragCommitEntry[]) => void>();

  private draggingCursorApplied = false;
  private animationFrame?: number;
  private lastFrameTime = 0;
  // True while the game preview runs: editor shortcuts, camera movement and rendering pause
  private inputSuspended = false;
  public readonly dragCameraQuaternionPublic = new Quaternion(); // For handlers

  // New mode system
  public readonly modeManager: EditorModeManager;
  private readonly inputRouter: InputRouter;
  private readonly dragHandler: DragHandler;
  private readonly transformHandler: TransformHandler;
  private readonly selectionHandler: SelectionHandler;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = SRGBColorSpace;

    this.scene = new Scene();
    this.scene.background = new Color(0xf5f5f5); // Light gray background for modern look

    this.camera = new PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(8, 10, 14);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI - 0.1;
    this.controls.target.set(0, 0, 0);
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    // Only right click for orbit, left click is for selection/drag
    this.controls.mouseButtons.LEFT = undefined; // Disable left click
    this.controls.mouseButtons.MIDDLE = undefined; // Disable middle click
    this.controls.mouseButtons.RIGHT = MOUSE.ROTATE; // Right click for orbit

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
    this.serializer = new EditorSerializer(this.blocks, this.components);
    this.alerts = new AlertManager();

    // Initialize new mode system
    this.modeManager = new EditorModeManager();
    this.dragHandler = new DragHandler(this.modeManager, this);
    this.transformHandler = new TransformHandler(this.modeManager, this);
    this.selectionHandler = new SelectionHandler(this.modeManager, this);
    
    // Connect handlers
    this.selectionHandler.setDragHandler(this.dragHandler);
    
    this.inputRouter = new InputRouter(
      this.modeManager,
      this.dragHandler,
      this.transformHandler,
      this.selectionHandler,
      this,
    );

    // Setup callbacks
    this.dragHandler.setCommitCallback((changes) => {
      this.emitDragCommit(changes);
    });

    this.transformHandler.setCommitCallback((changes) => {
      this.emitDragCommit(changes);
    });

    // Note: Transform update callback will be set by EditorRoot via modeManager listener

    canvas.addEventListener("contextmenu", this.handleContextMenu);

    // Single set of pointer listeners routed by the current editor mode
    canvas.addEventListener("pointerdown", this.handleCanvasPointerDown);
    canvas.addEventListener("pointermove", this.handleCanvasPointerMove);
    canvas.addEventListener("pointerup", this.handleCanvasPointerUp);
    // Ensure we clean up even if the pointer is released/canceled outside the canvas
    window.addEventListener("pointerup", this.handleGlobalPointerUp, { capture: true });
    window.addEventListener("pointercancel", this.handleGlobalPointerCancel, { capture: true });
    window.addEventListener("blur", this.handleWindowBlur);

    window.addEventListener("keydown", this.handleKeyDown);

    // Camera movement keys (window capture sees every key event once)
    window.addEventListener("keydown", this.handleMovementKeyChange, true);
    window.addEventListener("keyup", this.handleMovementKeyChange, true);

    this.setupScene();
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  private handleContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private handleCanvasPointerDown = (event: PointerEvent): void => {
    this.inputRouter.handlePointerDown(event);
  };

  private handleCanvasPointerMove = (event: PointerEvent): void => {
    this.inputRouter.handlePointerMove(event);
  };

  private handleCanvasPointerUp = (event: PointerEvent): void => {
    this.inputRouter.handlePointerUp(event);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    this.inputRouter.handleKeyDown(event);
  };

  // Ensure cleanup when pointer released outside the canvas
  private handleGlobalPointerUp = (event: PointerEvent): void => {
    const mode = this.modeManager.getMode();
    if (mode.type === "dragging") {
      event.preventDefault?.();
      this.dragHandler.finish(true);
      this.selectionHandler.handleDragEnd(event);
    }
    // A box selection released outside the canvas must still end
    if (event.target !== this.canvas) {
      this.selectionHandler.cancelBoxSelection();
    }
    // Transforming is committed via click/Enter by design; do not auto-commit here
  };

  // Cancel interactions on pointer cancel to avoid stuck states
  private handleGlobalPointerCancel = (_event: PointerEvent): void => {
    const mode = this.modeManager.getMode();
    if (mode.type === "dragging") {
      this.dragHandler.finish(false);
    } else if (mode.type === "transforming") {
      this.transformHandler.finish(false);
    }
  };

  // Also cancel interactions if the window loses focus
  private handleWindowBlur = (): void => {
    this.movement.clearState();
    this.selectionHandler.cancelBoxSelection();
    const mode = this.modeManager.getMode();
    if (mode.type === "dragging") {
      this.dragHandler.finish(false);
    } else if (mode.type === "transforming") {
      this.transformHandler.finish(false);
    }
  };

  public setDraggingCursor(active: boolean): void {
    if (active === this.draggingCursorApplied) {
      return;
    }
    this.draggingCursorApplied = active;
    this.canvas.style.cursor = active ? "pointer" : "default";
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getCamera(): PerspectiveCamera {
    return this.camera;
  }

  public getControls(): OrbitControls {
    return this.controls;
  }

  public addSelectionListener(listener: SelectionListener): () => void {
    return this.selection.addListener(listener);
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

      // The editor canvas is hidden while the game preview runs: skip the work
      if (!this.inputSuspended) {
        this.updateCameraMovement(deltaSeconds);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
      }
      this.animationFrame = requestAnimationFrame(renderLoop);
    };

    this.animationFrame = requestAnimationFrame(renderLoop);
  }

  public dispose(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Leave any in-progress interaction (releases pointer lock and re-enables controls)
    if (this.modeManager.isTransforming()) {
      this.transformHandler.finish(false);
    } else if (this.modeManager.isDragging()) {
      this.dragHandler.finish(false);
    }

    window.removeEventListener("resize", this.handleResize);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
    this.canvas.removeEventListener("pointerdown", this.handleCanvasPointerDown);
    this.canvas.removeEventListener("pointermove", this.handleCanvasPointerMove);
    this.canvas.removeEventListener("pointerup", this.handleCanvasPointerUp);
    window.removeEventListener("pointerup", this.handleGlobalPointerUp, { capture: true });
    window.removeEventListener("pointercancel", this.handleGlobalPointerCancel, { capture: true });
    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keydown", this.handleMovementKeyChange, true);
    window.removeEventListener("keyup", this.handleMovementKeyChange, true);
    this.transformHandler.dispose();
    this.selectionHandler.dispose();
    this.selection.clearSelection();
    this.blocks.clearAll();
    this.controls.dispose();
    this.renderer.dispose();
  }

  public clearMovementState(): void {
    this.movement.clearState();
  }
  
  /**
   * Disable editor controls (for when game preview is active)
   */
  public disableControls(): void {
    if (this.modeManager.isTransforming()) {
      this.transformHandler.finish(false);
    } else if (this.modeManager.isDragging()) {
      this.dragHandler.finish(false);
    }
    this.controls.enabled = false;
    this.movement.disable();
    this.inputSuspended = true;
  }
  
  /**
   * Enable editor controls (for when returning from game preview)
   */
  public enableControls(): void {
    this.controls.enabled = true;
    this.movement.enable();
    this.inputSuspended = false;
    this.lastFrameTime = 0;
  }

  /**
   * Whether the editor is paused (game preview running).
   */
  public isInputSuspended(): boolean {
    return this.inputSuspended;
  }

  /**
   * Whether an editor keyboard shortcut should ignore this event: the game preview is running,
   * or the user is typing in a form field.
   */
  public shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
    if (this.inputSuspended) {
      return true;
    }
    if (isEditableTarget(event.target)) {
      return true;
    }
    if (this.isTyping) {
      // Self-heal: an input that unmounts while focused never fires blur
      if (typeof document !== "undefined" && !isEditableTarget(document.activeElement)) {
        this.isTyping = false;
        return false;
      }
      return true;
    }
    return false;
  }
  
  /**
   * Set typing state - disables keyboard shortcuts when user is typing in inputs
   */
  public setTyping(typing: boolean): void {
    this.isTyping = typing;
  }
  
  /**
   * Check if user is currently typing
   */
  public isUserTyping(): boolean {
    return this.isTyping;
  }

  /**
   * Set generator target selection mode - prevents dragging when selecting a target
   */
  public setSelectingGeneratorTarget(selecting: boolean): void {
    this.isSelectingGeneratorTarget = selecting;
  }

  /**
   * Check if currently selecting a generator target
   */
  public isSelectingGenerator(): boolean {
    return this.isSelectingGeneratorTarget;
  }

  /**
   * Validate scene and update alerts
   */
  public validateScene(): void {
    // Find spawn point
    const spawnPoint = this.blocks.getAllBlocks().find(block => 
      block.mesh.userData.isSpawnPoint === true
    );

    if (spawnPoint) {
      // Check if there's a floor beneath the spawn point
      const spawnPos = new Vector3();
      spawnPoint.mesh.getWorldPosition(spawnPos);
      
      // Raycast downward from spawn point
      const raycaster = new Raycaster();
      raycaster.set(spawnPos, new Vector3(0, -1, 0));
      
      // Get all meshes except the spawn point itself
      const meshes = this.blocks.getAllBlocks()
        .filter(b => b.id !== spawnPoint.id)
        .map(b => b.mesh);
      
      const intersects = raycaster.intersectObjects(meshes, true);
      
      // Check if there's a floor within reasonable distance (10 units)
      const hasFloor = intersects.length > 0 && intersects[0].distance < 10;
      
      if (!hasFloor) {
        this.alerts.publish(
          "spawn-no-floor",
          "warning",
          "Spawn point has no floor beneath it. Players will fall into the void."
        );
      } else {
        this.alerts.clear("spawn-no-floor");
      }
    } else {
      // No spawn point - could add another alert here if needed
      this.alerts.clear("spawn-no-floor");
    }
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

  public placeSpawnAt(clientX: number, clientY: number): EditorBlock | null {
    // Check if a spawn point already exists
    if (this.hasSpawnPoint()) {
      console.warn("Only one spawn point is allowed");
      return null;
    }

    const point = this.intersectGround(clientX, clientY);
    if (!point) {
      return null;
    }

    const spawn = this.blocks.createSpawnPoint({ position: point.setY(0.5) });
    this.clearMovementState();
    this.selection.setSelectionSingle(spawn);
    return spawn;
  }

  public hasSpawnPoint(): boolean {
    const blocks = this.blocks.getAllBlocks();
    return blocks.some((block) => block.mesh.userData.isSpawnPoint === true);
  }

  public placeRandomTargetGeneratorAt(clientX: number, clientY: number): EditorBlock | null {
    const point = this.intersectGround(clientX, clientY);
    if (!point) {
      return null;
    }

    // Create a generator marker (cube with distinct appearance)
    const generator = this.blocks.createBlock({
      position: point.setY(0.5),
      scale: new Vector3(0.6, 0.6, 0.6),
    });
    
    const config: GeneratorConfig = JSON.parse(JSON.stringify(DEFAULT_RANDOM_STATIC_CONFIG));
    markMeshAsGenerator(generator.mesh as Mesh, config);
    generator.generatorConfig = config;

    this.clearMovementState();
    this.selection.setSelectionSingle(generator);
    return generator;
  }
  /**
   * Detects which block is under the cursor without changing the selection.
   * This is useful for checking if a clicked block is already selected.
   */
  public detectBlockUnderCursor(clientX: number, clientY: number): EditorBlock | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects(this.blocks.getMeshes(), true);
    const editingId = this.getEditingComponentId();

    if (intersects.length === 0) {
      return null;
    }

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
      return block;
    }

    return null;
  }
  public updateGeneratorConfig(blockId: string, config: GeneratorConfig): boolean {
    const block = this.blocks.getBlock(blockId);
    if (!block || !block.mesh.userData.isGenerator) {
      return false;
    }
    block.generatorConfig = config;
    block.mesh.userData.generatorConfig = config;
    return true;
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
  
  public renameBlock(oldId: string, newId: string): boolean {
    return this.blocks.renameBlock(oldId, newId);
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

  /**
   * Select all blocks whose screen projection falls within the given rectangle
   */
  public selectBlocksInRect(bounds: { left: number; top: number; right: number; bottom: number }, additive: boolean): void {
    const blocksInRect: EditorBlock[] = [];
    
    // Project each block's position to screen space
    for (const block of this.blocks.getAllBlocks()) {
      const worldPos = new Vector3();
      block.mesh.getWorldPosition(worldPos);
      
      // Project to screen space
      const screenPos = worldPos.clone().project(this.camera);
      
      // Convert from NDC (-1 to 1) to screen coordinates
      const canvas = this.canvas;
      const rect = canvas.getBoundingClientRect();
      const x = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
      const y = (-(screenPos.y) * 0.5 + 0.5) * rect.height + rect.top;
      
      // Check if within selection bounds
      if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
        // Also check if in front of camera
        if (screenPos.z < 1) {
          blocksInRect.push(block);
        }
      }
    }
    
    if (blocksInRect.length > 0) {
      if (additive) {
        // Add to existing selection
        const currentArray = this.selection.getSelectionArray();
        const combined = [...currentArray, ...blocksInRect];
        // Remove duplicates
        const unique = Array.from(new Map(combined.map(b => [b.id, b])).values());
        this.selection.setSelectionByIds(unique.map(b => b.id));
      } else {
        // Replace selection
        this.selection.setSelectionByIds(blocksInRect.map(b => b.id));
      }
    } else if (!additive) {
      // Clear selection if nothing found and not additive
      this.selection.clearSelection();
    }
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
    return this.serializer.serializeBlocksByIds(ids);
  }

  /**
   * Recreate blocks from serialized nodes.
   *
   * @param options.offset - World offset added to every root node (paste)
   * @param options.preserveIds - Reuse the stored ids (undo/redo); paste uses fresh ids
   */
  public instantiateSerializedNodes(
    nodes: SerializedNode[],
    componentIds: string[],
    options: { offset?: Vector3; preserveIds?: boolean } = {},
  ): EditorBlock[] {
    const requiredComponentIds = new Set(componentIds);
    const collectComponentIds = (node: SerializedNode): void => {
      if (node.componentId) {
        requiredComponentIds.add(node.componentId);
      }
      node.children?.forEach(collectComponentIds);
    };
    nodes.forEach(collectComponentIds);

    const componentMap = new Map<string, SavedComponent>();
    for (const definition of loadComponents()) {
      if (requiredComponentIds.has(definition.id)) {
        componentMap.set(definition.id, definition);
      }
    }

    const created = this.serializer.instantiateNodes(nodes, componentMap, options);
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
    const { nodes, componentIds } = this.serializer.serializeScene();
    const used = new Set(componentIds);
    const definitions = loadComponents().filter((component) => used.has(component.id));

    return {
      version: 1,
      name,
      createdAt: new Date().toISOString(),
      blocks: nodes,
      componentDefinitions: definitions,
    };
  }

  public importScenario(scenario: SerializedScenario): void {
    this.resetScene();

    const definitions = scenario.componentDefinitions ?? [];
    const componentMap = new Map<string, SavedComponent>();
    for (const definition of definitions) {
      componentMap.set(definition.id, definition);
    }
    this.components.registerComponentDefinitions(definitions);

    // Keep the stored ids: generator events reference other generators by id
    this.serializer.instantiateNodes(scenario.blocks ?? [], componentMap, { preserveIds: true });

    this.selection.clearSelection();
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

    const axes = new AxesHelper(8);
    const axesMaterial = axes.material as LineBasicMaterial;
    axesMaterial.depthTest = false;
    axes.renderOrder = 2;

    this.scene.add(ambient, directional, axes);
  }

  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

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

  private handleMovementKeyChange = (event: KeyboardEvent): void => {
    if (event.type === "keydown" && this.shouldIgnoreKeyEvent(event)) {
      return;
    }
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

  public intersectGround(clientX: number, clientY: number): Vector3 | null {
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
