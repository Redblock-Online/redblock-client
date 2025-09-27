import Renderer from "./Renderer";
import Camera from "./Camera";
import MainScene from "@/scenes/MainScene";
import Loop from "./Loop";
import ControlsWithMovement from "@/systems/ControlsWithMovement";
import Crosshair from "@/objects/Crosshair";
import { Raycaster, Vector2, Vector3 } from "three";
import Pistol from "@/objects/Pistol";
import Cube from "@/objects/Cube";
import WSManager, { type PlayerCore } from "@/utils/ws/WSManager";
import type { UIController } from "@/ui/react/mountUI";
import type { TimerHint, TimerHintTableRow } from "@/ui/react/TimerDisplay";

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
  level: number = 0;
  targets: Cube[] = [];
  gameRunning: boolean = false;
  wsManager: WSManager;
  ammountOfTargetsSelected: number = 3;
  private crosshair?: Crosshair;
  private paused = false;
  private cameraWorldPos = new Vector3();
  private cameraViewDir = new Vector3();
  private candidateWorldPos = new Vector3();
  private candidateVector = new Vector3();
  private shotsFired = 0;
  private shotsHit = 0;
  private reactionTimes: number[] = [];
  private readonly statsStorageKey = "redblockStats";

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
  public checkCrosshairIntersections() {
    this.raycaster.setFromCamera(this.mouse, this.camera.instance);
    // Intersect only the target groups (recursive)
    const intersects = this.raycaster.intersectObjects(
      this.targets as unknown as import("three").Object3D[],
      true
    );

    if (intersects.length > 0) {
      const first = intersects[0].object;
      // Bubble up to the Cube group
      let node: import("three").Object3D | null = first;
      while (node && !(node instanceof Cube)) node = node.parent;
      const hitTarget = node as Cube | undefined;

      if (hitTarget && hitTarget.shootable && !hitTarget.animating) {
        this.recordHit(hitTarget);
        hitTarget.absorbAndDisappear();

        // Filter valid candidates
        const candidates = this.targets.filter(
          (t) => t.visible && !t.shootable && !t.animating && t !== hitTarget
        );

        // Prefer the target that is most aligned with the player's current view.
        if (candidates.length > 0) {
          this.camera.instance.getWorldPosition(this.cameraWorldPos);
          this.camera.instance.getWorldDirection(this.cameraViewDir);

          let forwardBest: { cube: Cube; alignment: number; distanceSq: number } | null = null;
          let nearestBest: { cube: Cube; distanceSq: number } | null = null;

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
      }
    }

    const remaining = this.targets.some(
      (t) => t.visible && !t.animating && t.shootable
    );
    if (!remaining) {
      this.stopTimer();
    }
  }

  get getAmmountOfTargetsSelected() {
    return this.ammountOfTargetsSelected;
  }

  // ===== Helpers =====
  private onMouseDown = (e: MouseEvent) => {
    if (!this.gameRunning) {
      if (this.level > 0) {
        this.ui?.timer.reset();
        this.resetRoundStats();
        this.resetTargets();
        this.scene.level(this.level);
        this.startTimer();
        this.gameRunning = true;
      }
      return;
    }

    if (e.button === 0) {
      if (this.paused) return;
      this.recordShotFired();
      this.pistol.shoot();
      this.checkCrosshairIntersections();
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

  private recordHit(target: Cube) {
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

    const efficiency = avgReaction !== null && avgReaction > 0
      ? accuracyRatio * (1 / avgReaction) * 100
      : null;

    const stored = this.loadStoredStats();
    const nextStored: StoredStats = {
      last: { ...stored.last },
      best: { ...stored.best },
    };

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
        key: "efficiency",
        label: "Efficiency",
        value: efficiency,
        betterIsLower: false,
        formatter: (value) => value.toFixed(1),
        naLabel: "N/A",
        bestFallback: "--",
      },
      {
        key: "time",
        label: "Time",
        value: roundDurationSeconds,
        betterIsLower: true,
        formatter: (value) => `${value.toFixed(2)}s`,
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

    this.saveStoredStats(nextStored);

    return {
      kind: "table",
      rows,
      note: "Press Click to start again",
    };
  }

  private loadStoredStats(): StoredStats {
    const defaults = createEmptyStats();
    const storage = this.getStorage();
    if (!storage) return defaults;
    try {
      const raw = storage.getItem(this.statsStorageKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<StoredStats> | null;
      return {
        last: { ...defaults.last, ...(parsed?.last ?? {}) },
        best: { ...defaults.best, ...(parsed?.best ?? {}) },
      };
    } catch {
      return defaults;
    }
  }

  private saveStoredStats(stats: StoredStats) {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(this.statsStorageKey, JSON.stringify(stats));
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

  private applyLevelSelection(level: number) {
    if (level === 1) this.ammountOfTargetsSelected = 3;
    if (level === 2) this.ammountOfTargetsSelected = 8;
    if (level === 3) this.ammountOfTargetsSelected = 50;
  }

  private resetTargets() {
    // Remove previous targets from scene and clear the list
    this.targets.forEach((t) => this.scene.remove(t));
    this.targets.length = 0;
  }

  // Called by React UI when selecting a level
  public startGame(level: number) {
    // If server hasn't assigned me yet, defer starting once
    if (!this.wsManager.getMe()) {
      this.wsManager.onMeReady(() => this.startGame(level));
      return;
    }
    this.applyLevelSelection(level);
    this.resetRoundStats();
    this.gameRunning = true;
    this.loop.start();
    this.startTimer();

    if (!this.crosshair) {
      this.crosshair = new Crosshair();
      this.camera.instance.add(this.crosshair);
    }

    this.resetTargets();
    this.scene.level(level);
    this.level = level;
  }

  public attachUI(ui: UIController) {
    this.ui = ui;
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    this.controls.setPaused(paused);
  }
}
