import Renderer from "./Renderer";
import Camera from "./Camera";
import MainScene from "@/scenes/MainScene";
import Loop from "./Loop";
import ControlsWithMovement from "@/systems/ControlsWithMovement";
import { PhysicsSystem } from "@/systems/PhysicsSystem";
import { Raycaster, Vector2, Vector3, BufferGeometry, Line, LineBasicMaterial, BufferAttribute, Mesh, SphereGeometry, MeshBasicMaterial } from "three";
import Pistol from "@/objects/Pistol";
import Target from "@/objects/Target";
import WSManager, { type PlayerCore } from "@/utils/ws/WSManager";
import type { UIController } from "@/ui/react/mountUI";
import type { TimerHint, TimerHintTableRow } from "@/ui/react/TimerDisplay";
import { SCENARIOS, type ScenarioConfig, getScenarioById } from "@/config/scenarios";
import gsap from "gsap";

type StoredMetricSet = {
  accuracy: number | null;
  avgReaction: number | null;
  efficiency: number | null;
  time: number | null;
};

type StoredStats = {
  last: StoredMetricSet;
  best: StoredMetricSet;
};

const IMPROVEMENT_EPS = 1e-3;

function createEmptyMetricSet(): StoredMetricSet {
  return {
    accuracy: null,
    avgReaction: null,
    efficiency: null,
    time: null,
  };
}

function createEmptyStats(): StoredStats {
  return {
    last: createEmptyMetricSet(),
    best: createEmptyMetricSet(),
  };
}

export default class App {
  private canvas: HTMLCanvasElement;
  renderer: Renderer;
  camera: Camera;
  scene: MainScene;
  loop: Loop;
  controls: ControlsWithMovement;
  collisionSystem: PhysicsSystem;
  pistol: Pistol;
  private ui?: UIController;
  targets: Target[] = [];
  gameRunning: boolean = false;
  wsManager: WSManager;
  private currentScenarioIndex: number | null = null;
  private scenarios: ScenarioConfig[] = SCENARIOS;
  private scenarioPortals: Target[] = [];
  private currentScenarioTargetCount = 3;
  private currentScenarioTargetScale = 0.4;
  private paused = false;
  private cameraWorldPos = new Vector3();
  private cameraViewDir = new Vector3();
  private candidateWorldPos = new Vector3();
  private candidateVector = new Vector3();
  private shotsFired = 0;
  private shotsHit = 0;
  private reactionTimes: number[] = [];
  private readonly statsStorageKey = "redblockScenarioStats";
  private tracerPool: Line[] = [];
  private impactPool: Mesh[] = [];
  private tracerGeom?: BufferGeometry;
  private impactGeom?: SphereGeometry;
  private isEditorMode: boolean = false;


