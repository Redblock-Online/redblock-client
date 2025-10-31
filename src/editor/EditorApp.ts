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
import { DEFAULT_RANDOM_STATIC_CONFIG, DEFAULT_MOVING_CONFIG, type GeneratorConfig } from "./types/generatorConfig";
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
import { EditorModeManager } from "./core/EditorModeManager";
import { InputRouter } from "./core/InputRouter";
import { EditorSerializer } from "./core/EditorSerializer";
import { AlertManager } from "./core/AlertManager";
import { DragHandler } from "./core/handlers/DragHandler";
import { TransformHandler } from "./core/handlers/TransformHandler";
import { SelectionHandler } from "./core/handlers/SelectionHandler";
import { createSpawnPointMesh } from "./core/blockFactory";

const COMPONENT_MASTER_OUTLINE_COLOR = 0x9b5cff;
const COMPONENT_INSTANCE_OUTLINE_COLOR = 0xff4dff;

type DragAxisConstraint = "x" | "y" | "z" | null;

type PointerUpListener = (event: PointerEvent, context: { dragged: boolean }) => void;

type DragCommitEntry = {
  id: string;
  before: SelectionTransform;
  after: SelectionTransform;
};

const DRAG_AXIS_VECTORS = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
} as const;

const DRAG_VERTICAL_SENSITIVITY = 0.02;

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
  private readonly pointerUpListeners = new Set<PointerUpListener>();
  private readonly dragCommitListeners = new Set<(changes: DragCommitEntry[]) => void>();

  private leftButtonActive = false;
  private isDragging = false;
  private draggingCursorApplied = false;
  private dragStartPoint: Vector3 | null = null;
  private dragTargets: Array<{ id: string; origin: SelectionTransform }> = [];
  private dragAxisConstraint: DragAxisConstraint = null;
  private dragPointerAccumulator = { x: 0, y: 0 };
  private lastPointerEvent: { clientX: number; clientY: number } | null = null;
  private animationFrame?: number;
  private lastFrameTime = 0;
  private readonly dragWorkingDelta = new Vector3();
  private readonly dragTranslationDelta = new Vector3();
  private readonly dragCameraRight = new Vector3();
  private readonly dragCameraUp = new Vector3();
  private readonly dragPointerWorld = new Vector3();
  private readonly dragCameraQuaternion = new Quaternion();
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
    this.scene.background = new Color(0x3d3d3d); // Blender-style dark gray background

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

    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    
    // NEW: Single event listeners using InputRouter
    canvas.addEventListener("pointerdown", (e) => this.inputRouter.handlePointerDown(e));
    canvas.addEventListener("pointermove", (e) => this.inputRouter.handlePointerMove(e));
    canvas.addEventListener("pointerup", (e) => this.inputRouter.handlePointerUp(e));
    // Ensure we clean up even if the pointer is released/canceled outside the canvas
    window.addEventListener("pointerup", this.handleGlobalPointerUp, { capture: true });
    window.addEventListener("pointercancel", this.handleGlobalPointerCancel, { capture: true });
    window.addEventListener("blur", this.handleWindowBlur);
    
    window.addEventListener("keydown", (e) => this.inputRouter.handleKeyDown(e));

    // Keep movement keys
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

  // Ensure cleanup when pointer released outside the canvas
  private handleGlobalPointerUp = (event: PointerEvent): void => {
    const mode = this.modeManager.getMode();
    if (mode.type === "dragging") {
      event.preventDefault?.();
      this.dragHandler.finish(true);
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

  private resetDragPointerAccumulator(): void {
    this.dragPointerAccumulator.x = 0;
    this.dragPointerAccumulator.y = 0;
  }

  private resetDragStartFromPointer(): void {
    if (!this.lastPointerEvent) {
      return;
    }
    const nextStart = this.intersectGround(this.lastPointerEvent.clientX, this.lastPointerEvent.clientY);
    if (nextStart) {
      this.dragStartPoint = nextStart;
    }
  }

  private refreshDragOrigins(): void {
    if (this.dragTargets.length === 0) {
      return;
    }
    const ids = this.dragTargets.map((target) => target.id);
    const current = this.getTransformsForIds(ids);
    this.dragTargets = current.map((entry) => ({ id: entry.id, origin: entry.transform }));
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

  public isDraggingBlock(): boolean {
    return this.isDragging;
  }

  public toggleDragAxis(axis: "x" | "y" | "z"): void {
    if (!this.isDragging) {
      return;
    }
    const next: DragAxisConstraint = this.dragAxisConstraint === axis ? null : axis;
    if (next === this.dragAxisConstraint) {
      return;
    }
    this.dragAxisConstraint = next;
    this.resetDragPointerAccumulator();
    this.refreshDragOrigins();
    if (next === "y") {
      this.dragStartPoint = null;
    } else {
      this.resetDragStartFromPointer();
    }
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
    // Note: InputRouter listeners are removed automatically when the canvas is removed
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
  
  /**
   * Disable editor controls (for when game preview is active)
   */
  public disableControls(): void {
    this.controls.enabled = false;
    this.movement.disable();
    console.log("[EditorApp] Controls and movement disabled");
  }
  
  /**
   * Enable editor controls (for when returning from game preview)
   */
  public enableControls(): void {
    this.controls.enabled = true;
    this.movement.enable();
    console.log("[EditorApp] Controls and movement enabled");
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
      
      // Start raycast from the bottom of the spawn point sphere (radius = 0.5)
      // This ensures we check from where the player would actually stand
      const rayOrigin = spawnPos.clone();
      rayOrigin.y -= 0.5; // Subtract sphere radius to get bottom position
      
      // Raycast downward from spawn point
      const raycaster = new Raycaster();
      raycaster.set(rayOrigin, new Vector3(0, -1, 0));
      
      // Get all solid block meshes (exclude spawn point, generators, and other non-solid objects)
      const meshes = this.blocks.getAllBlocks()
        .filter(b => {
          // Exclude the spawn point itself
          if (b.id === spawnPoint.id) return false;
          // Exclude generators (they generate targets which are non-solid)
          if (b.mesh.userData.isGenerator === true) return false;
          // Exclude any other non-solid objects
          if (b.mesh.userData.isTarget === true) return false;
          // Include only solid blocks
          return true;
        })
        .map(b => b.mesh);
      
      const intersects = raycaster.intersectObjects(meshes, true);
      
      // Check if there's any floor beneath the spawn point
      const hasFloor = intersects.length > 0;
      
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
    
    // Mark as generator in userData
    generator.mesh.userData.isGenerator = true;
    generator.mesh.userData.generatorType = "randomStatic";
    generator.generatorConfig = { ...DEFAULT_RANDOM_STATIC_CONFIG };
    generator.mesh.userData.generatorConfig = generator.generatorConfig;
    
    // Give it a distinct color (pink/magenta for generators)
    const mesh = generator.mesh as Mesh;
    if (mesh.material) {
      const material = mesh.material as MeshStandardMaterial;
      material.color.set(0xff4dff); // Pink/magenta color
      material.emissive = new Color(0xff4dff);
      material.emissiveIntensity = 0.2;
    }
    
    this.clearMovementState();
    this.selection.setSelectionSingle(generator);
    return generator;
  }

  // COMMENTED OUT: Moving Target Generator - Not implemented yet
  // public placeMovingTargetGeneratorAt(clientX: number, clientY: number): EditorBlock | null {
  //   const point = this.intersectGround(clientX, clientY);
  //   if (!point) {
  //     return null;
  //   }

  //   // Create a generator marker (cube with distinct appearance)
  //   const generator = this.blocks.createBlock({
  //     position: point.setY(0.5),
  //     scale: new Vector3(0.6, 0.6, 0.6),
  //   });
  //   
  //   // Mark as generator in userData
  //   generator.mesh.userData.isGenerator = true;
  //   generator.mesh.userData.generatorType = "moving";
  //   generator.generatorConfig = { ...DEFAULT_MOVING_CONFIG };
  //   generator.mesh.userData.generatorConfig = generator.generatorConfig;
  //   
  //   // Give it a distinct color (cyan/blue for moving generators)
  //   const mesh = generator.mesh as Mesh;
  //   if (mesh.material) {
  //     const material = mesh.material as MeshStandardMaterial;
  //     material.color.set(0x00ddff); // Cyan color for moving targets
  //     material.emissive = new Color(0x00ddff);
  //     material.emissiveIntensity = 0.2;
  //   }
  //   
  //   this.clearMovementState();
  //   this.selection.setSelectionSingle(generator);
  //   return generator;
  // }

  public updateGeneratorConfig(blockId: string, config: GeneratorConfig): void {
    console.log(`[EditorApp] updateGeneratorConfig called for ${blockId}:`, config);
    const block = this.blocks.getBlock(blockId);
    if (block && block.mesh.userData.isGenerator) {
      block.generatorConfig = config;
      block.mesh.userData.generatorConfig = config;
      console.log(`[EditorApp] Generator config updated successfully. enabled=${config.enabled}, visible=${config.visible}`);
    } else {
      console.warn(`[EditorApp] Cannot update generator config - block not found or not a generator:`, blockId);
    }
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
    console.log('[EditorApp] removeBlock called for:', id);
    console.trace('[EditorApp] removeBlock stack trace');
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
        ...(block.name && { name: block.name }),
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
        ...(block.name && { name: block.name }),
      };
    }

    if (block.mesh instanceof Mesh) {
      const isSpawnPoint = block.mesh.userData.isSpawnPoint === true;
      const isGenerator = block.mesh.userData.isGenerator === true;
      
      // Debug log for generators
      if (isGenerator && block.generatorConfig) {
        console.log(`[EditorApp] Serializing generator ${block.id}:`, block.generatorConfig);
      }
      
      return {
        type: "block",
        transform: this.toSerializedTransform(block.mesh, "world"),
        id: block.id, // Include ID for generator referencing
        ...(block.name && { name: block.name }),
        ...(isSpawnPoint && { isSpawnPoint: true }),
        ...(isGenerator && { isGenerator: true }),
        ...(isGenerator && block.generatorConfig && { generatorConfig: block.generatorConfig }),
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
        // Always serialize component instances, even when nested (local space)
        usedComponents.add(componentId);
        return {
          type: "component",
          componentId,
          transform: this.toSerializedTransform(object, space),
        };
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
      const isSpawnPoint = object.userData.isSpawnPoint === true;
      const isGenerator = object.userData.isGenerator === true;
      const generatorConfig = object.userData.generatorConfig;
      const preservedId = (object as Object3D & { userData: { editorId?: string } }).userData?.editorId as string | undefined;
      
      return {
        type: "block",
        transform: this.toSerializedTransform(object, space),
        ...(preservedId && { id: preservedId }),
        ...(isSpawnPoint && { isSpawnPoint: true }),
        ...(isGenerator && { isGenerator: true }),
        ...(isGenerator && generatorConfig && { generatorConfig }),
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
    let block: EditorBlock | null = null;
    
    switch (node.type) {
      case "block": {
        const transform = this.transformFromSerialized(node.transform);
        if (node.isSpawnPoint) {
          block = this.blocks.createSpawnPoint({
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale,
          });
        } else if (node.isGenerator && node.generatorConfig) {
          // Restore generator by creating a block and marking it as generator
          block = this.createBlock({
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale,
          });
          
          if (block) {
            // Mark as generator
            block.mesh.userData.isGenerator = true;
            block.mesh.userData.generatorType = node.generatorConfig.type;
            block.generatorConfig = node.generatorConfig;
            block.mesh.userData.generatorConfig = node.generatorConfig;
            
            // Set generator appearance
            const material = (block.mesh as Mesh).material as MeshStandardMaterial;
            if (node.generatorConfig.type === "randomStatic") {
              material.color.set(0xff00ff); // Magenta for random static
              material.emissive = new Color(0xff00ff);
              material.emissiveIntensity = 0.2;
            } else if (node.generatorConfig.type === "moving") {
              material.color.set(0x00ddff); // Cyan for moving
              material.emissive = new Color(0x00ddff);
              material.emissiveIntensity = 0.2;
            }
          }
        } else {
          block = this.createBlock({
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale,
          });
        }
        break;
      }
      case "component": {
        if (!node.componentId) {
          return null;
        }
        const definition = componentMap.get(node.componentId);
        if (!definition) {
          // Fallback: create placeholder group so paste does not fail
          const placeholder = new Group();
          this.applySerializedTransform(placeholder, node.transform);
          (placeholder as Object3D & { userData: { componentId?: string; componentRole?: string } }).userData.componentId = node.componentId;
          (placeholder as Object3D & { userData: { componentId?: string; componentRole?: string } }).userData.componentRole = "instance";
          block = this.blocks.registerGroup(placeholder);
        } else {
          const transform = this.transformFromSerialized(node.transform);
          block = this.components.instantiateComponent(definition, transform);
        }
        break;
      }
      case "group": {
        const group = this.buildGroupFromNode(node, componentMap);
        if (group) {
          block = this.blocks.registerGroup(group);
        }
        break;
      }
    }
    
    // Assign custom name if present
    if (block && node.name) {
      block.name = node.name;
    }
    
    return block;
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
        const mesh = child.isSpawnPoint 
          ? createSpawnPointMesh() 
          : this.blocks.createPrimitiveBlockMesh();
        this.applySerializedTransform(mesh, child.transform);
        // Preserve original block id for stable ungroup/regroup and subsequent copy/paste
        if (child.id) {
          (mesh as Object3D & { userData: { editorId?: string } }).userData.editorId = child.id;
        }
        return mesh;
      }
      case "group": {
        return this.buildGroupFromNode(child, componentMap);
      }
      case "component": {
        if (!child.componentId) {
          return null;
        }
        const definition = componentMap.get(child.componentId);
        // Build a component instance as a plain Object3D hierarchy (no block registration)
        const group = new Group();
        this.applySerializedTransform(group, child.transform);
        if (definition) {
          definition.members.forEach((member) => {
            const mesh = this.blocks.createPrimitiveBlockMesh();
            mesh.position.set(member.position.x, member.position.y, member.position.z);
            mesh.rotation.set(member.rotation.x, member.rotation.y, member.rotation.z);
            mesh.scale.set(member.scale.x, member.scale.y, member.scale.z);
            group.add(mesh);
          });
          (group as Object3D & { userData: Record<string, unknown> }).userData.componentId = definition.id;
          (group as Object3D & { userData: Record<string, unknown> }).userData.componentRole = "instance";
        } else {
          // Fallback: keep empty group but tag with componentId to preserve identity
          (group as Object3D & { userData: Record<string, unknown> }).userData.componentId = child.componentId;
          (group as Object3D & { userData: Record<string, unknown> }).userData.componentRole = "instance";
        }
        return group;
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
      // Preserve all optional properties
      ...(node.id && { id: node.id }),
      ...(node.name && { name: node.name }),
      ...(node.isSpawnPoint && { isSpawnPoint: node.isSpawnPoint }),
      ...(node.isGenerator && { isGenerator: node.isGenerator }),
      ...(node.generatorConfig && { generatorConfig: JSON.parse(JSON.stringify(node.generatorConfig)) }),
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
      // If event was already handled (e.g., by transform mode), don't start drag
      if (event.defaultPrevented) {
        return;
      }
      
      this.leftButtonActive = true;
      this.controls.enabled = false;
      // Prevent OrbitControls from attempting pointer capture
      event.preventDefault();
      event.stopImmediatePropagation();

      this.dragAxisConstraint = null;
      this.resetDragPointerAccumulator();
      this.lastPointerEvent = { clientX: event.clientX, clientY: event.clientY };

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
          this.dragTranslationDelta.set(0, 0, 0);
          this.setDraggingCursor(true);
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
    this.lastPointerEvent = { clientX: event.clientX, clientY: event.clientY };

    if (this.dragTargets.length === 0) {
      return;
    }

    const axis = this.dragAxisConstraint;
    if (axis === "y") {
      this.dragPointerAccumulator.x += event.movementX;
      this.dragPointerAccumulator.y += event.movementY;

      this.camera.getWorldQuaternion(this.dragCameraQuaternion);
      this.dragCameraRight.set(1, 0, 0).applyQuaternion(this.dragCameraQuaternion);
      this.dragCameraUp.set(0, 1, 0).applyQuaternion(this.dragCameraQuaternion);
      this.dragPointerWorld
        .copy(this.dragCameraRight)
        .multiplyScalar(this.dragPointerAccumulator.x)
        .addScaledVector(this.dragCameraUp, -this.dragPointerAccumulator.y);

      const amount = this.dragPointerWorld.dot(DRAG_AXIS_VECTORS.y) * DRAG_VERTICAL_SENSITIVITY;
      this.dragTranslationDelta.copy(DRAG_AXIS_VECTORS.y).multiplyScalar(amount);
    } else {
      const current = this.intersectGround(event.clientX, event.clientY);
      if (!current) {
        return;
      }
      if (!this.dragStartPoint) {
        this.dragStartPoint = current;
      }

      this.dragWorkingDelta
        .copy(current)
        .sub(this.dragStartPoint)
        .setY(0);

      if (axis === "x") {
        this.dragWorkingDelta.set(this.dragWorkingDelta.x, 0, 0);
      } else if (axis === "z") {
        this.dragWorkingDelta.set(0, 0, this.dragWorkingDelta.z);
      }

      this.dragTranslationDelta.copy(this.dragWorkingDelta);
    }

    const updates = this.dragTargets.map(({ id, origin }) => {
      const position = origin.position.clone().add(this.dragTranslationDelta);
      return {
        id,
        transform: {
          position,
          rotation: origin.rotation.clone(),
          scale: origin.scale.clone(),
        },
      };
    });

    this.applyTransformsForIds(updates);
  };

  private handlePointerUpCapture = (event: PointerEvent): void => {
    const isCancel = event.type === "pointercancel";
    if ((event.button === 0 || isCancel) && this.leftButtonActive) {
      this.leftButtonActive = false;
      this.controls.enabled = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      // Finish any active drag with commit
      this.finalizePointerRelease(event, !isCancel);
      this.setDraggingCursor(false);
    }
  };

  private handleWindowPointerUpCapture = (event: PointerEvent): void => {
    const isCancel = event.type === "pointercancel";
    if ((event.button === 0 || isCancel) && this.leftButtonActive) {
      this.leftButtonActive = false;
      this.controls.enabled = true;
      // Cancel drag if pointer released outside the canvas (no commit)
      this.finalizePointerRelease(event, false);
      this.setDraggingCursor(false);
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
