import { Group, LineBasicMaterial, Matrix4, Object3D, Quaternion, Scene, Vector3, LineSegments } from "three";
import type { BlockStore } from "./BlockStore";
import type { SelectionManager } from "./SelectionManager";
import type { EditorBlock } from "@/features/editor/types";

export class GroupManager {
  constructor(
    private readonly scene: Scene,
    private readonly blocks: BlockStore,
    private readonly selection: SelectionManager,
  ) {}

  public groupSelection(): EditorBlock | null {
    const ids = this.selection.getSelectionArray().map((block) => block.id);
    return this.groupByIds(ids);
  }

  public groupByIds(ids: string[], requestedId?: string): EditorBlock | null {
    if (ids.length < 2) {
      return null;
    }

    const uniqueIds = Array.from(new Set(ids));
    const taken: EditorBlock[] = [];

    for (const id of uniqueIds) {
      const block = this.blocks.takeBlock(id);
      if (block) {
        taken.push(block);
      }
    }

    if (taken.length < 2) {
      taken.forEach((block) => {
        this.blocks.registerExistingObject(block.mesh, { id: block.id, outline: block.outline });
      });
      return null;
    }

    const centroid = new Vector3();
    for (const block of taken) {
      const position = new Vector3();
      block.mesh.getWorldPosition(position);
      centroid.add(position);
    }
    centroid.multiplyScalar(1 / taken.length);

    const group = new Group();
    group.position.copy(centroid);
    this.scene.add(group);

    for (const block of taken) {
      block.mesh.userData.editorId = block.id;
      this.resetOutline(block);
      group.attach(block.mesh);
    }

    const groupBlock = this.blocks.registerGroup(group, requestedId, { addToScene: false });
    this.selection.setSelectionByIds([groupBlock.id]);
    return groupBlock;
  }

  public groupByIdsWithWorldMatrix(ids: string[], worldMatrix: Matrix4, requestedId?: string): EditorBlock | null {
    const blocks: EditorBlock[] = [];
    for (const id of ids) {
      const b = this.blocks.getBlock(id);
      if (b) blocks.push(b);
    }
    if (blocks.length < 1) return null;

    const group = new Group();
    // Decompose matrix to position/quaternion/scale and apply directly
    const p = new Vector3();
    const q = new Quaternion();
    const s = new Vector3();
    worldMatrix.decompose(p, q, s);
    group.position.copy(p);
    group.quaternion.copy(q);
    group.scale.copy(s);
    this.scene.add(group);

    for (const b of blocks) {
      // Reset outline on children; group selection manages highlight
      if (b.outline) {
        const mat = b.outline.material as LineBasicMaterial | LineBasicMaterial[];
        if (mat instanceof LineBasicMaterial) mat.color.set(0x000000);
      }
      // Preserve original child id for stable ungroup/regroup cycles
      (b.mesh as Object3D & { userData: { editorId?: string } }).userData.editorId = b.id;
      group.attach(b.mesh);
      this.blocks.takeBlock(b.id);
    }

    const newId = requestedId ?? `group-${Date.now()}`;
    const groupBlock: EditorBlock = { id: newId, mesh: group };
    this.blocks.registerExistingObject(group, { id: newId });

    const next = new Set<string>();
    next.add(newId);
    this.selection.setSelectionByIds(next);
    return this.blocks.getBlock(newId) ?? groupBlock;
  }

  public ungroupSelected(): EditorBlock[] | null {
    const selection = this.selection.getSelection();
    if (!selection || !(selection.mesh instanceof Group)) {
      return null;
    }

    const group = selection.mesh as Group;
    const children = [...group.children];
    if (children.length === 0) {
      return null;
    }

    // Ensure world matrices are current so attachments preserve positions
    group.updateWorldMatrix(true, true);
    const restored: EditorBlock[] = [];

    for (const child of children) {
      this.scene.attach(child);
      const existingId: string | undefined = (child as Object3D & { userData?: { editorId?: string } }).userData?.editorId;
      const outline = this.findOutline(child);
      const block = this.blocks.registerExistingObject(child, { id: existingId, outline });
      restored.push(block);
    }

    this.blocks.removeBlock(selection.id);
    this.selection.setSelectionByIds(restored.map((block) => block.id));
    return restored;
  }

  private resetOutline(block: EditorBlock): void {
    if (!block.outline) {
      return;
    }
    const material = block.outline.material as LineBasicMaterial | LineBasicMaterial[];
    if (material instanceof LineBasicMaterial) {
      material.color.set(0x000000);
    }
  }

  private findOutline(object: Object3D): LineSegments | undefined {
    let outline: LineSegments | undefined;
    object.traverse((node) => {
      if (!outline && node instanceof LineSegments) {
        outline = node;
      }
    });
    return outline;
  }
}
