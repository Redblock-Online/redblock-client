import * as THREE from "three";

type EffectKind = "tracer" | "flash" | "impact";

type Effect = {
  kind: EffectKind;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  active: boolean;
  baseScale: THREE.Vector3;
};

const SETTINGS: Record<EffectKind, { color: number; life: number }> = {
  tracer: { color: 0xff7a00, life: 0.12 },
  flash: { color: 0xffc21a, life: 0.07 },
  impact: { color: 0xff9a00, life: 0.2 },
};

const TRACER_WIDTH = 0.04;

/**
 * Pooled visual effects for remote shots: tracer, muzzle flash and impact puff.
 *
 * Geometry is shared per kind and each pooled mesh owns one material (needed for
 * per-effect opacity). Meshes are created lazily up to `capacityPerKind`; when a pool is
 * exhausted the oldest active effect of that kind is recycled, so rapid fire never grows
 * memory. Animation runs in {@link update} (no tweens, no per-shot allocation).
 */
export default class RemoteShotEffects {
  private readonly parent: THREE.Object3D;
  private readonly capacity: number;
  private readonly pools: Record<EffectKind, Effect[]> = { tracer: [], flash: [], impact: [] };
  private readonly geometries: Record<EffectKind, THREE.BufferGeometry>;

  constructor(parent: THREE.Object3D, capacityPerKind = 16) {
    this.parent = parent;
    this.capacity = capacityPerKind;
    // Unit box spanning z ∈ [0, 1] so a tracer is placed at its start and scaled to length
    const tracer = new THREE.BoxGeometry(1, 1, 1);
    tracer.translate(0, 0, 0.5);
    this.geometries = {
      tracer,
      flash: new THREE.OctahedronGeometry(0.08, 0),
      impact: new THREE.SphereGeometry(0.06, 6, 4),
    };
  }

  /** Thin tracer from `from` to `to` that fades and thins out. */
  public spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const length = from.distanceTo(to);
    if (!(length > 1e-3)) return;
    const fx = this.acquire("tracer");
    fx.mesh.position.copy(from);
    fx.mesh.lookAt(to);
    fx.baseScale.set(TRACER_WIDTH, TRACER_WIDTH, length);
    fx.mesh.scale.copy(fx.baseScale);
  }

  /** Short star-like burst at the muzzle. */
  public spawnFlash(at: THREE.Vector3) {
    const fx = this.acquire("flash");
    fx.mesh.position.copy(at);
    fx.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    fx.baseScale.set(1, 1, 1);
    fx.mesh.scale.copy(fx.baseScale);
  }

  /** Expanding puff where the shot hit. */
  public spawnImpact(at: THREE.Vector3) {
    const fx = this.acquire("impact");
    fx.mesh.position.copy(at);
    fx.baseScale.set(1, 1, 1);
    fx.mesh.scale.copy(fx.baseScale);
  }

  /** Advances and retires effects. Call once per frame. */
  public update(dt: number) {
    for (const kind of Object.keys(this.pools) as EffectKind[]) {
      for (const fx of this.pools[kind]) {
        if (!fx.active) continue;
        fx.age += dt;
        const t = fx.age / fx.life;
        if (t >= 1) {
          this.release(fx);
          continue;
        }
        fx.material.opacity = 1 - t;
        if (kind === "tracer") {
          const w = 1 - 0.6 * t;
          fx.mesh.scale.set(fx.baseScale.x * w, fx.baseScale.y * w, fx.baseScale.z);
        } else {
          const grow = kind === "flash" ? 1 + 0.9 * t : 1 + 1.6 * t;
          fx.mesh.scale.setScalar(grow);
        }
      }
    }
  }

  /** Number of effects currently visible, per kind (for tests/diagnostics). */
  public activeCount(kind?: EffectKind): number {
    const kinds = kind ? [kind] : (Object.keys(this.pools) as EffectKind[]);
    return kinds.reduce((n, k) => n + this.pools[k].filter((fx) => fx.active).length, 0);
  }

  /** Total meshes ever created, per kind (bounded by the pool capacity). */
  public pooledCount(kind: EffectKind): number {
    return this.pools[kind].length;
  }

  public dispose() {
    for (const kind of Object.keys(this.pools) as EffectKind[]) {
      for (const fx of this.pools[kind]) {
        this.parent.remove(fx.mesh);
        fx.material.dispose();
      }
      this.pools[kind] = [];
      this.geometries[kind].dispose();
    }
  }

  private acquire(kind: EffectKind): Effect {
    const pool = this.pools[kind];
    let fx = pool.find((e) => !e.active);
    if (!fx && pool.length < this.capacity) {
      const material = new THREE.MeshBasicMaterial({
        color: SETTINGS[kind].color,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geometries[kind], material);
      mesh.renderOrder = 10;
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      fx = { kind, mesh, material, age: 0, life: SETTINGS[kind].life, active: false, baseScale: new THREE.Vector3(1, 1, 1) };
      pool.push(fx);
    }
    if (!fx) {
      // Pool exhausted: recycle the oldest active effect of this kind
      fx = pool.reduce((oldest, e) => (e.age > oldest.age ? e : oldest), pool[0]);
    }
    fx.active = true;
    fx.age = 0;
    fx.material.opacity = 1;
    fx.mesh.visible = true;
    if (fx.mesh.parent !== this.parent) this.parent.add(fx.mesh);
    return fx;
  }

  private release(fx: Effect) {
    fx.active = false;
    fx.mesh.visible = false;
  }
}
