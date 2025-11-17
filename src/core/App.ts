import Renderer from "./Renderer";
import Camera from "./Camera";
import { MainScene } from "@/features/game/scenes";
import Loop from "./Loop";
import { ControlsWithMovement } from "@/features/game/controls";
import { PhysicsSystem } from "@/features/game/physics";
import { Raycaster, Vector2, Vector3, BufferGeometry, Line , LineBasicMaterial, BufferAttribute, Mesh, SphereGeometry, MeshBasicMaterial, Box3, Material } from "three";
import Pistol from "@/objects/Pistol";
import Target from "@/objects/Target";
import WSManager, { type PlayerCore } from "@/utils/ws/WSManager";
import type { UIController } from "@/features/menu";
import { AudioManager, type AudioChannel } from "@/utils/AudioManager";
import { SCENARIOS, type ScenarioConfig, getScenarioById } from "@/config/scenarios";
import type { TimerHint, TimerHintTableRow } from "@/features/game/ui";
import gsap from "gsap";
import type { GeneratorConfig } from "@/features/editor/types/generatorConfig";


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
const CALM_TRACK_NAMES = ["uncausal", "calm"] as const;

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
  generatorMetadata?: Map<string, {
    config: GeneratorConfig;
    position: { x: number; y: number; z: number };
    targets: Target[];
  }>;
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

  private audioManager: AudioManager;
  private completedGenerators = new Set<string>(); // Track which generators have been completed
  private practiceMusicId: string | null = null;
  private currentCalmTrack: (typeof CALM_TRACK_NAMES)[number] | null = null;
  private calmTrackRotationIndex = Math.floor(Math.random() * CALM_TRACK_NAMES.length);
  private practiceMusicTimerId: number | null = null;
  private ambientWindId: string | null = null;

  private getPreferredMusicCategory(): 'none' | 'energy' | 'calm' {
    if (typeof window === 'undefined') return 'calm';
    try {
      const raw = window.localStorage.getItem('audioSettings');
      if (!raw) return 'calm';
      const parsed = JSON.parse(raw) as { musicCategory?: unknown } | null;
      const category = parsed?.musicCategory;
      if (category === 'none' || category === 'energy' || category === 'calm') {
        return category;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[App] Failed to read music preference', error);
      }
    }
    return 'calm';
  }

  constructor(ui?: UIController, options?: { disableServer?: boolean; editorMode?: boolean }) {
    this.ui = ui;
    this.canvas = document.querySelector("canvas") as HTMLCanvasElement;
    this.gameRunning = false;
    // Editor mode should be explicitly set, not inferred from server state
    this.isEditorMode = options?.editorMode ?? false;
    
    console.log("[App] Constructor - options:", options);
    console.log("[App] Constructor - isEditorMode:", this.isEditorMode);
    
    // Initialize audio system
    this.audioManager = AudioManager.getInstance();
    this.loadGameSounds();

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
      // Add pistol to main camera (will adjust position based on FOV)
      this.camera.instance.add(loadedPistol);
      this.pistol = loadedPistol;
      this.pistol.setScene(this.scene);
    });
    this.loop = new Loop(this.renderer.instance,this.scene,this.camera.instance,this.controls,this.pistol,this.collisionSystem,this.camera,this.renderer);
    
    // Setup respawn visual effect callback
    this.controls.setOnRespawnCallback(() => {
      if (this.renderer.respawnEffect) {
        this.renderer.respawnEffect.trigger(0.4); // 0.4 seconds duration
        console.log("[App] Respawn effect triggered");
      }
    });
    
    // Listen for graphics settings changes
    window.addEventListener("graphicsSettingsChanged", ((e: CustomEvent) => {
      const settings = e.detail;
      if (settings.targetFPS !== undefined) {
        this.loop.setTargetFPS(settings.targetFPS);
        console.log(`[App] VSync updated: ${settings.vsync ? settings.targetFPS + ' FPS' : 'Unlimited'}`);
      }
    }) as EventListener);
    
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
   * Load all game sounds
   */
  private async loadGameSounds() {
    try {
      // Pre-warm Web Audio context
      await this.audioManager.resume();
      console.log('[App] Audio context pre-warmed');
      
      await this.audioManager.preloadSounds([
        // Weapon sfx
        ['lazer01_1', '/audio/sfx/events/weapons/pistol/lazer01_1.wav', 'sfx' as AudioChannel],
        ['lazer02_1', '/audio/sfx/events/weapons/pistol/lazer02_1.wav', 'sfx' as AudioChannel],

        // Buttons sfx
        ['btn-click01', '/audio/sfx/ui/buttons/btn-click01.wav', 'ui' as AudioChannel],
        ['btn-click02', '/audio/sfx/ui/buttons/btn-click02.wav', 'ui' as AudioChannel],
        ['btn-click03', '/audio/sfx/ui/buttons/btn-click03.wav', 'ui' as AudioChannel],
        ['btn-hover', '/audio/sfx/ui/buttons/btn-hover.wav', 'ui' as AudioChannel],
        ['swap-tab01', '/audio/sfx/ui/buttons/swap-tab01.wav', 'ui' as AudioChannel],
        ['swap-tab02', '/audio/sfx/ui/buttons/swap-tab02.wav', 'ui' as AudioChannel],

        // Player sfx
        ['steps', '/audio/sfx/events/steps.wav', 'sfx' as AudioChannel],

        // Target feedback
        ['hit01', '/audio/sfx/events/hit-target/hit01.wav', 'sfx' as AudioChannel],

        // Events
        ['escape-event', '/audio/sfx/ui/actions/escape-event.wav', 'ui' as AudioChannel],
        ['falling-of-the-map', '/audio/sfx/events/terrain/falling-of-the-map.wav', 'sfx' as AudioChannel],

        // UI Behavior:
          // Slider
        ['slider-down', '/audio/sfx/ui/slider-change/slider-down.wav', 'ui' as AudioChannel],
        ['slider-up', '/audio/sfx/ui/slider-change/slider-up.wav', 'ui' as AudioChannel],

        // Ambient loops
        ['ambient-wind', '/audio/ambiance/wind01.wav', 'ambient' as AudioChannel],
      ]);
    } catch (error) {
      console.warn('[App] Some sounds failed to load:', error);
    }
  }

  private playPracticeMusic() {
    const preference = this.getPreferredMusicCategory();
    if (preference !== 'calm') {
      if (preference === 'none') {
        this.stopPracticeMusic();
      } else if (process.env.NODE_ENV !== 'production') {
        console.debug('[App] Music preference set to energy - awaiting playlist');
      }
      return;
    }

    const anyCalmTrackActive = CALM_TRACK_NAMES.some((track) => this.audioManager.isPlaying(track));
    if (anyCalmTrackActive) {
      return;
    }
    this.stopPracticeMusic();
    try {
      const nextTrack = CALM_TRACK_NAMES[this.calmTrackRotationIndex];
      this.calmTrackRotationIndex = (this.calmTrackRotationIndex + 1) % CALM_TRACK_NAMES.length;
      const id = this.audioManager.play(nextTrack, {
        channel: 'music',
        volume: 0.3,
        loop: false,
      });
      this.practiceMusicId = id ?? null;
      this.currentCalmTrack = nextTrack;

      // Schedule next track when this one ends (if we have duration info)
      try {
        // Clear any existing timer
        if (this.practiceMusicTimerId !== null) {
          window.clearTimeout(this.practiceMusicTimerId);
          this.practiceMusicTimerId = null;
        }
        const dur = this.audioManager.getSoundDuration(nextTrack);
        if (dur && dur > 0) {
          // Add small padding to ensure track end
          const ms = Math.max(100, Math.floor(dur * 1000));
          this.practiceMusicTimerId = window.setTimeout(() => {
            this.playPracticeMusic();
          }, ms + 50);
        }
      } catch {
        /* ignore scheduling errors */
      }
    } catch (error) {
      console.warn('[App] Failed to start practice music', error);
    }
  }

  private stopPracticeMusic() {
    if (this.practiceMusicId) {
      this.audioManager.stop(this.practiceMusicId);
      this.practiceMusicId = null;
    }
    this.currentCalmTrack = null;
    if (this.practiceMusicTimerId !== null) {
      window.clearTimeout(this.practiceMusicTimerId);
      this.practiceMusicTimerId = null;
    }
    // Ensure all instances are halted if we lost the handle (e.g., during reloads)
    CALM_TRACK_NAMES.forEach((track) => this.audioManager.stopAllByName(track));
  }

  private playAmbientWind() {
    try {
      const isAlreadyActive = this.ambientWindId !== null && this.audioManager.isPlaying('ambient-wind');
      if (isAlreadyActive) {
        return;
      }
      this.stopAmbientWind();
      const id = this.audioManager.play('ambient-wind', {
        channel: 'ambient',
        volume: 0.1,
        loop: true,
      });
      this.ambientWindId = id ?? null;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[App] Failed to start ambient wind loop', error);
      }
    }
  }

  private stopAmbientWind() {
    if (this.ambientWindId) {
      try {
        this.audioManager.stop(this.ambientWindId);
      } catch {
        /* ignore */
      }
      this.ambientWindId = null;
    }
    this.audioManager.stopAllByName('ambient-wind');
  }

  /**
   * Public method to stop practice music (used by UI on exit)
   */
  public stopMusic() {
    this.stopAmbientWind();
    if (this.getPreferredMusicCategory() === 'none') {
      this.stopPracticeMusic();
    }
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
    this.stopAmbientWind();

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
    try {
      this.audioManager.play('hit01', {
        channel: 'sfx',
        volume: 0.8,
        randomizePitch: true,
        pitchJitter: 0.01,
        latencyMs: 50,
      });
    } catch {
      /* ignore */
    }
    hitTarget.absorbAndDisappear();

    // Get the generator ID of the hit target
    const hitGeneratorId = hitTarget.cubeMesh.userData.generatorId as string | undefined;
    console.log(`[App] Hit target from generator: ${hitGeneratorId}`);
    
    // Only consider candidates from the SAME generator
    const candidates = this.targets.filter(
      (t) => t.visible && !t.shootable && !t.animating && t !== hitTarget &&
             t.cubeMesh.userData.generatorId === hitGeneratorId
    );
    
    console.log(`[App] Found ${candidates.length} candidates from same generator`);

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
      if (nextTarget) {
        const nextGeneratorId = nextTarget.cubeMesh.userData.generatorId;
        console.log(`[App] Making next target shootable from generator: ${nextGeneratorId}`);
        nextTarget.makeShootable();
      }
    }

    // Check if any generator was completed
    const newGeneratorsActivated = this.checkGeneratorCompletion(hitTarget);
    
    const remaining = this.targets.some(
      (t) => t.visible && !t.animating && t.shootable
    );
    const remainingCount = this.targets.filter(t => t.visible && !t.animating && t.shootable).length;
    console.log(`[App] Remaining shootable targets: ${remaining} (count: ${remainingCount}), New generators activated: ${newGeneratorsActivated}`);
    
    // Only stop timer if no targets remain AND no new generators were activated
    if (!remaining && !newGeneratorsActivated) {
      // Play celebratory laser sound for hitting the last target
      this.audioManager.play('lazer02_1', { volume: 0.35, startAtMs: 0 });
      
      // DISABLED: Don't stop timer or show stats - let player continue
      // this.stopTimer();
      
      // TargetManager handles all cleanup and pooling automatically
      // No manual dispose needed - the pool manages everything efficiently
      console.log('[App] Level complete. TargetManager stats:', this.scene.targetManager.getStats());
    }

    return "regular";
  }

  get getAmmountOfTargetsSelected() {
    return this.currentScenarioTargetCount;
  }

  /**
   * Check if a generator was completed and execute its events
   * Returns true if new generators were activated
   */
  private checkGeneratorCompletion(hitTarget: Target): boolean {
    const generatorId = hitTarget.cubeMesh.userData.generatorId as string | undefined;
    console.log(`[App] checkGeneratorCompletion - generatorId: ${generatorId}`);
    
    if (!generatorId || !this.generatorMetadata) {
      console.log(`[App] No generatorId or metadata, returning false`);
      return false;
    }
    
    // Skip if already completed
    if (this.completedGenerators.has(generatorId)) {
      console.log(`[App] Generator ${generatorId} already completed, skipping`);
      return false;
    }
    
    const metadata = this.generatorMetadata.get(generatorId);
    if (!metadata) {
      console.log(`[App] No metadata for generator ${generatorId}`);
      return false;
    }
    
    // Check if all targets from this generator are destroyed
    // A target is destroyed if it's invisible (animation completed) or currently animating
    const generatorTargets = metadata.targets;
    const allDestroyed = generatorTargets.every(t => !t.visible || t.animating);
    
    console.log(`[App] Generator ${generatorId} - targets: ${generatorTargets.length}, all destroyed: ${allDestroyed}`);
    console.log(`[App] Target states:`, generatorTargets.map(t => ({ animating: t.animating, visible: t.visible, shootable: t.shootable })));
    
    if (allDestroyed) {
      console.log(`[App] Generator ${generatorId} completed!`);
      this.completedGenerators.add(generatorId);
      
      // Execute onComplete events
      const events = metadata.config.events?.onComplete || [];
      console.log(`[App] Executing ${events.length} events`);
      console.log(`[App] Events:`, events);
      
      let activatedGenerators = false;
      for (const event of events) {
        console.log(`[App] Executing event: ${event.type}, targetGeneratorId: ${'targetGeneratorId' in event ? event.targetGeneratorId : 'N/A'}`);
        
        switch (event.type) {
          case "startGenerator":
            if ('targetGeneratorId' in event && event.targetGeneratorId) {
              this.activateGenerator(event.targetGeneratorId);
              activatedGenerators = true;
            }
            break;
          // Add more event types here
          default:
            console.warn(`[App] Unknown event type: ${event.type}`);
        }
      }
      
      console.log(`[App] Activated generators: ${activatedGenerators}`);
      return activatedGenerators;
    }
    
    return false;
  }
  
  /**
   * Activate a disabled generator
   */
  /**
   * Load a custom map from a .rbonline file
   */
  private async loadCustomMap(mapPath: string): Promise<void> {
    try {
      console.log(`[App] Fetching map from: ${mapPath}`);
      const response = await fetch(mapPath);
      if (!response.ok) {
        throw new Error(`Failed to load map: ${response.statusText}`);
      }
      
      const scenarioData = await response.json();
      console.log(`[App] Loaded scenario:`, scenarioData.name);
      
      // Import the bootstrap function
      const { processScenarioForGame } = await import("@/features/editor/core/gameBootstrap");
      
      // Process the scenario and load it into the game
      await processScenarioForGame(this, scenarioData);
      
      // Targets are already added to app.targets by processScenarioForGame
      // Just update controls reference
      this.controls.updateTargets(this.targets);
      
      console.log(`[App] Custom map loaded with ${this.targets.length} targets`);
    } catch (error) {
      console.error(`[App] Failed to load custom map:`, error);
      // Fallback to procedural generation
      const useHalfSize = this.currentScenarioTargetScale === 0.2;
      this.scene.loadScenario(this.currentScenarioTargetCount, useHalfSize, (Math.PI / 2) * 3);
      this.targets = this.scene.targets;
      this.controls.updateTargets(this.targets);
    }
  }

  /**
   * Load a custom scenario from sessionStorage
   */
  private async loadCustomScenarioFromStorage(scenarioId: string): Promise<void> {
    try {
      console.log(`[App] Loading custom scenario: ${scenarioId}`);
      
      // Get scenario data from sessionStorage
      const storageKey = `scenario-${scenarioId}`;
      const scenarioJson = sessionStorage.getItem(storageKey);
      
      if (!scenarioJson) {
        throw new Error(`Scenario not found in sessionStorage: ${storageKey}`);
      }
      
      const scenarioData = JSON.parse(scenarioJson);
      console.log(`[App] Loaded scenario from storage:`, scenarioData.name);
      
      // Reset game state
      this.resetRoundStats();
      this.ui?.timer.reset();
      this.resetTargets();
      
      // Import the bootstrap function
      const { processScenarioForGame } = await import("@/features/editor/core/gameBootstrap");
      
      // Process the scenario and load it into the game
      await processScenarioForGame(this, scenarioData);
      
      // Targets are already added to app.targets by processScenarioForGame
      // Just update controls reference
      this.controls.updateTargets(this.targets);
      
      // Start the game loop
      this.loop.start();
      
      // Start audio and timer (same as normal scenario start)
      if (!this.isEditorMode) {
        // Background music is controlled by the React UI (UIRoot) playlist controller to avoid double playback
        this.playAmbientWind();
      }
      this.startTimer();
      this.gameRunning = true;
      
      console.log(`[App] Custom scenario loaded with ${this.targets.length} targets`);
      
      // Clean up sessionStorage
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`[App] Failed to load custom scenario:`, error);
      // Fallback to default scenario
      this.startScenarioById(this.scenarios[0].id);
    }
  }

  private activateGenerator(generatorId: string): void {
    console.log(`[App] Activating generator: ${generatorId}`);
    
    if (!this.generatorMetadata) {
      console.warn(`[App] No generator metadata available`);
      return;
    }
    
    const metadata = this.generatorMetadata.get(generatorId);
    if (!metadata) {
      console.warn(`[App] Generator ${generatorId} not found in metadata`);
      return;
    }
    
    // Remove from completed generators so it can be completed again
    this.completedGenerators.delete(generatorId);
    console.log(`[App] Removed generator ${generatorId} from completed list`);
    
    // If generator already has targets, reset and reactivate them
    if (metadata.targets.length > 0) {
      console.log(`[App] Resetting and reactivating ${metadata.targets.length} existing targets`);
      console.log(`[App] Targets before reset:`, metadata.targets.map(t => ({ visible: t.visible, animating: t.animating, shootable: t.shootable })));
      metadata.targets.forEach(target => {
        // Kill any active animations
        if (target.activeTweens) {
          target.activeTweens.forEach(t => t.kill());
          target.activeTweens = [];
        }
        
        // Reset state
        target.visible = true;
        target.animating = false;
        target.shootable = false;
        target.shootableActivatedAt = null;
        
        // Reset transform
        target.scale.set(target.baseScale, target.baseScale, target.baseScale);
        target.rotation.set(0, 0, 0);
        
        // Reset materials opacity
        const cubeMaterial = target.cubeMesh.material as Material & { opacity?: number };
        if (cubeMaterial && 'opacity' in cubeMaterial) cubeMaterial.opacity = 1;
        
        // Reset edge materials
        target.edgesGroup.children.forEach((edge) => {
          const edgeMaterial = (edge as Mesh).material as Material & { opacity?: number };
          if (edgeMaterial && 'opacity' in edgeMaterial) edgeMaterial.opacity = 1;
        });
        
        // Reset color to white
        target.setColor(0xffffff);
      });
      
      // Make first target shootable
      if (metadata.targets.length > 0) {
        metadata.targets[0].makeShootable(0xff0000);
        console.log(`[App] First target reset and made shootable`);
        console.log(`[App] Targets after reset:`, metadata.targets.map(t => ({ visible: t.visible, animating: t.animating, shootable: t.shootable })));
      }
      return;
    }
    
    // Generate new targets for this generator
    const config = metadata.config;
    const generatorPos = metadata.position;
    const targetCount = config.targetCount;
    const targetScale = config.targetScale;
    const bounds = config.type === "randomStatic" ? config.spawnBounds : null;
    
    console.log(`[App] Generating ${targetCount} new targets for generator ${generatorId}`);
    
    const generatorTargets: Target[] = [];
    
    for (let i = 0; i < targetCount; i++) {
      const target = new Target(0xffffff, true, false, targetScale === 0.2);
      
      // Position targets
      let x, y, z;
      if (bounds) {
        x = generatorPos.x + bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        y = generatorPos.y + bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        z = generatorPos.z + bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      } else {
        const angle = (i / targetCount) * Math.PI * 0.8 - Math.PI * 0.4;
        const distance = 3 + Math.random() * 8;
        x = generatorPos.x + Math.cos(angle) * distance;
        y = generatorPos.y + Math.random() * 2;
        z = generatorPos.z + Math.sin(angle) * distance;
      }
      
      target.position.set(x, y, z);
      target.cubeMesh.name = "Target";
      target.cubeMesh.userData.isTarget = true;
      target.cubeMesh.userData.generatorId = generatorId;
      
      this.scene.add(target);
      
      // Add to collision system
      target.updateWorldMatrix(true, true);
      const boundingBox = new Box3().setFromObject(target);
      const collider = {
        min: boundingBox.min.clone(),
        max: boundingBox.max.clone(),
        object: target
      };
      
      this.collisionSystem.waitForInit().then(() => {
        this.collisionSystem.addCollider(collider);
      });
      
      this.targets.push(target);
      generatorTargets.push(target);
    }
    
    // Update metadata with generated targets
    metadata.targets = generatorTargets;
    
    // Make first target shootable
    if (generatorTargets.length > 0) {
      generatorTargets[0].makeShootable(0xff0000);
      console.log(`[App] Generated ${generatorTargets.length} targets, first one is shootable`);
    }
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
    // Don't auto-restart when game ends - let events control the flow
    if (!this.gameRunning) {
      return;
    }

    if (e.button === 0) {
      if (this.paused) return;
      this.recordShotFired();
      
      this.audioManager.play('lazer01_1', { volume: 0.35, startAtMs: 0, randomizePitch: true, pitchJitter: 0.02, maxVoices: 6 });
      
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
    const roundTime: number | null = roundDurationSeconds;

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

  public resetCustomScenarioState(): void {
    // Clear any generator metadata or completion state from previous custom loads
    this.generatorMetadata = new Map();
    this.completedGenerators.clear();

    // Reset target references so fresh custom targets can populate cleanly
    this.targets = [];
    this.scene.targets = this.targets;
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
    // In editor/offline mode, there is no WS 'me'; start immediately
    if (this.isEditorMode) {
      this.startScenarioById(scenarioId);
      return;
    }
    if (!this.wsManager.getMe()) {
      this.wsManager.onMeReady(() => this.startGame(scenarioId));
      return;
    }
    this.startScenarioById(scenarioId);
  }

  private async startScenarioById(scenarioId: string) {
    // Check if this is a custom scenario from localStorage
    if (scenarioId.startsWith('custom-')) {
      console.log(`[App] Loading custom scenario from sessionStorage: ${scenarioId}`);
      await this.loadCustomScenarioFromStorage(scenarioId);
      return;
    }
    
    const scenario = getScenarioById(scenarioId) ?? this.scenarios[0];
    const index = this.scenarios.findIndex((s) => s.id === scenario.id);
    this.currentScenarioIndex = index;
    this.currentScenarioTargetCount = Math.max(1, Math.floor(scenario.targetCount));
    this.currentScenarioTargetScale = scenario.targetScale ?? 0.4;

    this.resetRoundStats();
    this.ui?.timer.reset();

    this.resetTargets();
    
    // Reset player to spawn position and orientation
    // Use scene.me if available, otherwise use default spawn (0, 0, 0)
    const spawnX = this.scene.me?.room_coord_x ?? 0;
    const spawnZ = this.scene.me?.room_coord_z ?? 0;
    const spawnY = 0; // Floor level
    const spawnYaw = (Math.PI / 2) * 3; // Always face same direction (270 degrees)
    
    this.controls.teleportTo(spawnX, spawnY, spawnZ, spawnYaw);
    console.log(`[App] Player reset to spawn: (${spawnX}, ${spawnY}, ${spawnZ}), yaw: ${spawnYaw}`);
    
    // In editor mode, don't generate default targets - custom scenario will be loaded separately
    if (!this.isEditorMode) {
      // Check if scenario has a custom map file
      if (scenario.mapFile) {
        console.log(`[App] Loading custom map from: ${scenario.mapFile}`);
        await this.loadCustomMap(scenario.mapFile);
      } else {
        // Generate procedural targets
        const useHalfSize = scenario.targetScale === 0.2;
        // Pass player orientation to target generation
        this.scene.loadScenario(scenario.targetCount, useHalfSize, spawnYaw);
        
        // Sync targets array after generation (TargetManager updates scene.targets)
        this.targets = this.scene.targets;
        
        // CRITICAL: Also update controls targets reference so it can send correct targetsInfo
        this.controls.updateTargets(this.targets);
        
        this.applyScenarioTargetScale();
        this.setupScenarioPortals();
        
        console.log(`[App] Scenario started with ${this.targets.length} targets`);
        console.log(`[App] Controls now has ${this.targets.length} targets for network sync`);
      }
    }

    this.loop.start();
    if (!this.isEditorMode) {
      // Background music is controlled by the React UI (UIRoot) playlist controller to avoid double playback
      this.playAmbientWind();
    }
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
