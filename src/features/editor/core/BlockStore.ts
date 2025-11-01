import { Group, LineBasicMaterial, LineSegments, Mesh, Object3D, Scene, type Euler, type Vector3 } from "three";
import type { EditorBlock } from "@/features/editor/types";
import { createPrimitiveCubeMesh, createSpawnPointMesh } from "./blockFactory";

export type CreateBlockOptions = {
  position: Vector3;
  rotation?: Euler;
  scale?: Vector3;
  id?: string;
};

const BLOCK_ID_PATTERN = /^(?:block|group|spawn)-(\d+)$/;

export class BlockStore {
  private readonly blocks = new Map<string, EditorBlock>();
  private idSeed = 0;
  
  /**
   * Set a custom display name for a block
   * The ID remains unchanged, only the display name is updated
   */
  public renameBlock(id: string, newName: string): boolean {
    const block = this.blocks.get(id);
    if (!block) return false;
    
    block.name = newName;
    return true;
  }

  constructor(private readonly scene: Scene) {}

  public createBlock({ position, rotation, scale, id }: CreateBlockOptions): EditorBlock {
    const mesh = this.createPrimitiveBlockMesh();
    mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    if (scale) mesh.scale.copy(scale);
    return this.registerMeshAsBlock(mesh, { id, addToScene: true });
  }

  public createPrimitiveBlockMesh(): Mesh {
    const mesh = createPrimitiveCubeMesh();
    return mesh;
  }

  public createSpawnPoint({ position, rotation, scale, id }: CreateBlockOptions): EditorBlock {
    const mesh = createSpawnPointMesh();
    mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    if (scale) mesh.scale.copy(scale);
    return this.registerMeshAsBlock(mesh, { id: id ?? this.nextId("spawn"), addToScene: true });
  }

  public registerGroup(group: Group, id?: string, options: { addToScene?: boolean } = {}): EditorBlock {
    const { addToScene = true } = options;
    return this.registerMeshAsBlock(group, { id: id ?? this.nextId("group"), addToScene });
  }

  public registerExistingObject(object: Object3D, options: { id?: string; outline?: LineSegments } = {}): EditorBlock {
    const { id, outline } = options;
    return this.registerMeshAsBlock(object, { id, outline, addToScene: false });
  }

  public takeBlock(id: string): EditorBlock | null {
    const block = this.blocks.get(id);
    if (!block) {
      return null;
    }
    this.blocks.delete(id);
    return block;
  }

  public removeBlock(id: string): boolean {
    const block = this.blocks.get(id);
    if (!block) {
      return false;
    }

    this.scene.remove(block.mesh);
    this.disposeObject(block.mesh);
    if (block.outline) {
      this.disposeLineSegments(block.outline);
    }
    this.blocks.delete(id);
    return true;
  }

  public getBlock(id: string): EditorBlock | undefined {
    return this.blocks.get(id);
  }

  public hasBlock(id: string): boolean {
    return this.blocks.has(id);
  }

  public getAllBlocks(): EditorBlock[] {
    return Array.from(this.blocks.values());
  }

  public clearAll(): void {
    const ids = Array.from(this.blocks.keys());
    for (const id of ids) {
      this.removeBlock(id);
    }
  }

  public findBlockByMesh(mesh: Object3D): EditorBlock | null {
    for (const block of this.blocks.values()) {
      if (this.isDescendant(mesh, block.mesh)) {
        return block;
      }
    }
    return null;
  }

  public getMeshes(): Object3D[] {
    return Array.from(this.blocks.values()).map((block) => block.mesh);
  }

  public setOutlineColor(object: Object3D, color: number): void {
    object.traverse((child) => {
      if (child instanceof LineSegments) {
        // Ensure the LineSegments is visible
        child.visible = true;
        
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => {
            if (entry instanceof LineBasicMaterial) {
              entry.color.setHex(color);
              entry.visible = true;
            }
          });
        } else if (material instanceof LineBasicMaterial) {
          material.color.setHex(color);
          material.visible = true;
        }
      }
    });
  }

  private registerMeshAsBlock(
    mesh: Object3D,
    {
      id,
      outline,
      addToScene,
    }: {
      id?: string;
      outline?: LineSegments;
      addToScene: boolean;
    },
  ): EditorBlock {
    const assignedId = id ?? this.nextId(mesh instanceof Group ? "group" : "block");
    this.syncIdSeed(assignedId);

    const blockOutline = outline ?? this.findOutline(mesh);
    const block: EditorBlock = { id: assignedId, mesh, outline: blockOutline };
    this.blocks.set(assignedId, block);

    if (addToScene) {
      this.scene.add(mesh);
    }

    return block;
  }

  private nextId(prefix: "block" | "group" | "spawn" = "block"): string {
    this.idSeed += 1;
    return `${prefix}-${this.idSeed}`;
  }

  private syncIdSeed(id: string): void {
    const match = BLOCK_ID_PATTERN.exec(id);
    if (!match) {
      return;
    }
    const value = Number.parseInt(match[1] ?? "0", 10);
    if (!Number.isNaN(value) && value > this.idSeed) {
      this.idSeed = value;
    }
  }

  private findOutline(mesh: Object3D): LineSegments | undefined {
    let found: LineSegments | undefined;
    mesh.traverse((child) => {
      if (!found && child instanceof LineSegments) {
        found = child;
      }
    });
    return found;
  }

  private disposeObject(object: Object3D): void {
    object.traverse((child) => {
      const geometry = (child as { geometry?: import("three").BufferGeometry }).geometry;
      if (geometry) {
        geometry.dispose();
      }
      const material = (child as { material?: import("three").Material | import("three").Material[] }).material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else if (material) {
        material.dispose();
      }
    });
  }

  private disposeLineSegments(line: LineSegments): void {
    line.geometry.dispose();
    const material = line.material as import("three").Material | import("three").Material[];
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material.dispose();
    }
  }

  private isDescendant(node: Object3D, root: Object3D): boolean {
    let current: Object3D | null = node;
    while (current) {
      if (current === root) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
}
