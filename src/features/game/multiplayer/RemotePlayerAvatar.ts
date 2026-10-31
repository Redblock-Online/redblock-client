import * as THREE from "three";
import { EYE_HEIGHT } from "./shotProtocol";

/** Shortest signed angle from `from` to `to`, in (-PI, PI]. */
export function shortestAngle(from: number, to: number): number {
  const TWO_PI = Math.PI * 2;
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d <= -Math.PI) d += TWO_PI;
  return d;
}

const HALF_PI = Math.PI / 2;
const clampPitch = (p: number) => Math.max(-HALF_PI + 1e-3, Math.min(HALF_PI - 1e-3, p));

// Cel-shaded palette: same white toon family as targets and the pistol (the renderer's
// screen-space CustomOutlinePass draws the black edges), with the game's red as accent so
// remote players read against the white rooms.
const BODY_COLOR = 0xf2f2f2;
const ACCENT_COLOR = 0xff2a2a;
const DARK_COLOR = 0x1c1c1c;

type PartSpec = { size: [number, number, number]; material: THREE.Material };

/**
 * Shared geometry/material cache. Every avatar reuses the same instances, so creating or
 * removing avatars never allocates GPU resources after the first one.
 */
const shared = (() => {
  let cache: {
    body: THREE.MeshToonMaterial;
    accent: THREE.MeshToonMaterial;
    dark: THREE.MeshBasicMaterial;
    boxes: Map<string, THREE.BoxGeometry>;
  } | null = null;
  return () => {
    if (!cache) {
      cache = {
        body: new THREE.MeshToonMaterial({ color: BODY_COLOR }),
        accent: new THREE.MeshToonMaterial({ color: ACCENT_COLOR }),
        dark: new THREE.MeshBasicMaterial({ color: DARK_COLOR }),
        boxes: new Map(),
      };
    }
    return cache;
  };
})();

function box(size: [number, number, number]): THREE.BoxGeometry {
  const s = shared();
  const key = size.join("x");
  let geom = s.boxes.get(key);
  if (!geom) {
    geom = new THREE.BoxGeometry(size[0], size[1], size[2]);
    s.boxes.set(key, geom);
  }
  return geom;
}

/** A box part using the shared geometry/material caches. */
function part(spec: PartSpec, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(box(spec.size), spec.material);
  mesh.position.set(x, y, z);
  mesh.raycast = () => {};
  return mesh;
}

const SHOULDER = new THREE.Vector3(0.02, 0.6, 0.24);
const AIM_HOLD_SECONDS = 0.25;
const RECOIL_SECONDS = 0.14;
const MAX_AIM_YAW_OFFSET = 0.7;

const _local = new THREE.Vector3();

/**
 * Low-poly remote player: legs, torso, head with visor and a pistol arm.
 *
 * Local frame follows ControlsWithMovement: the group sits at the player's feet, yaw is
 * applied to the whole group about +Y, forward is local +X, right is local +Z. The head
 * and the gun arm pitch about local +Z.
 *
 * @example
 * ```typescript
 * const avatar = new RemotePlayerAvatar();
 * scene.add(avatar);
 * avatar.setTarget(new THREE.Vector3(0, 0, 0), yaw, pitch);
 * avatar.update(dt); // every frame
 * avatar.fire(hitPoint); // on playerShot
 * ```
 */
export default class RemotePlayerAvatar extends THREE.Group {
  public readonly head = new THREE.Group();
  public readonly gunPivot = new THREE.Group();
  public readonly muzzle = new THREE.Object3D();
  private readonly gunRecoil = new THREE.Group();

  private readonly targetPos = new THREE.Vector3();
  private targetYaw = 0;
  private targetPitch = 0;
  private yaw = 0;
  private pitch = 0;
  private aimHold = 0;
  private aimYawOffset = 0;
  private aimPitch = 0;
  private recoil = 0;
  private hasPose = false;