  constructor(ui?: UIController, options?: { disableServer?: boolean }) {
    this.ui = ui;
    this.canvas = document.querySelector("canvas") as HTMLCanvasElement;
    this.gameRunning = false;
    this.isEditorMode = options?.disableServer ?? false;
    
    console.log("[App] Constructor - options:", options);
    console.log("[App] Constructor - isEditorMode:", this.isEditorMode);

    // Core systems
    this.camera = new Camera();
    this.wsManager = new WSManager(options?.disableServer ? { disabled: true } : undefined);
    
    // Initialize physics system first (before scene)
    this.collisionSystem = new PhysicsSystem();
    this.collisionSystem.waitForInit().then(() => {
      console.log("[App] Physics system ready");
      this.collisionSystem.setPlayerDimensions(0.25, 1.8); // radius (smaller for smoother movement), height
      this.collisionSystem.setStepHeight(0.5); // max step height
    });
    
    this.scene = new MainScene(
      this.targets,
      this.wsManager.getMe()!,
      this.wsManager,
      this.collisionSystem,
      this.isEditorMode  // Pass editor mode flag to prevent room generation
    );
    this.tracerGeom = new BufferGeometry();
    const positions = new Float32Array(6);
    this.tracerGeom.setAttribute('position', new BufferAttribute(positions, 3));
    this.impactGeom = new SphereGeometry(0.06, 6, 4); // Reduced from 8x8 to 6x4 for performance

    this.renderer = new Renderer(this.scene, this.camera.instance, this.canvas);
    this.controls = new ControlsWithMovement(
      this.targets,
      this.camera.instance,
      this.canvas,
      this.wsManager,
      () => this.getAmmountOfTargetsSelected,
      this.collisionSystem, // Pass collision system to controls
      this.isEditorMode // Pass editor mode flag to disable movement limits
    );
    this.scene.add(this.controls.object);
    this.camera.instance.rotation.set(0, (Math.PI / 2) * 3, 0);

    this.pistol = new Pistol(this.camera.instance, (loadedPistol) => {
      this.camera.instance.add(loadedPistol);
      this.pistol = loadedPistol;
      this.pistol.setScene(this.scene);
    });
    this.loop = new Loop(this.renderer.instance,this.scene,this.camera.instance,this.controls,this.pistol,this.collisionSystem);
    // Bind events
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("click", this.onClickForPointerLock);

    // Networking: position/room once server assigns me (controls ready now)
    this.wsManager.onMeReady(async (me: PlayerCore) => {
      console.log("[App] ⚠️ onMeReady called! isEditorMode:", this.isEditorMode);
      // CRITICAL: Wait for physics to be ready before spawning player
      await this.collisionSystem.waitForInit();
      console.log("[App] Physics ready, initializing player room and position");
      
      // Skip default level generation in editor mode
      if (!this.isEditorMode) {
        this.controls.initPlayerRoom(me.room_coord_x, me.room_coord_z);
        this.scene.initPlayerRoom(me);
        
        // Wait a frame to ensure ground collider is added
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log("[App] Total colliders in physics:", this.collisionSystem.getColliders().length);
        
        // Spawn player at floor surface (floor at Y=0)
        this.controls.teleportTo(
          me.room_coord_x,
          0,
          me.room_coord_z,
          me.player_rotation_y ?? 0
        );
        
        console.log("[App] Player spawned at position:", this.controls.object.position);
        console.log("[App] Testing ground collision from spawn point...");
        const groundTest = this.collisionSystem.checkGroundCollision(this.controls.object.position, 50);
        console.log("[App] Ground detected at Y:", groundTest);
      } else {
        console.log("[App] Editor mode - skipping default level generation");
      }
    });
  }
  /**
   * Initialize level physics and gameplay
   * Call this when a level/scenario starts
   */
  private initializeLevelPhysics() {
    console.log("[App] 🎮 Initializing level physics...");
    
    // Enable physics simulation (gravity, collisions)
    this.collisionSystem.enablePhysics();
    
    // Reset player physics state
    this.controls.resetPhysicsState();
    
    console.log("[App] ✅ Level physics initialized - game ready");
  }

  /**
   * Cleanup level physics
   * Call this when a level ends or resets
   */
  private cleanupLevelPhysics() {
    console.log("[App] 🧹 Cleaning up level physics...");
    
    // Disable physics simulation
    this.collisionSystem.disablePhysics();
    
    // Reset player state
    this.controls.resetPhysicsState();
    
    console.log("[App] ✅ Level physics cleaned up");
  }

  startTimer() {
    // In editor mode, skip timer UI but still enable physics
    if (!this.isEditorMode) {
      this.ui?.timer.reset();
      this.ui?.timer.start();
    }
    
    // Enable physics when timer starts (game begins)
    this.initializeLevelPhysics();
  }

  stopTimer() {
    // In editor mode, skip timer and stats UI
    if (!this.isEditorMode) {
      const elapsedSeconds = this.ui ? this.ui.timer.getElapsedSeconds() : null;
      const summary = this.buildRoundSummary(elapsedSeconds);
      this.ui?.timer.stop(summary);
    }
    this.gameRunning = false;
    
    // Don't disable physics - keep them running so player can still move
  }

  start() {
    // React UI triggers start via startGame()
  }

  update(deltaTime: number) {
    if (!this.gameRunning || this.paused) return;
    this.collisionSystem.step(deltaTime); // Step physics simulation
    this.controls.update(deltaTime);
  }

