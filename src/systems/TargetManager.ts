import * as THREE from "three";
import Target from "@/objects/Target";

/**
 * TargetManager - Manages target lifecycle with efficient pooling and generation
 * 
 * Performance optimizations:
 * - Pre-allocated target pool (no dynamic creation during gameplay)
 * - Spatial grid for O(1) collision detection
 * - Batch operations for activation/deactivation
 * - No array searches - uses Set for O(1) lookups
 */
export default class TargetManager {
  private targetPool: Target[] = [];
  private activeTargets = new Set<Target>();
  private inactiveTargets = new Set<Target>();
  private scene: THREE.Scene;
  
  // Spatial grid for efficient collision detection
  private readonly gridCellSize = 1.0; // 1 meter cells
  private spatialGrid = new Map<string, Set<Target>>();
  
  // Reusable objects to avoid allocations
  private _tempBox1 = new THREE.Box3();
  private _tempBox2 = new THREE.Box3();
  private _tempVector = new THREE.Vector3();
  
  // Configuration
  private readonly maxPoolSize = 100;
  private readonly minPoolSize = 20;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializePool();
  }
  
  /**
   * Pre-initialize pool with minimum targets
   */
  private initializePool() {
    for (let i = 0; i < this.minPoolSize; i++) {
      const target = new Target(0xffffff, true, false, false);
      target.visible = false;
      target.shootable = false;
      this.targetPool.push(target);
      this.inactiveTargets.add(target);
      this.scene.add(target);
    }
    console.log(`[TargetManager] Pool initialized with ${this.minPoolSize} targets`);
  }
  
  /**
   * Generate targets in a spawning area
   * @param count - Number of targets to spawn
   * @param roomX - Room center X coordinate
   * @param roomZ - Room center Z coordinate
   * @param scale - Target scale (0.2 for small, 0.4 for normal)
   * @returns Array of successfully spawned targets
   */
  public generateTargets(
    count: number,
    roomX: number,
    roomZ: number,
    scale: number = 0.4
  ): Target[] {
    const startStats = this.getStats();
    const spawned: Target[] = [];
    
    // Define spawn area (in front of player)
    const spawnArea = {
      xMin: roomX + 4,
      xMax: roomX + 8,
      yMin: -1.5,
      yMax: 1.5,
      zMin: roomZ - 3,
      zMax: roomZ + 3
    };
    
    // First target is always shootable
    let firstTarget: Target | null = null;
    
    for (let i = 0; i < count; i++) {
      const target = this.spawnSingleTarget(spawnArea, scale, i === 0);
      
      if (target) {
        spawned.push(target);
        if (i === 0) {
          firstTarget = target;
        }
      } else {
        console.warn(`[TargetManager] Failed to spawn target ${i + 1}/${count}`);
      }
    }
    
    const endStats = this.getStats();
    console.log(`[TargetManager] Generated ${spawned.length}/${count} targets | Pool: ${startStats.total}→${endStats.total} | Active: ${endStats.active} | Inactive: ${endStats.inactive}`);
    
    return spawned;
  }
  
  /**
   * Spawn a single target in the given area
   */
  private spawnSingleTarget(
    area: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number },
    scale: number,
    shootable: boolean
  ): Target | null {
    const maxAttempts = 50;
    let target: Target | null = null;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Get or create target from pool
      target = this.acquireTarget();
      if (!target) return null;
      
      // Generate random position
      const x = area.xMin + Math.random() * (area.xMax - area.xMin);
      const y = area.yMin + Math.random() * (area.yMax - area.yMin);
      const z = area.zMin + Math.random() * (area.zMax - area.zMin);
      
      target.position.set(x, y, z);
      
      // Check collision with active targets
      if (!this.checkCollision(target, scale)) {
        // Success - activate target
        this.activateTarget(target, scale, shootable);
        return target;
      }
      
      // Collision detected - return to inactive WITHOUT deactivation
      // (target was never activated, so just put it back)
      this.inactiveTargets.add(target);
    }
    
    return null;
  }
  
  /**
   * Check if target collides with any active target
   */
  private checkCollision(target: Target, scale: number): boolean {
    this._tempBox1.setFromObject(target);
    // Expand by scale factor
    const expansion = scale * 0.5;
    this._tempBox1.expandByScalar(expansion);
    
    // Check against nearby targets using spatial grid
    const gridKey = this.getGridKey(target.position);
    const nearbyKeys = this.getAdjacentGridKeys(gridKey);
    
    for (const key of nearbyKeys) {
      const cellTargets = this.spatialGrid.get(key);
      if (!cellTargets) continue;
      
      for (const other of cellTargets) {
        if (other === target) continue;
        
        this._tempBox2.setFromObject(other);
        if (this._tempBox1.intersectsBox(this._tempBox2)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Activate a target (make it visible and add to spatial grid)
   */
  private activateTarget(target: Target, scale: number, shootable: boolean) {
    // Reset target state
    target.visible = true;
    target.animating = false;
    target.baseScale = scale;
    target.scale.set(scale, scale, scale);
    target.rotation.set(0, 0, 0);
    
    // Reset materials
    const cubeMaterial = target.cubeMesh.material as THREE.Material & { opacity?: number };
    if (cubeMaterial) cubeMaterial.opacity = 1;
    
    // Reset edge materials
    target.edgesGroup.children.forEach((edge) => {
      const edgeMaterial = (edge as THREE.Mesh).material as THREE.Material & { opacity?: number };
      if (edgeMaterial) edgeMaterial.opacity = 1;
    });
    
    // Set color and shootable state
    target.setColor(0xffffff);
    target.shootable = false; // Will be made shootable separately if needed
    
    if (shootable) {
      target.makeShootable();
    }
    
    // Move to active set
    this.inactiveTargets.delete(target);
    this.activeTargets.add(target);
    
    // Add to spatial grid
    this.addToSpatialGrid(target);
  }
  
  /**
   * Deactivate a target (hide it and remove from spatial grid)
   */
  private deactivateTarget(target: Target) {
    // Kill any active animations
    if (target.activeTweens) {
      target.activeTweens.forEach(t => t.kill());
      target.activeTweens = [];
    }
    
    target.visible = false;
    target.shootable = false;
    target.animating = false;
    
    // Move to inactive set
    this.activeTargets.delete(target);
    this.inactiveTargets.add(target);
    
    // Remove from spatial grid
    this.removeFromSpatialGrid(target);
  }
  
  /**
   * Acquire a target from the pool
   */
  private acquireTarget(): Target | null {
    // Try to get from inactive pool first
    if (this.inactiveTargets.size > 0) {
      const target = this.inactiveTargets.values().next().value as Target;
      this.inactiveTargets.delete(target);
      return target;
    }
    
    // Create new if pool not at max
    if (this.targetPool.length < this.maxPoolSize) {
      const target = new Target(0xffffff, true, false, false);
      target.visible = false;
      this.targetPool.push(target);
      this.scene.add(target);
      console.log(`[TargetManager] Pool expanded to ${this.targetPool.length} targets`);
      return target;
    }
    
    console.warn("[TargetManager] Pool exhausted!");
    return null;
  }
  
  /**
   * Release a target back to inactive pool
   */
  private releaseTarget(target: Target) {
    this.deactivateTarget(target);
  }
  
  /**
   * Reset all active targets (hide them)
   */
  public resetAllTargets() {
    // Batch deactivation
    const targets = Array.from(this.activeTargets);
    for (const target of targets) {
      this.deactivateTarget(target);
    }
    
    // Clear spatial grid
    this.spatialGrid.clear();
    
    const stats = this.getStats();
    console.log(`[TargetManager] Reset ${targets.length} targets | Pool stats: total=${stats.total}, active=${stats.active}, inactive=${stats.inactive}, gridCells=${stats.gridCells}`);
  }
  
  /**
   * Get all currently active targets
   */
  public getActiveTargets(): Target[] {
    return Array.from(this.activeTargets);
  }
  
  /**
   * Update target scale for all active targets
   */
  public updateActiveTargetsScale(scale: number) {
    for (const target of this.activeTargets) {
      target.baseScale = scale;
      target.scale.set(scale, scale, scale);
    }
  }
  
  /**
   * Spatial grid utilities
   */
  private getGridKey(position: THREE.Vector3): string {
    const x = Math.floor(position.x / this.gridCellSize);
    const y = Math.floor(position.y / this.gridCellSize);
    const z = Math.floor(position.z / this.gridCellSize);
    return `${x},${y},${z}`;
  }
  
  private getAdjacentGridKeys(centerKey: string): string[] {
    const [cx, cy, cz] = centerKey.split(',').map(Number);
    const keys: string[] = [];
    
    // Check 3x3x3 cube around center
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          keys.push(`${cx + dx},${cy + dy},${cz + dz}`);
        }
      }
    }
    
    return keys;
  }
  
  private addToSpatialGrid(target: Target) {
    const key = this.getGridKey(target.position);
    let cell = this.spatialGrid.get(key);
    
    if (!cell) {
      cell = new Set();
      this.spatialGrid.set(key, cell);
    }
    
    cell.add(target);
  }
  
  private removeFromSpatialGrid(target: Target) {
    const key = this.getGridKey(target.position);
    const cell = this.spatialGrid.get(key);
    
    if (cell) {
      cell.delete(target);
      if (cell.size === 0) {
        this.spatialGrid.delete(key);
      }
    }
  }
  
  /**
   * Clean up resources
   */
  public dispose() {
    // Dispose all targets properly
    for (const target of this.targetPool) {
      this.scene.remove(target);
      target.dispose();
    }
    
    this.targetPool = [];
    this.activeTargets.clear();
    this.inactiveTargets.clear();
    this.spatialGrid.clear();
    
    console.log("[TargetManager] Disposed");
  }
  
  /**
   * Get pool stats for debugging
   */
  public getStats() {
    return {
      total: this.targetPool.length,
      active: this.activeTargets.size,
      inactive: this.inactiveTargets.size,
      gridCells: this.spatialGrid.size
    };
  }
}
