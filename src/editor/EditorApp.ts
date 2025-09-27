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
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type EditorBlock = {
  id: string;
  mesh: Mesh;
};

export type SelectionListener = (block: EditorBlock | null) => void;

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

    this.setupScene();
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
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
    const renderLoop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.animationFrame = requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }

  public dispose(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }
    window.removeEventListener("resize", this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
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

    const material = new MeshStandardMaterial({
      color: new Color(0x5b8cff),
      roughness: 0.35,
      metalness: 0.1,
    });
    const geometry = new BoxGeometry(1, 1, 1);
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(point).setY(0.5);

    const id = `block-${blockId += 1}`;
    const block: EditorBlock = { id, mesh };
    this.scene.add(mesh);
    this.blocks.set(id, block);
    this.setSelection(block);
    return block;
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

  public getSelectionTransform(): { scale: Vector3; rotation: Euler } | null {
    if (!this.selection) {
      return null;
    }
    return {
      scale: this.selection.mesh.scale.clone(),
      rotation: this.selection.mesh.rotation.clone(),
    };
  }
}
