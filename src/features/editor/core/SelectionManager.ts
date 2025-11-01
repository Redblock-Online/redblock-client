import { BoxHelper, Box3, BoxGeometry, LineBasicMaterial, LineSegments, Scene, Vector3, Euler, Group, Mesh, MeshBasicMaterial } from "three";
import type { BlockStore } from "./BlockStore";
import type { EditorBlock, EditorSelection, SelectionListener, SelectionTransform } from "@/features/editor/types";

type BlockColorResolver = (block: EditorBlock, selected: boolean) => number;
type OutlineColorApplier = (block: EditorBlock, color: number) => void;

export class SelectionManager {
  private readonly listeners = new Set<SelectionListener>();
  private readonly selectedIds = new Set<string>();
  private selection: EditorBlock | null = null;
  private highlight?: BoxHelper;
  private multiSelectHelpers: Array<BoxHelper & { userData?: { tempMesh?: Mesh } }> = [];
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

  /**
   * Updates the multi-select helpers by recalculating the bounding box
   * that encompasses all selected blocks. This is called when blocks are moved
   * during drag operations.
   */
  private updateMultiSelectHelpers(): void {
    if (this.selectedIds.size < 2) {
      return;
    }

    // Calculate the new bounding box that encompasses all selected blocks
    const boundingBox = new Box3();
    let hasBlocks = false;
    
    for (const id of this.selectedIds) {
      const block = this.blocks.getBlock(id);
      if (!block) {
        continue;
      }
      
      // Expand the bounding box to include this block
      const blockBox = new Box3().setFromObject(block.mesh);
      if (hasBlocks) {
        boundingBox.union(blockBox);
      } else {
        boundingBox.copy(blockBox);
        hasBlocks = true;
      }
    }
    
    if (!hasBlocks || boundingBox.isEmpty()) {
      return;
    }

    // Update the temporary mesh of each helper with the new bounding box
    for (const helper of this.multiSelectHelpers) {
      const tempMesh = helper.userData?.tempMesh as Mesh | undefined;
      if (!tempMesh) {
        continue;
      }

      // Calculate new center and size
      const center = boundingBox.getCenter(new Vector3());
      const size = boundingBox.getSize(new Vector3());
      
      // Update position of temporary mesh
      tempMesh.position.copy(center);
      
      // Update geometry if size changed significantly
      const currentSize = new Vector3();
      tempMesh.geometry.computeBoundingBox();
      if (tempMesh.geometry.boundingBox) {
        tempMesh.geometry.boundingBox.getSize(currentSize);
        // Only recreate geometry if size changed significantly (to avoid recreating every frame)
        const sizeDiff = Math.abs(currentSize.x - size.x) + Math.abs(currentSize.y - size.y) + Math.abs(currentSize.z - size.z);
        if (sizeDiff > 0.1) {
          tempMesh.geometry.dispose();
          tempMesh.geometry = new BoxGeometry(size.x, size.y, size.z);
        }
      }
      
      // Update the helper
      helper.update();
    }
  }

  public applyTransformsForIds(entries: Array<{ id: string; transform: SelectionTransform }>): void {
    let highlightNeedsUpdate = false;
    let multiSelectNeedsUpdate = false;
    
    for (const entry of entries) {
      const block = this.blocks.getBlock(entry.id);
      if (!block) {
        continue;
      }
      block.mesh.position.copy(entry.transform.position);
      block.mesh.rotation.copy(entry.transform.rotation);
      block.mesh.scale.copy(entry.transform.scale);
      
      // Check if this block is in the current selection
      if (this.selection?.id === entry.id) {
        highlightNeedsUpdate = true;
      }
      
      // Check if this block is part of multiple selection
      if (this.selectedIds.has(entry.id) && this.selectedIds.size > 1) {
        multiSelectNeedsUpdate = true;
      }
    }
    
    if (highlightNeedsUpdate && this.highlight) {
      this.highlight.update();
    }
    
    // Update multi-select helpers by recalculating the bounding box
    if (multiSelectNeedsUpdate && this.multiSelectHelpers.length > 0) {
      this.updateMultiSelectHelpers();
    }
  }

