import Renderer from "./Renderer";
import Camera from "./Camera";
import MainScene from "@/scenes/MainScene";
import Loop from "./Loop";
import ControlsWithMovement from "@/systems/ControlsWithMovement";
import Crosshair from "@/objects/Crosshair";
import { Raycaster, Vector2 } from "three";
import Pistol from "@/objects/Pistol";
import Cube from "@/objects/Cube";
import WSManager, { type PlayerCore } from "@/utils/ws/WSManager";
import type { UIController } from "@/ui/react/mountUI";

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
    this.ui?.timer.stop("Press Click to start again");
    this.gameRunning = false;
  }

  start() {
    // React UI triggers start via startGame()
  }

  update(deltaTime: number) {
    if (!this.gameRunning) return;
    this.controls.update(deltaTime);
  }

  private raycaster = new Raycaster();
  private mouse = new Vector2(0, 0);
  public checkCrosshairIntersections() {
    this.raycaster.setFromCamera(this.mouse, this.camera.instance);
    // Intersect only the target groups (recursive)
    const intersects = this.raycaster.intersectObjects(
      this.targets as unknown as any[],
      true
    );

    if (intersects.length > 0) {
      const first = intersects[0].object as any;
      // Bubble up to the Cube group
      let node: any = first;
      while (node && !(node instanceof Cube)) node = node.parent;
      const hitTarget = node as Cube | undefined;

      if (hitTarget && hitTarget.shootable && !hitTarget.animating) {
        hitTarget.absorbAndDisappear();

        // Filter valid candidates
        const candidates = this.targets.filter(
          (t) => t.visible && !t.shootable && t !== hitTarget
        );

        // Choose one at random from the candidates
        const randomTarget =
          candidates[Math.floor(Math.random() * candidates.length)];

        // Activate it if it exists
        if (randomTarget) {
          randomTarget.makeShootable();
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
        this.resetTargets();
        this.scene.level(this.level);
        this.startTimer();
        this.gameRunning = true;
      }
      return;
    }

    if (e.button === 0) {
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
}
