import Renderer from "./Renderer";
import Camera from "./Camera";
import MainScene from "@/scenes/MainScene";
import Loop from "./Loop";
import ControlsWithMovement from "@/systems/ControlsWithMovement";
import Crosshair from "@/objects/Crosshair";
import { Raycaster, Vector2, Vector3 } from "three";
import Pistol from "@/objects/Pistol";
import Target from "@/objects/Target";
import WSManager, { type PlayerCore } from "@/utils/ws/WSManager";
import type { UIController } from "@/ui/react/mountUI";
import type { TimerHint, TimerHintTableRow } from "@/ui/react/TimerDisplay";
import { SCENARIOS, type ScenarioConfig, getScenarioById } from "@/config/scenarios";

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
  private crosshair?: Crosshair;
  private paused = false;
  private cameraWorldPos = new Vector3();
  private cameraViewDir = new Vector3();
  private candidateWorldPos = new Vector3();
  private candidateVector = new Vector3();
  private shotsFired = 0;
  private shotsHit = 0;
  private reactionTimes: number[] = [];
  private readonly statsStorageKey = "redblockScenarioStats";

  constructor(ui?: UIController) {
    this.ui = ui;
    this.canvas = document.querySelector("canvas") as HTMLCanvasElement;
    this.gameRunning = false;

    // Core systems
    this.camera = new Camera();
    this.wsManager = new WSManager();
    this.scene = new MainScene(
      this.targets,
      this.wsManager.getMe()!,
      this.wsManager
    );

    this.renderer = new Renderer(this.scene, this.camera.instance, this.canvas);
    this.controls = new ControlsWithMovement(
      this.targets,
      this.camera.instance,
      this.canvas,
      this.wsManager,
      () => this.getAmmountOfTargetsSelected
    );
    this.scene.add(this.controls.object);
    this.camera.instance.rotation.set(0, (Math.PI / 2) * 3, 0);

    this.pistol = new Pistol(this.camera.instance, (loadedPistol) => {
      this.camera.instance.add(loadedPistol);
      this.pistol = loadedPistol;});
    this.loop = new Loop(this.renderer.instance,this.scene,this.camera.instance,this.controls,this.pistol);
    // Bind events
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("click", this.onClickForPointerLock);

    // Networking: position/room once server assigns me (controls ready now)
    this.wsManager.onMeReady((me: PlayerCore) => {
      this.controls.initPlayerRoom(me.room_coord_x, me.room_coord_z);
      this.controls.teleportTo(
        me.room_coord_x,
        0,
        me.room_coord_z,
        me.player_rotation_y ?? 0
      );
      this.scene.initPlayerRoom(me);
    });
  }
  startTimer() {
    this.ui?.timer.reset();
    this.ui?.timer.start();
  }

  stopTimer() {
    const elapsedSeconds = this.ui ? this.ui.timer.getElapsedSeconds() : null;
    const summary = this.buildRoundSummary(elapsedSeconds);
    this.ui?.timer.stop(summary);
    this.gameRunning = false;
  }

  start() {
    // React UI triggers start via startGame()
  }

  update(deltaTime: number) {
    if (!this.gameRunning || this.paused) return;
    this.controls.update(deltaTime);
  }

  private raycaster = new Raycaster();
  private mouse = new Vector2(0, 0);
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
    }

    return "regular";
  }

  get getAmmountOfTargetsSelected() {
    return this.currentScenarioTargetCount;
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
    const roundTime = roundDurationSeconds !== null && roundDurationSeconds > 0 ? roundDurationSeconds : null;

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
    this.targets.forEach((t) => this.scene.remove(t));
    this.targets.length = 0;
    this.clearScenarioPortals();
  }

  private clearScenarioPortals() {
    this.scenarioPortals.forEach((portal) => this.scene.remove(portal));
    this.scenarioPortals = [];
  }

  private applyScenarioTargetScale() {
    const scale = this.currentScenarioTargetScale;
    this.targets.forEach((cube) => {
      cube.baseScale = scale;
      cube.scale.set(scale, scale, scale);
    });
  }

  private setupScenarioPortals() {
    this.clearScenarioPortals();
    if (this.currentScenarioIndex === null) return;

    const hasPrev = this.currentScenarioIndex > 0;
    const hasNext = this.currentScenarioIndex < this.scenarios.length - 1;

    if (!hasPrev && !hasNext) return;

    const baseX = this.scene.me?.room_coord_x ?? 0;
    const baseZ = this.scene.me?.room_coord_z ?? 0;

    const portals: Array<{ type: "prev" | "next"; enabled: boolean; position: [number, number, number]; color: number }>
      = [
        { type: "prev", enabled: hasPrev, position: [baseX + 2, 0, baseZ - 5], color: 0x4287f5 },
        { type: "next", enabled: hasNext, position: [baseX + 2, 0, baseZ + 5], color: 0xf5a142 },
      ];

    portals.forEach((portal) => {
      if (!portal.enabled) return;
      const target = new Target(0xffffff, true, true);
      target.scenarioPortal = portal.type;
      target.position.set(...portal.position);
      target.baseScale = 0.5;
      target.scale.set(0.5, 0.5, 0.5);
      target.makeShootable(portal.color);
      this.scenarioPortals.push(target);
      this.scene.add(target);
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

    if (!this.crosshair) {
      this.crosshair = new Crosshair();
      this.camera.instance.add(this.crosshair);
    }

    this.resetTargets();
    const useHalfSize = scenario.targetScale === 0.2;
    this.scene.loadScenario(scenario.targetCount, useHalfSize);
    this.applyScenarioTargetScale();
    this.setupScenarioPortals();

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
  }
}
