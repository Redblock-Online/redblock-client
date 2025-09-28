import { BoxHelper, LineBasicMaterial, Scene, Vector3, Euler } from "three";
import type { BlockStore } from "./BlockStore";
import type { EditorBlock, EditorSelection, SelectionListener, SelectionTransform } from "../types";

type BlockColorResolver = (block: EditorBlock, selected: boolean) => number;
type OutlineColorApplier = (block: EditorBlock, color: number) => void;

export class SelectionManager {
  private readonly listeners = new Set<SelectionListener>();
  private readonly selectedIds = new Set<string>();
  private selection: EditorBlock | null = null;
  private highlight?: BoxHelper;
  private readonly getBlockColor: BlockColorResolver;
  private readonly setOutlineColor: OutlineColorApplier;

  constructor(
    private readonly scene: Scene,
    private readonly blocks: BlockStore,
    options: { getBlockColor?: BlockColorResolver; setOutlineColor?: OutlineColorApplier } = {},
  ) {
    this.getBlockColor = options.getBlockColor ?? this.defaultGetBlockColor;
    this.setOutlineColor = options.setOutlineColor ?? this.defaultSetOutlineColor;
  }

  public addListener(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    listener(this.computeSelectionPayload());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSelection(): EditorBlock | null {
    return this.selection;
  }

  public getSelectionArray(): EditorBlock[] {
    const out: EditorBlock[] = [];
    for (const id of this.selectedIds) {
      const block = this.blocks.getBlock(id);
      if (block) {
        out.push(block);
      }
    }
    return out;
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

  public computeSelectionPayload(): EditorSelection {
    if (this.selectedIds.size === 0) {
      return null;
    }
    if (this.selectedIds.size === 1) {
      return this.selection;
    }
    const blocks: EditorBlock[] = [];
    for (const id of this.selectedIds) {
      const block = this.blocks.getBlock(id);
      if (block) {
        blocks.push(block);
      }
    }
    return blocks;
  }

  public setSelectionSingle(block: EditorBlock | null): void {
    const next = new Set<string>();
    if (block) {
      next.add(block.id);
    }
    this.applySelection(next);
  }

  public toggleSelection(block: EditorBlock): void {
    const next = new Set(this.selectedIds);
    if (next.has(block.id)) {
      next.delete(block.id);
    } else {
      next.add(block.id);
    }
    this.applySelection(next);
  }

  public setSelectionByIds(ids: Iterable<string>): void {
    const next = new Set<string>();
    for (const id of ids) {
      if (this.blocks.hasBlock(id)) {
        next.add(id);
      }
    }
    this.applySelection(next);
  }

  public clearSelection(): void {
    this.applySelection(new Set());
  }

  public removeId(id: string): void {
    if (!this.selectedIds.has(id)) {
      return;
    }
    const next = new Set(this.selectedIds);
    next.delete(id);
    this.applySelection(next);
  }

  public isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  public updatePosition(position: Vector3): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.position.copy(position);
    this.refreshHighlight();
  }

  public updateScale(scale: Vector3): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.scale.copy(scale);
    this.refreshHighlight();
  }

  public updateRotation(rotation: Euler): void {
    if (!this.selection) {
      return;
    }
    this.selection.mesh.rotation.copy(rotation);
    this.refreshHighlight();
  }

  public applyTransformsForIds(entries: Array<{ id: string; transform: SelectionTransform }>): void {
    let highlightNeedsUpdate = false;
    for (const entry of entries) {
      const block = this.blocks.getBlock(entry.id);
      if (!block) {
        continue;
      }
      block.mesh.position.copy(entry.transform.position);
      block.mesh.rotation.copy(entry.transform.rotation);
      block.mesh.scale.copy(entry.transform.scale);
      if (this.selection?.id === entry.id) {
        highlightNeedsUpdate = true;
      }
    }
    if (highlightNeedsUpdate && this.highlight) {
      this.highlight.update();
    }
  }

  private applySelection(nextIds: Set<string>): void {
    this.resetDeselectedOutlines(nextIds);
    this.applyOutlineToNewSelections(nextIds);

    this.selectedIds.clear();
    nextIds.forEach((id) => this.selectedIds.add(id));
    this.updateHighlightForSelection();

    this.emitSelection();
  }

  private resetDeselectedOutlines(nextIds: Set<string>): void {
    for (const id of this.selectedIds) {
      if (!nextIds.has(id)) {
        const block = this.blocks.getBlock(id);
        if (!block) {
          continue;
        }
        this.setOutlineColor(block, this.getBlockColor(block, false));
      }
    }
  }

  private applyOutlineToNewSelections(nextIds: Set<string>): void {
    for (const id of nextIds) {
      if (this.selectedIds.has(id)) {
        continue;
      }
      const block = this.blocks.getBlock(id);
      if (!block) {
        continue;
      }
      this.setOutlineColor(block, this.getBlockColor(block, true));
    }
  }

  private updateHighlightForSelection(): void {
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.geometry.dispose();
      this.highlight = undefined;
    }

    if (this.selectedIds.size === 1) {
      const [id] = this.selectedIds;
      const block = id ? this.blocks.getBlock(id) ?? null : null;
      this.selection = block;
      if (block) {
        const highlightColor = this.getBlockColor(block, true);
        this.highlight = new BoxHelper(block.mesh, highlightColor);
        this.scene.add(this.highlight);
      }
    } else {
      this.selection = null;
    }
  }

  private refreshHighlight(): void {
    if (this.highlight) {
      this.highlight.update();
    }
  }

  private emitSelection(): void {
    const payload = this.computeSelectionPayload();
    for (const listener of this.listeners) {
      listener(payload);
    }
  }

  private defaultGetBlockColor(block: EditorBlock, selected: boolean): number {
    return selected ? 0xff0000 : 0x000000;
  }

  private defaultSetOutlineColor(block: EditorBlock, color: number): void {
    if (block.outline) {
      const material = block.outline.material as LineBasicMaterial | LineBasicMaterial[];
      if (Array.isArray(material)) {
        material.forEach((entry) => {
          if (entry instanceof LineBasicMaterial) {
            entry.color.setHex(color);
          }
        });
      } else if (material instanceof LineBasicMaterial) {
        material.color.setHex(color);
      }
    }
    this.blocks.setOutlineColor(block.mesh, color);
  }
}