  constructor() {
    super();
    const s = shared();
    const body = { material: s.body };
    const accent = { material: s.accent };
    const dark = { material: s.dark };

    this.add(part({ ...body, size: [0.2, 0.32, 0.3] }, 0, 0.16, 0)); // legs
    this.add(part({ ...body, size: [0.26, 0.34, 0.42] }, 0, 0.5, 0)); // torso
    this.add(part({ ...accent, size: [0.27, 0.06, 0.43] }, 0, 0.42, 0)); // belt stripe

    this.head.position.set(0, EYE_HEIGHT, 0);
    this.head.add(part({ ...body, size: [0.24, 0.24, 0.24] }, -0.02, 0.02, 0));
    this.head.add(part({ ...dark, size: [0.04, 0.07, 0.2] }, 0.11, 0.03, 0)); // visor
    this.add(this.head);

    // Gun arm: pivot at the right shoulder, pointing along +X
    this.gunPivot.position.copy(SHOULDER);
    this.gunPivot.rotation.order = "YXZ";
    this.gunPivot.add(this.gunRecoil);
    this.gunRecoil.add(part({ ...body, size: [0.3, 0.08, 0.08] }, 0.13, 0, 0)); // arm
    this.gunRecoil.add(part({ ...dark, size: [0.07, 0.12, 0.05] }, 0.3, -0.04, 0)); // grip
    this.gunRecoil.add(part({ ...dark, size: [0.22, 0.07, 0.06] }, 0.37, 0.03, 0)); // slide
    this.gunRecoil.add(part({ ...accent, size: [0.03, 0.03, 0.065] }, 0.47, 0.05, 0)); // sight
    this.muzzle.position.set(0.49, 0.03, 0);
    this.gunRecoil.add(this.muzzle);
    this.add(this.gunPivot);
  }

  /** Sets the networked pose to interpolate towards. The first call snaps. */
  public setTarget(position: THREE.Vector3, yaw: number, pitch: number) {
    this.targetPos.copy(position);
    this.targetYaw = yaw;
    this.targetPitch = clampPitch(pitch);
    if (!this.hasPose) this.snap();
  }

  /** Jumps straight to the target pose (spawn, room change). */
  public snap() {
    this.hasPose = true;
    this.position.copy(this.targetPos);
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;
    this.aimPitch = this.pitch;
    this.aimYawOffset = 0;
    this.applyPose();
  }

  /**
   * Plays a shot: turns the body to the shot yaw, aims the gun exactly at `end`, and kicks.
   *
   * @param yaw - Shot yaw (from the shot direction)
   * @param pitch - Shot pitch
   * @param end - World point the tracer ends at
   */
  public fire(yaw: number, pitch: number, end: THREE.Vector3) {
    // Shots are fresher than the last 20 Hz pose, so adopt their orientation immediately
    this.yaw = this.targetYaw = yaw;
    this.pitch = this.targetPitch = clampPitch(pitch);
    this.applyPose();
    this.updateMatrixWorld(true);

    _local.copy(end);
    this.worldToLocal(_local).sub(this.gunPivot.position);
    const horizontal = Math.hypot(_local.x, _local.z);
    this.aimYawOffset = THREE.MathUtils.clamp(Math.atan2(-_local.z, _local.x), -MAX_AIM_YAW_OFFSET, MAX_AIM_YAW_OFFSET);
    this.aimPitch = clampPitch(Math.atan2(_local.y, horizontal));
    this.aimHold = AIM_HOLD_SECONDS;
    this.recoil = 1;
    this.applyPose();
    this.updateMatrixWorld(true);
  }

  /** Writes the muzzle world position into `out`. */
  public getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    this.updateMatrixWorld(true);
    return this.muzzle.getWorldPosition(out);
  }

  /** Advances interpolation, aim hold and recoil. */
  public update(dt: number) {
    const alpha = 1 - Math.exp(-12 * dt);
    this.position.lerp(this.targetPos, alpha);
    if (this.aimHold > 0) {
      this.aimHold = Math.max(0, this.aimHold - dt);
    } else {
      this.yaw += shortestAngle(this.yaw, this.targetYaw) * alpha;
      this.pitch += (this.targetPitch - this.pitch) * alpha;
      this.aimYawOffset += (0 - this.aimYawOffset) * alpha;
      this.aimPitch += (this.pitch - this.aimPitch) * alpha;
    }
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt / RECOIL_SECONDS);
    this.applyPose();
  }

  public get isRecoiling() {
    return this.recoil > 0;
  }

  private applyPose() {
    this.rotation.set(0, this.yaw, 0);
    this.head.rotation.set(0, 0, this.pitch);
    this.gunPivot.rotation.set(0, this.aimYawOffset, this.aimPitch);
    // Recoil: kick the gun back along the barrel and tilt the muzzle up
    const r = this.recoil * this.recoil;
    this.gunRecoil.position.set(-0.07 * r, 0.01 * r, 0);
    this.gunRecoil.rotation.set(0, 0, 0.45 * r);
  }
}
