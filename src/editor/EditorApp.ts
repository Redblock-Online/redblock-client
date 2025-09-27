import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  BoxHelper,
  EdgesGeometry,
  Color,
  DirectionalLight,
  Euler,
  Matrix4,
  Quaternion,
  GridHelper,
  Mesh,
  LineSegments,
  LineBasicMaterial,
  MeshStandardMaterial,
  Group,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  MOUSE,
} from "three";
import { addComponent, type SavedComponent, type ComponentMemberTransform } from "./componentsStore";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type EditorBlock = {
  id: string;
  mesh: Object3D; // Mesh or Group
  outline?: LineSegments;
};

export type EditorSelection = EditorBlock | EditorBlock[] | null;
export type SelectionListener = (selection: EditorSelection) => void;

export type SelectionTransform = {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
};

let blockId = 0;

type RuntimeComponent = {
  id: string; // matches SavedComponent.id
  label: string;
  groupId?: string; // master group id if present in scene
  editing: boolean;
  editingBasis?: Matrix4; // world matrix of group when editing started
  masterChildIds: string[]; // when editing, ids of child blocks
  instanceGroupIds: string[]; // group ids of instances in scene
};

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
  private readonly blocks = new Map<string, EditorBlock>();
  private readonly selectionListeners = new Set<SelectionListener>();
  private selection: EditorBlock | null = null; // single selection convenience
  private selectedIds: Set<string> = new Set();
  private highlight?: BoxHelper;
  private animationFrame?: number;
  private leftButtonActive = false;
  private lastFrameTime = 0;
  private readonly movementState = {
    forward: false,
    back: false,
    left: false,
    right: false,
  };
  private readonly movementForward = new Vector3();
  private readonly movementRight = new Vector3();
  private readonly movementOffset = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);
  private readonly movementSpeed = 6;

  // Runtime components registry (synced with localStorage entries on demand)
  private readonly components = new Map<string, RuntimeComponent>();
  private readonly groupIdToComponentId = new Map<string, string>();

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

    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("pointerdown", this.handlePointerDownCapture, true);
    canvas.addEventListener("pointerup", this.handlePointerUpCapture, true);
    canvas.addEventListener("pointercancel", this.handleWindowPointerUpCapture, true);
    window.addEventListener("pointerup", this.handleWindowPointerUpCapture, true);
    window.addEventListener("pointercancel", this.handleWindowPointerUpCapture, true);
    window.addEventListener("keydown", this.handleMovementKeyChange, true);
    window.addEventListener("keyup", this.handleMovementKeyChange, true);
    // Redundant listeners to improve reliability across browsers/focus
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

  private setupScene(): void {
    const ambient = new AmbientLight(0xffffff, 3.0);
    const dir = new DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 12, 6);

    this.groundPlane.receiveShadow = true;
    this.groundPlane.position.set(0, -0.05, 0);
    this.groundPlane.visible = true;

    const grid = new GridHelper(200, 40, 0x000000, 0x505050);
    // Respect depth so grid does not show through solid meshes
    const gridMat = grid.material as unknown as import('three').LineBasicMaterial;
    gridMat.depthTest = true;
    gridMat.transparent = false;
    gridMat.opacity = 1;
    grid.renderOrder = 1;

    const axes = new AxesHelper(8);
    const axesMat = axes.material as unknown as import('three').LineBasicMaterial;
    axesMat.depthTest = false;
    axes.renderOrder = 2;

    this.scene.add(ambient, dir, grid, axes, );
  }

  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

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

  private handlePointerDownCapture = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.leftButtonActive = true;
      this.controls.enabled = false;
      return;
    }

    if (event.button === 2) {
      this.controls.enabled = true;
    }
  };

  private handlePointerUpCapture = (event: PointerEvent): void => {
    if (event.button === 0 && this.leftButtonActive) {
      this.leftButtonActive = false;
      this.controls.enabled = true;
    }
  };

  private handleWindowPointerUpCapture = (event: PointerEvent): void => {
    if (event.button === 0 && this.leftButtonActive) {
      this.leftButtonActive = false;
      this.controls.enabled = true;
    }
  };

  private handleMovementKeyChange = (event: KeyboardEvent): void => {
    // Ignore typing in inputs/controls
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    const isKeyDown = event.type === "keydown";
    let handled = false;
    const key = event.key;
    switch (key) {
      case "w":
      case "W":
      case "ArrowUp":
        this.movementState.forward = isKeyDown;
        handled = true;
        break;
      case "s":
      case "S":
      case "ArrowDown":
        this.movementState.back = isKeyDown;
        handled = true;
        break;
      case "a":
      case "A":
      case "ArrowLeft":
        this.movementState.left = isKeyDown;
        handled = true;
        break;
      case "d":
      case "D":
      case "ArrowRight":
        this.movementState.right = isKeyDown;
        handled = true;
        break;
      default:
        break;
    }

    if (handled) {
      event.preventDefault();
    }
  };

  public clearMovementState(): void {
    this.movementState.forward = false;
    this.movementState.back = false;
    this.movementState.left = false;
    this.movementState.right = false;
  }

  private updateCameraMovement(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    const { forward, back, left, right } = this.movementState;
    if (!forward && !back && !left && !right) {
      return;
    }

    this.camera.getWorldDirection(this.movementForward);
    this.movementForward.y = 0;
    if (this.movementForward.lengthSq() === 0) {
      return;
    }
    this.movementForward.normalize();

    this.movementRight.crossVectors(this.movementForward, this.worldUp);
    this.movementRight.y = 0;
    if (this.movementRight.lengthSq() > 0) {
      this.movementRight.normalize();
    }

    this.movementOffset.set(0, 0, 0);
    if (forward) this.movementOffset.add(this.movementForward);
    if (back) this.movementOffset.sub(this.movementForward);
    if (right) this.movementOffset.add(this.movementRight);
    if (left) this.movementOffset.sub(this.movementRight);

    if (this.movementOffset.lengthSq() === 0) {
      return;
    }
    this.movementOffset.normalize().multiplyScalar(this.movementSpeed * deltaSeconds);

    this.camera.position.add(this.movementOffset);
    this.controls.target.add(this.movementOffset);
  }

  public addSelectionListener(listener: SelectionListener): () => void {
    this.selectionListeners.add(listener);
    listener(this.computeSelectionPayload());
    return () => {
      this.selectionListeners.delete(listener);
    };
  }

  private emitSelection(): void {
    const payload = this.computeSelectionPayload();
    for (const listener of this.selectionListeners) {
      listener(payload);
    }
  }

  private computeSelectionPayload(): EditorSelection {
    if (this.selectedIds.size === 0) return null;
    if (this.selectedIds.size === 1) return this.selection;
    const out: EditorBlock[] = [];
    for (const id of this.selectedIds) {
      const b = this.blocks.get(id);
      if (b) out.push(b);
    }
    return out;
  }

  public placeBlockAt(clientX: number, clientY: number): EditorBlock | null {
    const point = this.intersectGround(clientX, clientY);
    if (!point) {
      this.clearMovementState();
      return null;
    }

    const block = this.createBlock({ position: point.setY(0.5) });
    this.clearMovementState();
    this.setSelectionSingle(block);
    return block;
  }

  public createBlock({
    position,
    rotation,
    scale,
    id,
  }: {
    position: Vector3;
    rotation?: Euler;
    scale?: Vector3;
    id?: string;
  }): EditorBlock {
    const material = new MeshStandardMaterial({
      color: new Color(0xffffff),
      roughness: 1,
      metalness: 0,
    });
    const geometry = new BoxGeometry(1, 1, 1);
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    if (scale) mesh.scale.copy(scale);

    // Add outline using EdgesGeometry so it follows transforms
    const edges = new EdgesGeometry(geometry);
    const edgeMaterial = new LineBasicMaterial({ color: 0x000000 }); // strong black outline
    edgeMaterial.depthTest = true; // draw over faces for clarity
    const outline = new LineSegments(edges, edgeMaterial);
    outline.renderOrder = 1;
    mesh.add(outline);

    const newId = id ?? `block-${(blockId += 1)}`;
    // Keep blockId monotonic if an explicit id is provided
    if (id) {
      const m = /^block-(\d+)$/.exec(id);
      if (m) {
        const n = Number(m[1]);
        if (!Number.isNaN(n) && n > blockId) blockId = n;
      }
    }

    const block: EditorBlock = { id: newId, mesh, outline };
    this.scene.add(mesh);
    this.blocks.set(newId, block);
    return block;
  }

  public removeBlock(id: string): boolean {
    const block = this.blocks.get(id);
    if (!block) return false;
    if (this.selectedIds.has(id)) {
      const next = new Set(this.selectedIds);
      next.delete(id);
      this.applySelection(next);
    }
    this.scene.remove(block.mesh);
    // Dispose resources – traverse to handle Groups
    const disposeObject = (obj: Object3D) => {
      const geometry = (obj as { geometry?: import("three").BufferGeometry }).geometry;
      if (geometry) geometry.dispose();
      const material = (obj as { material?: import("three").Material | import("three").Material[] }).material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else if (material) {
        material.dispose();
      }
    };
    block.mesh.traverse((child) => disposeObject(child));
    // Dispose outline resources if we manage them separately
    if (block.outline) {
      block.outline.geometry.dispose();
      const mat = block.outline.material as import("three").Material | import("three").Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    this.blocks.delete(id);
    return true;
  }

  public getBlock(id: string): EditorBlock | undefined {
    return this.blocks.get(id);
  }

  public applyTransform(id: string, snap: SelectionTransform): boolean {
    const block = this.blocks.get(id);
    if (!block) return false;
    block.mesh.position.copy(snap.position);
    block.mesh.rotation.copy(snap.rotation);
    block.mesh.scale.copy(snap.scale);
    if (this.selection?.id === id && this.highlight) {
      this.highlight.update();
    }
    return true;
  }

  private intersectGround(clientX: number, clientY: number): Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new Vector3(0, 1, 0);
    const planeNormal = plane.clone();
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

  public pickBlock(clientX: number, clientY: number, additive: boolean = false): EditorBlock | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(
      Array.from(this.blocks.values()).map((block) => block.mesh),
      true,
    );
    // If editing a component, only allow picking inside the master children set
    const editing = this.getEditingComponentId();
    if (intersects.length === 0) {
      if (!additive) this.clearSelection();
      return null;
    }
    let hitBlock: EditorBlock | null = null;
    for (const hit of intersects) {
      const mesh = hit.object;
      const block = this.findBlockByMesh(mesh as Mesh);
      if (!block) continue;
      if (editing) {
        const rt = this.components.get(editing);
        if (rt && rt.masterChildIds.length > 0) {
          if (!rt.masterChildIds.includes(block.id)) {
            continue; // skip hits outside the edited component
          }
        }
      }
      hitBlock = block;
      break;
    }

    if (hitBlock) {
      if (additive) this.setSelectionToggle(hitBlock);
      else this.setSelectionSingle(hitBlock);
    } else if (!additive) {
      this.clearSelection();
    }
    return hitBlock;
  }

  private findBlockByMesh(mesh: Mesh): EditorBlock | null {
    const isDescendant = (node: Object3D, root: Object3D): boolean => {
      let curr: Object3D | null = node;
      while (curr) {
        if (curr === root) return true;
        curr = curr.parent;
      }
      return false;
    };
    for (const block of this.blocks.values()) {
      if (isDescendant(mesh, block.mesh)) {
        return block;
      }
    }
    return null;
  }

  private setSelectionSingle(block: EditorBlock | null): void {
    const next = new Set<string>();
    if (block) next.add(block.id);
    this.applySelection(next);
  }

  private setSelectionToggle(block: EditorBlock): void {
    const next = new Set(this.selectedIds);
    if (next.has(block.id)) next.delete(block.id);
    else next.add(block.id);
    this.applySelection(next);
  }

  private applySelection(nextIds: Set<string>): void {
    // Reset outline color for deselected blocks
    for (const id of this.selectedIds) {
      if (!nextIds.has(id)) {
        const b = this.blocks.get(id);
        if (b?.outline) {
          const prevMat = b.outline.material as LineBasicMaterial | LineBasicMaterial[];
          if (prevMat instanceof LineBasicMaterial) prevMat.color.set(0x000000);
        }
      }
    }

    // Apply outline color to newly selected blocks
    for (const id of nextIds) {
      if (!this.selectedIds.has(id)) {
        const b = this.blocks.get(id);
        if (b?.outline) {
          const mat = b.outline.material as LineBasicMaterial | LineBasicMaterial[];
          if (mat instanceof LineBasicMaterial) mat.color.set(0xff0000);
        }
      }
    }

    this.selectedIds = nextIds;

    // Update single-selection convenience and highlight
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.geometry.dispose();
      this.highlight = undefined;
    }
    if (this.selectedIds.size === 1) {
      const id = Array.from(this.selectedIds)[0]!
      const b = this.blocks.get(id) ?? null;
      this.selection = b;
      if (b) {
        this.highlight = new BoxHelper(b.mesh, 0xff0000);
        this.scene.add(this.highlight);
      }
    } else {
      this.selection = null;
    }
    this.emitSelection();
  }

  public getSelection(): EditorBlock | null {
    return this.selection;
  }

  public clearSelection(): void {
    this.applySelection(new Set());
  }

  public getSelectionArray(): EditorBlock[] {
    const out: EditorBlock[] = [];
    for (const id of this.selectedIds) {
      const b = this.blocks.get(id);
      if (b) out.push(b);
    }
    return out;
  }

  public updateSelectedBlockPosition(position: Vector3): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.position.copy(position);
    if (this.highlight) {
      this.highlight.update();
    }
    this.propagateComponentEditIfNeeded();
  }

  public updateSelectedBlockScale(scale: Vector3): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.scale.copy(scale);
    if (this.highlight) {
      this.highlight.update();
    }
    this.propagateComponentEditIfNeeded();
  }

  public updateSelectedBlockRotation(rotation: Euler): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.rotation.copy(rotation);
    if (this.highlight) {
      this.highlight.update();
    }
    this.propagateComponentEditIfNeeded();
  }

  public getSelectionTransform(): SelectionTransform | null {
    if (!this.selection) {
      return null;
    }
    return {
      position: this.selection.mesh.position.clone(),
      scale: this.selection.mesh.scale.clone(),
      rotation: this.selection.mesh.rotation.clone(),
    };
  }

  public getSelectedGroupMembersLocalTransforms(): ComponentMemberTransform[] | null {
    if (!this.selection) return null;
    if (!(this.selection.mesh instanceof Group)) return null;
    const members: ComponentMemberTransform[] = [];
    for (const child of this.selection.mesh.children) {
      const mesh = child as Object3D & { position: Vector3; rotation: Euler; scale: Vector3 };
      members.push({
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
        scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
      });
    }
    return members;
  }

  public placeComponentAt(clientX: number, clientY: number, component: SavedComponent): EditorBlock | null {
    const point = this.intersectGround(clientX, clientY);
    if (!point) {
      this.clearMovementState();
      return null;
    }
    const group = new Group();
    group.position.copy(point.setY(0.5));

    // Build children meshes from component members
    component.members.forEach((m, index) => {
      const mesh = this.createCubeMeshWithOutline();
      mesh.position.set(m.position.x, m.position.y, m.position.z);
      mesh.rotation.set(m.rotation.x, m.rotation.y, m.rotation.z);
      mesh.scale.set(m.scale.x, m.scale.y, m.scale.z);
      // annotate userData for reverse mapping
      (mesh as Object3D).userData.componentMemberIndex = index;
      group.add(mesh);
    });

    this.scene.add(group);
    const newId = `group-${(blockId += 1)}`;
    const block: EditorBlock = { id: newId, mesh: group };
    this.blocks.set(newId, block);
    group.userData.componentId = component.id;

    // Register instance runtime
    let rt = this.components.get(component.id);
    if (!rt) {
      rt = { id: component.id, label: component.label, editing: false, masterChildIds: [], instanceGroupIds: [] };
      this.components.set(component.id, rt);
    }
    rt.instanceGroupIds.push(newId);
    this.setSelectionSingle(block);
    return block;
  }

  private createCubeMeshWithOutline(): Mesh {
    const material = new MeshStandardMaterial({ color: new Color(0xffffff), roughness: 1, metalness: 0 });
    const geometry = new BoxGeometry(1, 1, 1);
    const mesh = new Mesh(geometry, material);
    const edges = new EdgesGeometry(geometry);
    const edgeMaterial = new LineBasicMaterial({ color: 0x000000 });
    edgeMaterial.depthTest = true;
    const outline = new LineSegments(edges, edgeMaterial);
    outline.renderOrder = 1;
    mesh.add(outline);
    return mesh;
  }

  // Components: create from currently selected group (master)
  public createComponentFromSelectedGroup(label: string, id: string): string | null {
    if (!this.selection || !(this.selection.mesh instanceof Group)) return null;
    const groupBlock = this.selection;
    // Link runtime
    const runtime: RuntimeComponent = {
      id,
      label,
      groupId: groupBlock.id,
      editing: false,
      masterChildIds: [],
      instanceGroupIds: [],
    };
    this.components.set(id, runtime);
    this.groupIdToComponentId.set(groupBlock.id, id);
    // Mark group
    groupBlock.mesh.userData.componentId = id;
    return id;
  }

  public getComponentIdForSelectedGroup(): string | null {
    if (!this.selection || !(this.selection.mesh instanceof Group)) return null;
    const cid = this.groupIdToComponentId.get(this.selection.id) || this.selection.mesh.userData?.componentId;
    return cid ?? null;
  }

  public isComponentEditing(id: string): boolean {
    const rt = this.components.get(id);
    return !!rt?.editing;
  }

  public getEditingComponentId(): string | null {
    for (const rt of this.components.values()) {
      if (rt.editing) return rt.id;
    }
    return null;
  }

  public startEditingComponent(id: string): boolean {
    const rt = this.components.get(id);
    if (!rt) return false;
    if (!this.selection || this.selection.id !== rt.groupId) return false;
    const group = this.selection.mesh as Group;
    // Save basis (world matrix) to derive local transforms while editing
    group.updateWorldMatrix(true, false);
    rt.editingBasis = group.matrixWorld.clone();
    // Ungroup to children blocks and capture their ids
    const restored = this.ungroupSelected();
    if (!restored) return false;
    rt.masterChildIds = restored.map((b) => b.id);
    rt.editing = true;
    return true;
  }

  public finishEditingComponent(id: string): boolean {
    const rt = this.components.get(id);
    if (!rt || !rt.editing) return false;
    // Regroup children back into master group with same groupId
    const groupId = rt.groupId;
    if (!groupId) return false;
    const ok = this.groupByIds(rt.masterChildIds, groupId);
    if (!ok) return false;
    rt.editing = false;
    rt.masterChildIds = [];
    rt.editingBasis = undefined;
    return true;
  }

  private propagateComponentEditIfNeeded(): void {
    // Find any component being edited
    const editing = Array.from(this.components.values()).find((c) => c.editing && c.editingBasis);
    if (!editing) return;
    const basisInv = new Matrix4().copy(editing.editingBasis!).invert();

    // Build local transforms array from master children (in order of masterChildIds)
    const locals: { position: Vector3; rotation: Euler; scale: Vector3 }[] = [];
    for (let i = 0; i < editing.masterChildIds.length; i++) {
      const id = editing.masterChildIds[i];
      const b = this.blocks.get(id);
      if (!b) continue;
      // child world matrix
      const child = b.mesh as Object3D;
      child.updateWorldMatrix(true, false);
      const localM = new Matrix4().multiplyMatrices(basisInv, child.matrixWorld);
      // decompose
      const p = new Vector3();
      const q = new Quaternion();
      const s = new Vector3();
      localM.decompose(p, q, s);
      const e = new Euler().setFromQuaternion(q);
      locals[i] = { position: p, rotation: e, scale: s };
    }

    // Persist to storage (update component definition)
    const saved: ComponentMemberTransform[] = locals.map((loc) => ({
      position: { x: loc.position.x, y: loc.position.y, z: loc.position.z },
      rotation: { x: loc.rotation.x, y: loc.rotation.y, z: loc.rotation.z },
      scale: { x: loc.scale.x, y: loc.scale.y, z: loc.scale.z },
    }));
    addComponent({ id: editing.id, label: editing.label, members: saved });

    // Apply to each instance group
    for (const gid of editing.instanceGroupIds) {
      const inst = this.blocks.get(gid);
      const g = inst?.mesh as Group | undefined;
      if (!g) continue;
      for (let i = 0; i < g.children.length && i < locals.length; i++) {
        const child = g.children[i] as Object3D & { position: Vector3; rotation: Euler; scale: Vector3 };
        const loc = locals[i];
        child.position.copy(loc.position);
        child.rotation.copy(loc.rotation);
        child.scale.copy(loc.scale);
      }
    }
  }

  public groupSelection(): EditorBlock | null {
    const ids = this.getSelectionArray().map((b) => b.id);
    return this.groupByIds(ids);
  }

  public groupByIds(ids: string[], groupId?: string): EditorBlock | null {
    const blocks: EditorBlock[] = [];
    for (const id of ids) {
      const b = this.blocks.get(id);
      if (b) blocks.push(b);
    }
    if (blocks.length < 2) return null;

    // Compute centroid of world positions
    const centroid = new Vector3();
    for (const b of blocks) {
      const p = new Vector3();
      b.mesh.getWorldPosition(p);
      centroid.add(p);
    }
    centroid.multiplyScalar(1 / blocks.length);

    const group = new Group();
    group.position.copy(centroid);
    this.scene.add(group);

    // Attach children to preserve world transforms
    for (const b of blocks) {
      // remember original id for potential ungroup / undo
      b.mesh.userData.editorId = b.id;
      // Ensure outline color reset on children; group selection will manage highlight
      if (b.outline) {
        const mat = b.outline.material as LineBasicMaterial | LineBasicMaterial[];
        if (mat instanceof LineBasicMaterial) mat.color.set(0x000000);
      }
      group.attach(b.mesh);
      this.blocks.delete(b.id);
    }

    const newId = groupId ?? `group-${(blockId += 1)}`;
    const groupBlock: EditorBlock = { id: newId, mesh: group };
    this.blocks.set(newId, groupBlock);

    // Select only the new group
    const next = new Set<string>();
    next.add(newId);
    this.applySelection(next);

    return groupBlock;
  }

  public ungroupSelected(): EditorBlock[] | null {
    if (!this.selection) return null;
    const block = this.selection;
    if (!(block.mesh instanceof Group)) return null;
    const group = block.mesh as Group;

    const children: Object3D[] = [...group.children];
    if (children.length === 0) return null;

    const restored: EditorBlock[] = [];

    for (const child of children) {
      // Detach child back to scene root, preserving world transform
      this.scene.attach(child);
      const editorId: string | undefined = (child as Object3D).userData?.editorId as string | undefined;
      const id = editorId ?? `block-${(blockId += 1)}`;
      // Attempt to find outline child (LineSegments) if any
      let outline: LineSegments | undefined = undefined;
      child.traverse((node) => {
        if (!outline && node instanceof LineSegments) outline = node as LineSegments;
      });
      const b: EditorBlock = { id, mesh: child, outline };
      this.blocks.set(id, b);
      restored.push(b);
    }

    // Remove group block from map/scene
    this.scene.remove(group);
    this.blocks.delete(block.id);

    // Select restored children as a multi-selection
    const next = new Set<string>(restored.map((b) => b.id));
    this.applySelection(next);
    return restored;
  }

  public setSelectionByIds(ids: string[]): void {
    const next = new Set<string>();
    for (const id of ids) if (this.blocks.has(id)) next.add(id);
    this.applySelection(next);
  }
}