  private raycaster = new Raycaster();
  private mouse = new Vector2(0, 0);
  
  // Reusable vectors to avoid allocations in hot paths
  private _tempCamPos = new Vector3();
  private _tempCamDir = new Vector3();
  private _tempMuzzlePos = new Vector3();
  
  public checkCrosshairIntersections(): "regular" | "portal" | null {
    const objects = [...this.targets, ...this.scenarioPortals] as unknown as import("three").Object3D[];
    if (objects.length === 0) return null;

    this.raycaster.setFromCamera(this.mouse, this.camera.instance);
    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length === 0) return null;

    const first = intersects[0].object;
    let node: import("three").Object3D | null = first;
    while (node && !(node instanceof Target)) node = node.parent;
    const hitTarget = node as Target | undefined;
    if (!hitTarget) return null;

    if (hitTarget.scenarioPortal) {
      this.handleScenarioPortal(hitTarget.scenarioPortal);
      return "portal";
    }

    if (!hitTarget.shootable || hitTarget.animating) return null;

    this.recordHit(hitTarget);
    hitTarget.absorbAndDisappear();

    const candidates = this.targets.filter(
      (t) => t.visible && !t.shootable && !t.animating && t !== hitTarget
    );

    if (candidates.length > 0) {
      this.camera.instance.getWorldPosition(this.cameraWorldPos);
      this.camera.instance.getWorldDirection(this.cameraViewDir);

      let forwardBest: { cube: Target; alignment: number; distanceSq: number } | null = null;
      let nearestBest: { cube: Target; distanceSq: number } | null = null;

      const lastPosition = hitTarget.position;

      for (const candidate of candidates) {
        candidate.getWorldPosition(this.candidateWorldPos);

        this.candidateVector.copy(this.candidateWorldPos).sub(this.cameraWorldPos);
        const distanceSqFromCamera = this.candidateVector.lengthSq();

        const alignment = distanceSqFromCamera === 0
          ? 1
          : this.candidateVector.normalize().dot(this.cameraViewDir);

        if (alignment > 0) {
          if (
            !forwardBest ||
            alignment > forwardBest.alignment + 1e-5 ||
            (Math.abs(alignment - forwardBest.alignment) <= 1e-5 &&
              distanceSqFromCamera < forwardBest.distanceSq)
          ) {
            forwardBest = {
              cube: candidate,
              alignment,
              distanceSq: distanceSqFromCamera,
            };
          }
        }

        const distanceSqFromLast = candidate.position.distanceToSquared(lastPosition);
        if (!nearestBest || distanceSqFromLast < nearestBest.distanceSq) {
          nearestBest = {
            cube: candidate,
            distanceSq: distanceSqFromLast,
          };
        }
      }

      const nextTarget = forwardBest?.cube ?? nearestBest?.cube ?? null;
      nextTarget?.makeShootable();
    }

    const remaining = this.targets.some(
      (t) => t.visible && !t.animating && t.shootable
    );
    if (!remaining) {
      this.stopTimer();
      
      // TargetManager handles all cleanup and pooling automatically
      // No manual dispose needed - the pool manages everything efficiently
      console.log('[App] Level complete. TargetManager stats:', this.scene.targetManager.getStats());
    }

