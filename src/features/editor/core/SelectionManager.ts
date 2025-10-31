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

    // Calcular el nuevo bounding box que engloba todos los bloques seleccionados
    const boundingBox = new Box3();
    let hasBlocks = false;
    
    for (const id of this.selectedIds) {
      const block = this.blocks.getBlock(id);
      if (!block) {
        continue;
      }
      
      // Expandir el bounding box para incluir este bloque
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

    // Actualizar el mesh temporal de cada helper con el nuevo bounding box
    for (const helper of this.multiSelectHelpers) {
      const tempMesh = helper.userData?.tempMesh as Mesh | undefined;
      if (!tempMesh) {
        continue;
      }

      // Calcular nuevo centro y tamaño
      const center = boundingBox.getCenter(new Vector3());
      const size = boundingBox.getSize(new Vector3());
      
      // Actualizar posición del mesh temporal
      tempMesh.position.copy(center);
      
      // Actualizar geometría si el tamaño cambió significativamente
      const currentSize = new Vector3();
      tempMesh.geometry.computeBoundingBox();
      if (tempMesh.geometry.boundingBox) {
        tempMesh.geometry.boundingBox.getSize(currentSize);
        // Solo recrear la geometría si el tamaño cambió mucho (para evitar recrear en cada frame)
        const sizeDiff = Math.abs(currentSize.x - size.x) + Math.abs(currentSize.y - size.y) + Math.abs(currentSize.z - size.z);
        if (sizeDiff > 0.1) {
          tempMesh.geometry.dispose();
          tempMesh.geometry = new BoxGeometry(size.x, size.y, size.z);
        }
      }
      
      // Actualizar el helper
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
    // SOLUCIÓN DIRECTA: Cuando hay 2+ objetos seleccionados, aplicar líneas rosadas a TODOS
    const selectedCount = nextIds.size;
    const usePinkColor = selectedCount >= 2; // Si hay 2 o más, usar rosado
    
    // Procesar TODOS los bloques seleccionados
    for (const id of nextIds) {
      const block = this.blocks.getBlock(id);
      if (!block) {
        continue;
      }
      
      // Determinar el color: rosado si hay múltiples selecciones, sino usar el color normal
      let finalColor: number;
      
      if (usePinkColor) {
        // Si hay múltiples selecciones, usar rosado (0xff4dff) para bloques normales
        const role = (block.mesh.userData?.componentRole as string | undefined) ?? null;
        if (role === "master") {
          finalColor = 0x9b5cff; // Púrpura para master
        } else if (role === "instance") {
          finalColor = 0xff4dff; // Rosado para instance
        } else {
          finalColor = 0xff4dff; // Rosado para bloques normales cuando hay múltiples selecciones
        }
      } else {
        // Si solo hay uno, usar el color normal
        finalColor = this.getBlockColor(block, true);
      }
      
      // PASO 1: Actualizar block.outline si existe
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
      
      // PASO 2: Recorrer TODO el mesh y actualizar TODOS los LineSegments
      block.mesh.traverse((child) => {
        if (child instanceof LineSegments) {
          // Asegurar que el LineSegments sea visible
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
      
      // PASO 3: Si es un Group, actualizar también los hijos individualmente
      if (block.mesh instanceof Group) {
        block.mesh.traverse((child) => {
          if (child instanceof Mesh && child !== block.mesh) {
            // Determinar color para hijos
            let childColor = finalColor;
            const childRole = (child.userData?.componentRole as string | undefined) ?? null;
            if (childRole === "master") {
              childColor = 0x9b5cff;
            } else if (childRole === "instance") {
              childColor = 0xff4dff;
            } else if (usePinkColor) {
              childColor = 0xff4dff; // Rosado para hijos cuando hay múltiples selecciones
            }
            
            // Actualizar LineSegments en cada hijo
            child.traverse((grandchild) => {
              if (grandchild instanceof LineSegments) {
                // Asegurar que el LineSegments sea visible
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
    // Limpiar highlight de selección única
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.geometry.dispose();
      this.highlight = undefined;
    }

    // Limpiar helpers de selección múltiple
    for (const helper of this.multiSelectHelpers) {
      this.scene.remove(helper);
      helper.geometry.dispose();
      // Limpiar el mesh temporal si existe
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
      // Selección única: usar highlight normal
      const [id] = this.selectedIds;
      const block = id ? this.blocks.getBlock(id) ?? null : null;
      this.selection = block;
      if (block) {
        const highlightColor = this.getBlockColor(block, true);
        this.highlight = new BoxHelper(block.mesh, highlightColor);
        this.scene.add(this.highlight);
      }
    } else if (this.selectedIds.size >= 2) {
      // Selección múltiple: crear UN SOLO BoxHelper AZUL que englobe TODOS los bloques
      // Esto muestra las mismas líneas que aparecen al crear un grupo, pero en azul
      this.selection = null;
      const blueColor = 0x0080ff; // Color AZUL para múltiples selecciones
      
      // Calcular el bounding box que engloba todos los bloques seleccionados
      const boundingBox = new Box3();
      let hasBlocks = false;
      
      for (const id of this.selectedIds) {
        const block = this.blocks.getBlock(id);
        if (!block) {
          continue;
        }
        
        // Expandir el bounding box para incluir este bloque
        const blockBox = new Box3().setFromObject(block.mesh);
        if (hasBlocks) {
          boundingBox.union(blockBox);
        } else {
          boundingBox.copy(blockBox);
          hasBlocks = true;
        }
      }
      
      if (hasBlocks && !boundingBox.isEmpty()) {
        // Crear un mesh temporal invisible con el tamaño del bounding box combinado
        // Esto permite que BoxHelper calcule correctamente el outline
        const center = boundingBox.getCenter(new Vector3());
        const size = boundingBox.getSize(new Vector3());
        
        // Crear un mesh temporal invisible con geometría de caja del tamaño correcto
        const tempGeometry = new BoxGeometry(size.x, size.y, size.z);
        const tempMaterial = new MeshBasicMaterial({ visible: false });
        const tempMesh = new Mesh(tempGeometry, tempMaterial);
        tempMesh.position.copy(center);
        
        // Crear BoxHelper alrededor del mesh temporal
        const helper = new BoxHelper(tempMesh, blueColor);
        this.scene.add(helper);
        this.multiSelectHelpers.push(helper);
        
        // Guardar referencia al mesh temporal para poder limpiarlo después
        // (lo almacenamos en userData del helper para poder eliminarlo)
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
    // Actualizar todos los helpers de selección múltiple
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
