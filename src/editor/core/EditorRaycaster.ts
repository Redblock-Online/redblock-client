import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import type { EditorBlock } from "../types";
import type { BlockStore } from "./BlockStore";

export class EditorRaycaster {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly camera: PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly blocks: BlockStore;

  constructor(camera: PerspectiveCamera, canvas: HTMLCanvasElement, blocks: BlockStore) {
    this.camera = camera;
    this.canvas = canvas;
    this.blocks = blocks;
  }

  public pickBlock(clientX: number, clientY: number): EditorBlock | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const allBlocks = this.blocks.getAllBlocks();
    const meshes = allBlocks.map((block) => block.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length === 0) {
      return null;
    }

    let targetObject = intersects[0].object;
    while (targetObject.parent && targetObject.parent.type !== "Scene") {
      targetObject = targetObject.parent;
    }

    const hit = allBlocks.find((block) => block.mesh === targetObject);
    return hit || null;
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

  public getRaycaster(): Raycaster {
    return this.raycaster;
  }
}