  private applySelection(nextIds: Set<string>): void {
    // Reset outlines of blocks that are being deselected
    this.resetDeselectedOutlines(nextIds);
    
    // Update selectedIds BEFORE applying outlines to ensure consistency
    this.selectedIds.clear();
    nextIds.forEach((id) => this.selectedIds.add(id));
    
    // Apply outline to ALL selected blocks - this must happen AFTER selectedIds is updated
    // to ensure all blocks get the outline correctly
    // IMPORTANT: Always apply outlines to ALL selected blocks, even if they were already selected,
    // to ensure that when multiple components are selected, ALL of them show their outlines correctly
    // This includes blocks that were already selected AND newly selected blocks
    this.applyOutlineToNewSelections(this.selectedIds);
    
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
    // DIRECT SOLUTION: When there are 2+ selected objects, apply pink lines to ALL
    const selectedCount = nextIds.size;
    const usePinkColor = selectedCount >= 2; // If there are 2 or more, use pink
    
    // Process ALL selected blocks
    for (const id of nextIds) {
      const block = this.blocks.getBlock(id);
      if (!block) {
        continue;
      }
      
      // Determine color: pink if multiple selections, otherwise use normal color
      let finalColor: number;
      
      if (usePinkColor) {
        // If there are multiple selections, use pink (0xff4dff) for normal blocks
        const role = (block.mesh.userData?.componentRole as string | undefined) ?? null;
        if (role === "master") {
          finalColor = 0x9b5cff; // Purple for master
        } else if (role === "instance") {
          finalColor = 0xff4dff; // Pink for instance
        } else {
          finalColor = 0xff4dff; // Pink for normal blocks when there are multiple selections
        }
      } else {
        // If there is only one, use normal color
        finalColor = this.getBlockColor(block, true);
      }
      
      // STEP 1: Update block.outline if it exists
      if (block.outline) {
        const material = block.outline.material as LineBasicMaterial | LineBasicMaterial[];
        if (Array.isArray(material)) {
          material.forEach((entry) => {
            if (entry instanceof LineBasicMaterial) {
              entry.color.setHex(finalColor);
            }
          });
        } else if (material instanceof LineBasicMaterial) {
          material.color.setHex(finalColor);
        }
      }
      
      // STEP 2: Traverse the entire mesh and update ALL LineSegments
      block.mesh.traverse((child) => {
        if (child instanceof LineSegments) {
          // Ensure the LineSegments is visible
          child.visible = true;
          
          const material = child.material;
          if (Array.isArray(material)) {
            material.forEach((entry) => {
              if (entry instanceof LineBasicMaterial) {
                entry.color.setHex(finalColor);
                entry.visible = true;
              }
            });
          } else if (material instanceof LineBasicMaterial) {
            material.color.setHex(finalColor);
            material.visible = true;
          }
        }
      });
      
      // STEP 3: If it's a Group, also update children individually
      if (block.mesh instanceof Group) {
        block.mesh.traverse((child) => {
          if (child instanceof Mesh && child !== block.mesh) {
            // Determine color for children
            let childColor = finalColor;
            const childRole = (child.userData?.componentRole as string | undefined) ?? null;
            if (childRole === "master") {
              childColor = 0x9b5cff;
            } else if (childRole === "instance") {
              childColor = 0xff4dff;
            } else if (usePinkColor) {
              childColor = 0xff4dff; // Pink for children when there are multiple selections
            }
            
            // Update LineSegments in each child
            child.traverse((grandchild) => {
              if (grandchild instanceof LineSegments) {
                // Ensure the LineSegments is visible
                grandchild.visible = true;
                
                const material = grandchild.material;
                if (Array.isArray(material)) {
                  material.forEach((entry) => {
                    if (entry instanceof LineBasicMaterial) {
                      entry.color.setHex(childColor);
                      entry.visible = true;
                    }
                  });
                } else if (material instanceof LineBasicMaterial) {
                  material.color.setHex(childColor);
                  material.visible = true;
                }
              }
            });
          }
        });
      }
    }
  }

  private updateHighlightForSelection(): void {
    // Clear single selection highlight
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.geometry.dispose();
      this.highlight = undefined;
    }

    // Clear multiple selection helpers
    for (const helper of this.multiSelectHelpers) {
      this.scene.remove(helper);
      helper.geometry.dispose();
      // Clear the temporary mesh if it exists
      const tempMesh = helper.userData?.tempMesh;
      if (tempMesh) {
        this.scene.remove(tempMesh);
        tempMesh.geometry.dispose();
        if (Array.isArray(tempMesh.material)) {
          tempMesh.material.forEach((mat) => mat.dispose());
        } else {
          tempMesh.material.dispose();
        }
      }
    }
    this.multiSelectHelpers = [];

    if (this.selectedIds.size === 1) {
      // Single selection: use normal highlight
      const [id] = this.selectedIds;
      const block = id ? this.blocks.getBlock(id) ?? null : null;
      this.selection = block;
      if (block) {
        const highlightColor = this.getBlockColor(block, true);
        this.highlight = new BoxHelper(block.mesh, highlightColor);
        this.scene.add(this.highlight);
      }
    } else if (this.selectedIds.size >= 2) {
      // Multiple selection: create A SINGLE BLUE BoxHelper that encompasses ALL blocks
      // This shows the same lines that appear when creating a group, but in blue
      this.selection = null;
      const blueColor = 0x0080ff; // BLUE color for multiple selections
      
      // Calculate the bounding box that encompasses all selected blocks
      const boundingBox = new Box3();
      let hasBlocks = false;
      
      for (const id of this.selectedIds) {
        const block = this.blocks.getBlock(id);
        if (!block) {
          continue;
        }
        
        // Expand the bounding box to include this block
        const blockBox = new Box3().setFromObject(block.mesh);
        if (hasBlocks) {
          boundingBox.union(blockBox);
        } else {
          boundingBox.copy(blockBox);
          hasBlocks = true;
        }
      }
      
      if (hasBlocks && !boundingBox.isEmpty()) {
        // Create an invisible temporary mesh with the size of the combined bounding box
        // This allows BoxHelper to correctly calculate the outline
        const center = boundingBox.getCenter(new Vector3());
        const size = boundingBox.getSize(new Vector3());
        
        // Create an invisible temporary mesh with box geometry of the correct size
        const tempGeometry = new BoxGeometry(size.x, size.y, size.z);
        const tempMaterial = new MeshBasicMaterial({ visible: false });
        const tempMesh = new Mesh(tempGeometry, tempMaterial);
        tempMesh.position.copy(center);
        
        // Create BoxHelper around the temporary mesh
        const helper = new BoxHelper(tempMesh, blueColor);
        this.scene.add(helper);
        this.multiSelectHelpers.push(helper);
        
        // Save reference to temporary mesh to be able to clean it up later
        // (we store it in the helper's userData so we can remove it)
        if (!helper.userData) {
          helper.userData = {};
        }
        helper.userData.tempMesh = tempMesh;
      }
    } else {
      this.selection = null;
    }
  }

  private refreshHighlight(): void {
    if (this.highlight) {
      this.highlight.update();
    }
    // Update all multiple selection helpers
    for (const helper of this.multiSelectHelpers) {
      helper.update();
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
