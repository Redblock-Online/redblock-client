import { PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class MovementController {
  private readonly state = {
    forward: false,
    back: false,
    left: false,
    right: false,
  };
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly offset = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly speed: number = 6,
  ) {}

  public handleKeyChange(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return false;
    }

    const key = event.key;
    const isKeyDown = event.type === "keydown";

    if (isKeyDown && (event.ctrlKey || event.metaKey)) {
      return false;
    }
    let handled = false;

    switch (key) {
      case "w":
      case "W":
      case "ArrowUp":
        this.state.forward = isKeyDown;
        handled = true;
        break;
      case "s":
      case "S":
      case "ArrowDown":
        this.state.back = isKeyDown;
        handled = true;
        break;
      case "a":
      case "A":
      case "ArrowLeft":
        this.state.left = isKeyDown;
        handled = true;
        break;
      case "d":
      case "D":
      case "ArrowRight":
        this.state.right = isKeyDown;
        handled = true;
        break;
      default:
        break;
    }

    return handled;
  }

  public clearState(): void {
    this.state.forward = false;
    this.state.back = false;
    this.state.left = false;
    this.state.right = false;
  }

  public update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    const { forward, back, left, right } = this.state;
    if (!forward && !back && !left && !right) {
      return;
    }

    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() === 0) {
      return;
    }
    this.forward.normalize();

    this.right.crossVectors(this.forward, this.worldUp);
    this.right.y = 0;
    if (this.right.lengthSq() > 0) {
      this.right.normalize();
    }

    this.offset.set(0, 0, 0);
    if (forward) this.offset.add(this.forward);
    if (back) this.offset.sub(this.forward);
    if (right) this.offset.add(this.right);
    if (left) this.offset.sub(this.right);

    if (this.offset.lengthSq() === 0) {
      return;
    }

    this.offset.normalize().multiplyScalar(this.speed * deltaSeconds);
    this.camera.position.add(this.offset);
    this.controls.target.add(this.offset);
  }
}