    return "regular";
  }

  get getAmmountOfTargetsSelected() {
    return this.currentScenarioTargetCount;
  }

  private spawnTracer(from: Vector3, to: Vector3, color = 0xffff66) {
    let line: Line | undefined;
    if (this.tracerPool.length > 0) {
      line = this.tracerPool.pop()!;

      if (!line.geometry.getAttribute("position")) {
        // Dispose old geometry before cloning new one
        const oldGeom = line.geometry;
        line.geometry = this.tracerGeom!.clone();
        if (oldGeom) oldGeom.dispose();
      }
      const posAttr = line.geometry.getAttribute("position") as BufferAttribute;
      posAttr.setXYZ(0, from.x, from.y, from.z);
      posAttr.setXYZ(1, to.x, to.y, to.z);
      posAttr.needsUpdate = true;
      (line.material as LineBasicMaterial).color.set(color);
      (line.material as LineBasicMaterial).opacity = 1;
    } else {
      const pos = new Float32Array([from.x, from.y, from.z, to.x, to.y, to.z]);
      const geom = new BufferGeometry();
      geom.setAttribute("position", new BufferAttribute(pos, 3));
      const mat = new LineBasicMaterial({ color, transparent: true, opacity: 1, linewidth: 5 });
      line = new (Line)(geom, mat) as Line;
    }

    this.scene.add(line);

    try {
      gsap.to((line.material as LineBasicMaterial), {
        opacity: 0,
        duration: 0.16,
        ease: "power2.out",
        onComplete: () => {
          this.scene.remove(line!);
          if (this.tracerPool.length < 10) {
            this.tracerPool.push(line!);
          }
        },
      });
    } catch {
      setTimeout(() => {
        this.scene.remove(line!);
        if (this.tracerPool.length < 10) {
          this.tracerPool.push(line!);
        }
      }, 200);
    }
  }

  private spawnImpactAt(pos: Vector3, color = 0xffe07a) {
    let sphere: Mesh | undefined;
    if (this.impactPool.length > 0) {
      sphere = this.impactPool.pop()!;
      sphere.position.copy(pos);
      (sphere.material as MeshBasicMaterial).color.set(color);
      (sphere.material as MeshBasicMaterial).opacity = 1;
      sphere.scale.set(1, 1, 1);
    } else {
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      sphere = new Mesh(this.impactGeom!, mat);
      sphere.position.copy(pos);
    }
    this.scene.add(sphere);

    try {
      // Simplified animation - single tween instead of timeline for performance
      gsap.to(sphere.scale, { x: 1.4, y: 1.4, z: 1.4, duration: 0.06 });
      gsap.to((sphere.material as MeshBasicMaterial), {
        opacity: 0, duration: 0.15, onComplete: () => {
          this.scene.remove(sphere!);
          if (this.impactPool.length < 10) {
            this.impactPool.push(sphere!);
          }
        }
      });
    } catch {
      setTimeout(() => {
        this.scene.remove(sphere!);
        if (this.impactPool.length < 10) {
          this.impactPool.push(sphere!);
        }
      }, 200);
    }
  }

  // ===== Helpers =====
  private onMouseDown = (e: MouseEvent) => {
    if (!this.gameRunning) {
      if (this.currentScenarioIndex !== null) {
        const scenario = this.scenarios[this.currentScenarioIndex];
        this.startScenarioById(scenario.id);
      }
      return;
    }

    if (e.button === 0) {
      if (this.paused) return;
      this.recordShotFired();
      this.pistol.shoot();

      const objects = [...this.targets, ...this.scenarioPortals] as unknown as import("three").Object3D[];
      // Add editor cubes if they exist (only the cubeMesh, not the outline or edges)
      const editorCubesGroup = (this as { editorCubesGroup?: import("three").Group }).editorCubesGroup;
      if (editorCubesGroup) {
        // Recursively find all cubeMesh objects in the hierarchy (including nested groups/components)
        editorCubesGroup.traverse((obj: import("three").Object3D) => {
          const objWithCubeMesh = obj as import("three").Object3D & { cubeMesh?: import("three").Mesh };
          if (objWithCubeMesh.cubeMesh) {
            objects.push(objWithCubeMesh.cubeMesh);
          }
        });
      }
      
      // Reuse vectors instead of creating new ones
      this.camera.instance.getWorldPosition(this._tempCamPos);
      this.camera.instance.getWorldDirection(this._tempCamDir);

      try {
        if (this.pistol) {
          (this.pistol).getMuzzleWorldPosition(this._tempMuzzlePos);
        } else {
          this._tempMuzzlePos.copy(this._tempCamPos).addScaledVector(this._tempCamDir, 0.18);
        }
      } catch {
        this._tempMuzzlePos.copy(this._tempCamPos).addScaledVector(this._tempCamDir, 0.18);
      }

      this.raycaster.setFromCamera(this.mouse, this.camera.instance);

      const intersects = this.raycaster.intersectObjects(objects, true);
      
      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitPoint = hit.point.clone();

        // this.spawnTracer(muzzleWorld, hitPoint);
        this.spawnImpactAt(hitPoint);

      } else {
        // const farPoint = camPos.clone().add(camDir.multiplyScalar(50));
        // this.spawnTracer(muzzleWorld, farPoint, 0x9999ff);
      }
      const result = this.checkCrosshairIntersections();
      if (result === "portal") {
        this.shotsFired = Math.max(0, this.shotsFired - 1);
      }
    }
  };

  private onClickForPointerLock = (_e: MouseEvent) => {
    this.requestPointerLockSafe();
  };

  private requestPointerLockSafe() {
    if (document.pointerLockElement === this.canvas) return;
    
    const attemptLock = () => {
      try {
        const promise = this.canvas.requestPointerLock();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            // Silently retry on next frame
            requestAnimationFrame(attemptLock);
          });
        }
      } catch (e) {
        // Silently retry on next frame
        requestAnimationFrame(attemptLock);
      }
    };
    
    attemptLock();
  }

  private resetRoundStats() {
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.reactionTimes = [];
  }

  private recordShotFired() {
    this.shotsFired += 1;
  }

  private recordHit(target: Target) {
    this.shotsHit += 1;
    const activatedAt = target.shootableActivatedAt;
    if (typeof activatedAt === "number") {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const reactionSeconds = Math.max(0, (now - activatedAt) / 1000);
      this.reactionTimes.push(reactionSeconds);
    }
  }

  private buildRoundSummary(roundDurationSeconds: number | null): TimerHint {
    const accuracyRatio = this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0;
    const accuracyPct = accuracyRatio * 100;

    let avgReaction: number | null = null;
    if (this.reactionTimes.length > 0) {
      const total = this.reactionTimes.reduce((acc, value) => acc + value, 0);
      avgReaction = total / this.reactionTimes.length;
    }

    const scenario = this.currentScenarioIndex !== null ? this.scenarios[this.currentScenarioIndex] : this.scenarios[0];
    const scenarioId = scenario.id;

    const stored = this.loadScenarioStats(scenarioId);
    const nextStored: StoredStats = {
      last: { ...stored.last },
      best: { ...stored.best },
    };

    const hits = this.shotsHit;
    let roundTime: number| null = 0;

    roundTime = roundDurationSeconds !== null && roundDurationSeconds > 0 ? hits / roundTime : null;

    const baselineReaction = stored.best.avgReaction ?? avgReaction ?? null;
    const reactionNormalized =
      avgReaction !== null
        ? baselineReaction && baselineReaction > 0
          ? Math.max(0, baselineReaction / avgReaction)
          : 1
        : null;

    const speed = hits > 0 && roundTime ? hits / roundTime : null;
    const baselineSpeed =
      hits > 0
        ? stored.best.time && stored.best.time > 0
          ? hits / stored.best.time
          : speed
        : null;
    const speedNormalized =
      speed !== null
        ? baselineSpeed && baselineSpeed > 0
          ? Math.max(0, speed / baselineSpeed)
          : 1
        : null;

    const missRatio = 1 - accuracyRatio;
    const k = 2;
    const wR = 0.5;
    const wS = 0.5;

    const penMiss = Math.exp(-k * missRatio);
    const reactionComponent = reactionNormalized ?? 1;
    const speedComponent = speedNormalized ?? 1;

    const efficiencyRaw = penMiss * Math.pow(reactionComponent, wR) * Math.pow(speedComponent, wS);
    const efficiency = Number.isFinite(efficiencyRaw) ? efficiencyRaw * 100 : null;

    const rows: TimerHintTableRow[] = [];

    const metrics: Array<{
      key: keyof StoredMetricSet;
      label: string;
      value: number | null;
      betterIsLower: boolean;
      formatter: (value: number) => string;
      naLabel: string;
      bestFallback: string;
    }> = [
      {
        key: "accuracy",
        label: "Accuracy",
        value: this.shotsFired > 0 ? accuracyPct : null,
        betterIsLower: false,
        formatter: (value) => `${value.toFixed(1)}%`,
        naLabel: "N/A",
        bestFallback: "--",
      },
      {
        key: "avgReaction",
        label: "Avg Reaction",
        value: avgReaction,
        betterIsLower: true,
        formatter: (value) => `${value.toFixed(2)}s`,
        naLabel: "N/A",
        bestFallback: "--",
      },
      {
        key: "time",
        label: "Time",
        value: roundTime,
        betterIsLower: true,
        formatter: (value) => `${value.toFixed(2)}s`,
        naLabel: "N/A",
        bestFallback: "--",
      },
      {
        key: "efficiency",
        label: "Efficiency",
        value: efficiency,
        betterIsLower: false,
        formatter: (value) => value.toFixed(1),
        naLabel: "N/A",
        bestFallback: "--",
      },
    ];

    for (const metric of metrics) {
      const prevBest = stored.best[metric.key];
      const currentValue = metric.value;

      let isNewBest = false;

      if (currentValue !== null) {
        nextStored.last[metric.key] = currentValue;

        const beatsBest =
          prevBest === null ||
          (metric.betterIsLower
            ? currentValue < prevBest - IMPROVEMENT_EPS
            : currentValue > prevBest + IMPROVEMENT_EPS);

        if (beatsBest) {
          nextStored.best[metric.key] = currentValue;
          isNewBest = true;
        }
      } else {
        nextStored.last[metric.key] = null;
      }

      const bestValue = nextStored.best[metric.key];
      const baseCurrentText =
        currentValue === null ? metric.naLabel : metric.formatter(currentValue);
      const bestText =
        bestValue === null ? metric.bestFallback : metric.formatter(bestValue);

      const scoreText = (() => {
        if (metric.key === "accuracy") {
          if (this.shotsFired === 0) return metric.naLabel;
          const ratioText = `${this.shotsHit}/${this.shotsFired}`;
          return `${baseCurrentText} ${ratioText}`;
        }
        return baseCurrentText;
      })();

      rows.push({
        label: metric.label,
        score: scoreText,
        best: bestText,
        scoreTone: isNewBest ? "positive" : "neutral",
        bestTone: isNewBest ? "positive" : "neutral",
      });
    }

    this.saveScenarioStats(scenarioId, nextStored);

    return {
      kind: "table",
      rows,
      note: `${scenario.label} · Press Click to start again`,
    };
  }

  private loadScenarioStats(scenarioId: string): StoredStats {
    const defaults = createEmptyStats();
    const storage = this.getStorage();
    if (!storage) return defaults;
    try {
      const raw = storage.getItem(this.statsStorageKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<Record<string, StoredStats>> | null;
      const entry = parsed?.[scenarioId];
      if (!entry) return defaults;
      return {
        last: { ...defaults.last, ...(entry.last ?? {}) },
        best: { ...defaults.best, ...(entry.best ?? {}) },
      };
    } catch {
      return defaults;
    }
  }

  private saveScenarioStats(scenarioId: string, stats: StoredStats) {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(this.statsStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Partial<Record<string, StoredStats>>) : {};
      parsed[scenarioId] = stats;
      storage.setItem(this.statsStorageKey, JSON.stringify(parsed));
    } catch {
      /* swallow */
    }
  }

  private getStorage(): Storage | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private resetTargets() {
    // Use TargetManager to efficiently reset all targets
    this.scene.targetManager.resetAllTargets();
    
    // Update legacy targets array
    this.targets = this.scene.targetManager.getActiveTargets();
    
    this.clearScenarioPortals();
    
    console.log('[App] Targets reset via TargetManager');
  }

  private clearScenarioPortals() {
    // Hide portals instead of removing them (for reuse)
    this.scenarioPortals.forEach((portal) => {
      portal.visible = false;
    });
  }

  private disposeScenarioPortals() {
    // Complete cleanup with dispose (only when needed)
    this.scenarioPortals.forEach((portal) => {
      this.scene.remove(portal);
      portal.dispose(); // Returns material to pool, clears references
    });
    this.scenarioPortals = [];
  }

  private applyScenarioTargetScale() {
    const scale = this.currentScenarioTargetScale;
    // Use TargetManager to update scale efficiently (only active targets)
    this.scene.targetManager.updateActiveTargetsScale(scale);
  }

  private setupScenarioPortals() {
    this.clearScenarioPortals();
    if (this.currentScenarioIndex === null) return;

    const hasPrev = this.currentScenarioIndex > 0;
    const hasNext = this.currentScenarioIndex < this.scenarios.length - 1;

    if (!hasPrev && !hasNext) return;

    const baseX = this.scene.me?.room_coord_x ?? 0;
    const baseZ = this.scene.me?.room_coord_z ?? 0;

    const portalConfigs: Array<{ type: "prev" | "next"; enabled: boolean; position: [number, number, number]; color: number }>
      = [
        { type: "prev", enabled: hasPrev, position: [baseX + 2, 0, baseZ - 5], color: 0x4287f5 },
        { type: "next", enabled: hasNext, position: [baseX + 2, 0, baseZ + 5], color: 0xf5a142 },
      ];

    // Reuse existing portals or create new ones only if needed
    let portalIndex = 0;
    portalConfigs.forEach((config) => {
      if (!config.enabled) return;
      
      let portal: Target;
      if (portalIndex < this.scenarioPortals.length) {
        // Reuse existing portal
        portal = this.scenarioPortals[portalIndex];
        portal.visible = true;
      } else {
        // Create new portal only if we don't have enough
        portal = new Target(0xffffff, true, true);
        portal.baseScale = 0.5;
        portal.scale.set(0.5, 0.5, 0.5);
        this.scenarioPortals.push(portal);
        this.scene.add(portal);
      }
      
      // Update portal properties
      portal.scenarioPortal = config.type;
      portal.position.set(...config.position);
      portal.makeShootable(config.color);
      
      portalIndex++;
    });
  }

  public startGame(scenarioId: string) {
    if (!this.wsManager.getMe()) {
      this.wsManager.onMeReady(() => this.startGame(scenarioId));
      return;
    }
    this.startScenarioById(scenarioId);
  }

  private startScenarioById(scenarioId: string) {
    const scenario = getScenarioById(scenarioId) ?? this.scenarios[0];
    const index = this.scenarios.findIndex((s) => s.id === scenario.id);
    this.currentScenarioIndex = index;
    this.currentScenarioTargetCount = Math.max(1, Math.floor(scenario.targetCount));
    this.currentScenarioTargetScale = scenario.targetScale ?? 0.4;

    this.resetRoundStats();
    this.ui?.timer.reset();

    this.resetTargets();
    
    // In editor mode, don't generate default targets - custom scenario will be loaded separately
    if (!this.isEditorMode) {
      const useHalfSize = scenario.targetScale === 0.2;
      this.scene.loadScenario(scenario.targetCount, useHalfSize);
      
      // Sync targets array after generation (TargetManager updates scene.targets)
      this.targets = this.scene.targets;
      
      this.applyScenarioTargetScale();
      this.setupScenarioPortals();
      
      console.log(`[App] Scenario started with ${this.targets.length} targets`);
    }

    this.loop.start();
    this.startTimer();
    this.gameRunning = true;
  }

  private handleScenarioPortal(direction: "next" | "prev") {
    if (this.currentScenarioIndex === null) return;
    const nextIndex = direction === "next" ? this.currentScenarioIndex + 1 : this.currentScenarioIndex - 1;
    if (nextIndex < 0 || nextIndex >= this.scenarios.length) return;

    const nextScenario = this.scenarios[nextIndex];
    this.startScenarioById(nextScenario.id);
  }

  public attachUI(ui: UIController) {
    this.ui = ui;
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    this.controls.setPaused(paused);
    
    // Pause/resume physics
    if (paused) {
      this.collisionSystem.disablePhysics();
    } else {
      // Always enable physics when unpausing (even if game is complete)
      this.collisionSystem.enablePhysics();
    }
  }
}
