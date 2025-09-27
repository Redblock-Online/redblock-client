import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  BoxHelper,
  Color,
  DirectionalLight,
  Euler,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  MOUSE,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type EditorBlock = {
  id: string;
  mesh: Mesh;
};

export type SelectionListener = (block: EditorBlock | null) => void;

export type SelectionTransform = {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
};

let blockId = 0;

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
    new MeshStandardMaterial({ color: new Color(0x181818) }),
  );
  private readonly blocks = new Map<string, EditorBlock>();
  private readonly selectionListeners = new Set<SelectionListener>();
  private selection: EditorBlock | null = null;
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = SRGBColorSpace;

    this.scene = new Scene();
    this.scene.background = new Color(0x0f0f0f);

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
    const ambient = new AmbientLight(0xffffff, 0.6);
    const dir = new DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 12, 6);

    this.groundPlane.receiveShadow = true;
    this.groundPlane.position.set(0, -0.05, 0);
    this.groundPlane.visible = false;

    const grid = new GridHelper(200, 40, 0x555555, 0x333333);
    const axes = new AxesHelper(5);

    this.scene.add(ambient, dir, grid, axes, this.groundPlane);
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
    if (event.repeat) {
      return;
    }

    const isKeyDown = event.type === "keydown";
    let handled = true;

    switch (event.key.toLowerCase()) {
      case "w":
        this.movementState.forward = isKeyDown;
        break;
      case "s":
        this.movementState.back = isKeyDown;
        break;
      case "a":
        this.movementState.left = isKeyDown;
        break;
      case "d":
        this.movementState.right = isKeyDown;
        break;
      default:
        handled = false;
        break;
    }

    if (handled) {
      event.preventDefault();
    }
  };

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
    listener(this.selection);
    return () => {
      this.selectionListeners.delete(listener);
    };
  }

  private emitSelection(): void {
    for (const listener of this.selectionListeners) {
      listener(this.selection);
    }
  }

  public placeBlockAt(clientX: number, clientY: number): EditorBlock | null {
    const point = this.intersectGround(clientX, clientY);
    if (!point) {
      return null;
    }

    const block = this.createBlock({ position: point.setY(0.5) });
    this.setSelection(block);
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
      color: new Color(0x5b8cff),
      roughness: 0.35,
      metalness: 0.1,
    });
    const geometry = new BoxGeometry(1, 1, 1);
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    if (scale) mesh.scale.copy(scale);

    const newId = id ?? `block-${(blockId += 1)}`;
    // Keep blockId monotonic if an explicit id is provided
    if (id) {
      const m = /^block-(\d+)$/.exec(id);
      if (m) {
        const n = Number(m[1]);
        if (!Number.isNaN(n) && n > blockId) blockId = n;
      }
    }

    const block: EditorBlock = { id: newId, mesh };
    this.scene.add(mesh);
    this.blocks.set(newId, block);
    return block;
  }

  public removeBlock(id: string): boolean {
    const block = this.blocks.get(id);
    if (!block) return false;
    if (this.selection?.id === id) {
      this.setSelection(null);
    }
    this.scene.remove(block.mesh);
    // Dispose resources
    if (block.mesh.geometry) block.mesh.geometry.dispose();
    // Material may be an array; handle both
    const mat: unknown = (block.mesh as Mesh).material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose?.());
    } else {
      (mat as MeshStandardMaterial)?.dispose?.();
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

  public pickBlock(clientX: number, clientY: number): EditorBlock | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(
      Array.from(this.blocks.values()).map((block) => block.mesh),
      false,
    );
    if (intersects.length === 0) {
      this.setSelection(null);
      return null;
    }
    const mesh = intersects[0].object;
    const block = this.findBlockByMesh(mesh as Mesh);
    if (block) {
      this.setSelection(block);
    }
    return block;
  }

  private findBlockByMesh(mesh: Mesh): EditorBlock | null {
    for (const block of this.blocks.values()) {
      if (block.mesh === mesh || block.mesh === mesh.parent) {
        return block;
      }
    }
    return null;
  }

  private setSelection(block: EditorBlock | null): void {
    this.selection = block;
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.geometry.dispose();
    }
    if (block) {
      this.highlight = new BoxHelper(block.mesh, 0xffff00);
      this.scene.add(this.highlight);
    } else {
      this.highlight = undefined;
    }
    this.emitSelection();
  }

  public getSelection(): EditorBlock | null {
    return this.selection;
  }

  public clearSelection(): void {
    this.setSelection(null);
  }

  public updateSelectedBlockPosition(position: Vector3): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.position.copy(position);
    if (this.highlight) {
      this.highlight.update();
    }
  }

  public updateSelectedBlockScale(scale: Vector3): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.scale.copy(scale);
    if (this.highlight) {
      this.highlight.update();
    }
  }

  public updateSelectedBlockRotation(rotation: Euler): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.rotation.copy(rotation);
    if (this.highlight) {
      this.highlight.update();
    }
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
}
