import Renderer from "./Renderer";
import Camera from "./Camera";
import MainScene from "../scenes/MainScene";
import Loop from "./Loop";
import ControlsWithMovement from "../systems/ControlsWithMovement";
import StartScreen from "../ui/StartScreen";
import Crosshair from "../objects/Crosshair";
import { Mesh, Raycaster, Vector2 } from "three";
import Pistol from "../objects/Pistol";
import type Cube from "../objects/Cube";
import WSManager, { type PlayerCore } from "../utils/ws/WSManager";

const canvas = document.querySelector("canvas") as HTMLCanvasElement;

export default class App {
  renderer: Renderer;
  camera: Camera;
  scene: MainScene;
  loop: Loop;
  controls: ControlsWithMovement;
  pistol: Pistol;
  timerElement: HTMLElement;
  startTime: number = 0;
  timerInterval: number | null = null;
  level: number = 0;
  targets: Cube[] = [];
  gameRunning: boolean = false;
  wsManager: WSManager;
  ammountOfTargetsSelected: number = 3;

  constructor() {
    this.timerElement = document.getElementById("timer")!;
    this.gameRunning = false;
    this.camera = new Camera();
    this.wsManager = new WSManager();
    this.scene = new MainScene(
      this.targets,
      this.wsManager.getMe()!,
      this.wsManager
    );
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
    this.renderer = new Renderer(this.scene, this.camera.instance, canvas);
    this.controls = new ControlsWithMovement(
      this.targets,
      this.camera.instance,
      canvas,
      this.wsManager,
      () => this.getAmmountOfTargetsSelected
    );
    this.scene.add(this.controls.object);
    this.camera.instance.rotation.set(0, (Math.PI / 2) * 3, 0);
    this.pistol = new Pistol(this.camera.instance, (loadedPistol) => {
      this.camera.instance.add(loadedPistol);
      this.pistol = loadedPistol;
    });
    this.loop = new Loop(
      this.renderer.instance,
      this.scene,
      this.camera.instance,
      this.controls,
      this.pistol
    );

    // Handle resize
    window.addEventListener("resize", () => {
      this.camera.instance.aspect = window.innerWidth / window.innerHeight;
      this.camera.instance.updateProjectionMatrix();
      this.renderer.instance.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener("mousedown", (e) => {
      if (!this.gameRunning && this.level > 0) {
        this.startTimer();
        this.scene.level(this.level);
        this.timerElement.innerHTML = "0.00s";
        this.gameRunning = true;
      }
    });
  }
  startTimer() {
    this.startTime = performance.now();
    this.timerInterval = window.setInterval(() => {
      const elapsed = (performance.now() - this.startTime) / 1000;
      this.timerElement.innerText = `${elapsed.toFixed(2)}s`;
    }, 100);
  }

  stopTimer() {
    this.timerElement.innerHTML += "<br>Press Click to start again";
    this.gameRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  start() {
    new StartScreen(canvas, (level: number) => {
      if (level == 1) this.ammountOfTargetsSelected = 3;
      if (level == 2) this.ammountOfTargetsSelected = 8;
      if (level == 3) this.ammountOfTargetsSelected = 50;

      this.gameRunning = true;
      this.loop.start();
      this.startTimer();
      this.controls.initPointerLock();
      const crosshair = new Crosshair();
      this.camera.instance.add(crosshair);

      this.scene.level(level);
      this.level = level;
      document.addEventListener("mousedown", (e) => {
        if (!this.gameRunning) return;

        if (e.button === 0) {
          this.pistol.shoot();
          this.checkCrosshairIntersections();
        }
      });

      document.addEventListener("click", () => {
        if (document.pointerLockElement !== canvas) {
          canvas.requestPointerLock();
        }
      });
    });
  }

  update(deltaTime: number) {
    if (!this.gameRunning) return;
    this.controls.update(deltaTime);
  }

  private raycaster = new Raycaster();
  private mouse = new Vector2(0, 0);
  public checkCrosshairIntersections() {
    this.raycaster.setFromCamera(this.mouse, this.camera.instance);
    const clickableObjects: Mesh[] = [];
    this.scene.traverse((child) => {
      if (child.type === "Mesh" && child.name === "Target") {
        clickableObjects.push(child as Mesh);
      }
    });

    const intersects = this.raycaster.intersectObjects(clickableObjects, true);

    if (intersects.length > 0) {
      this.targets.forEach((target) => {
        const hit = target.children[0].uuid === intersects[0].object.uuid;

        if (hit && target.shootable && !target.animating) {
          target.absorbAndDisappear();

          // Filter valid candidates
          const candidates = this.targets.filter(
            (t) => t.visible && !t.shootable && t !== target
          );

          //Choose one at random from the candidates
          const randomTarget =
            candidates[Math.floor(Math.random() * candidates.length)];

          // Activate it if it exists
          if (randomTarget) {
            randomTarget.makeShootable();
          }
        }
      });
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
}
