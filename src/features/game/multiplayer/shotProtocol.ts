/**
 * Wire format and frame math for multiplayer shot events.
 *
 * Coordinate frames:
 * - Every client simulates in one shared world frame. The server assigns each
 *   player a room centre (`room_coord_x/z`); the local player spawns there and
 *   `local_player_position_*` / `targetsInfo` are already world positions, which is
 *   why neighbour avatars and targets are placed with the raw values.
 * - Shots travel **room-local** (world minus the shooter's room centre). That keeps
 *   the numbers small so the server can bounds-check them, and the server attaches
 *   the shooter's authoritative room coords to the relayed `playerShot`. Receivers
 *   add those coords back, which lands the shot in exactly the frame used for the
 *   shooter's avatar and targets.
 * - View direction follows ControlsWithMovement: yaw rotates about +Y (yawObject),
 *   pitch rotates about +Z (pitchObject), and yaw 0 / pitch 0 looks along +X.
 *   forward = (cos(p)·cos(y), sin(p), -cos(p)·sin(y)).
 */

export type Vec3Tuple = [number, number, number];
export type Vec3Like = { x: number; y: number; z: number };
export type RoomCoords = { room_coord_x: number; room_coord_z: number };

/** Payload of the client → server `shot` message (positions room-local). */
export type ShotPayload = {
  origin: Vec3Tuple;
  direction: Vec3Tuple;
  hit?: Vec3Tuple;
  hitTargetIndex?: number;
  t?: number;
};

/** Server → client relay of a neighbour's shot. */
export type PlayerShotMessage = ShotPayload &
  RoomCoords & {
    type: "playerShot";
    id: string;
  };

/** Max shots per second a client sends (the server drops anything above 15/s). */
export const SHOT_SEND_LIMIT_PER_SEC = 15;
/** Tracer length for shots that hit nothing (world units). */
export const SHOT_MAX_TRACER_RANGE = 60;
/** Camera height above the player's feet when standing (ControlsWithMovement.standHeight). */
export const EYE_HEIGHT = 0.8;

const round = (v: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

/** World position → room-local tuple (millimetre precision). */
export function worldToRoomLocal(p: Vec3Like, room: RoomCoords): Vec3Tuple {
  return [round(p.x - room.room_coord_x, 3), round(p.y, 3), round(p.z - room.room_coord_z, 3)];
}

/** Room-local tuple → world position, written into `out`. */
export function roomLocalToWorld<T extends Vec3Like>(local: Vec3Tuple, room: RoomCoords, out: T): T {
  out.x = local[0] + room.room_coord_x;
  out.y = local[1];
  out.z = local[2] + room.room_coord_z;
  return out;
}

/** Yaw/pitch (ControlsWithMovement convention) → unit forward vector. */
export function directionFromYawPitch<T extends Vec3Like>(yaw: number, pitch: number, out: T): T {
  const cp = Math.cos(pitch);
  out.x = cp * Math.cos(yaw);
  out.y = Math.sin(pitch);
  out.z = -cp * Math.sin(yaw);
  return out;
}

/** Unit-ish forward vector → yaw/pitch (ControlsWithMovement convention). */
export function yawPitchFromDirection(d: Vec3Like): { yaw: number; pitch: number } {
  const horizontal = Math.hypot(d.x, d.z);
  return { yaw: Math.atan2(-d.z, d.x), pitch: Math.atan2(d.y, horizontal) };
}

/**
 * Builds the `shot` payload from world-space data.
 *
 * @param origin - Camera world position when firing
 * @param direction - Camera world direction (normalised here)
 * @param room - The shooter's room coords (from `assigned`)
 * @param hit - World-space hit point, if the ray hit something
 * @param hitTargetIndex - Index into the shooter's `targetsInfo` of a broken target
 * @returns The payload, or `null` if the inputs are not finite
 */
export function buildShotPayload(
  origin: Vec3Like,
  direction: Vec3Like,
  room: RoomCoords,
  hit?: Vec3Like | null,
  hitTargetIndex?: number | null,
  t: number = Date.now()
): ShotPayload | null {
  const len = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(len) || len < 1e-6) return null;
  const payload: ShotPayload = {
    origin: worldToRoomLocal(origin, room),
    direction: [round(direction.x / len, 4), round(direction.y / len, 4), round(direction.z / len, 4)],
    t,
  };
  if (hit) {
    payload.hit = worldToRoomLocal(hit, room);
    if (typeof hitTargetIndex === "number" && hitTargetIndex >= 0) payload.hitTargetIndex = hitTargetIndex;
  }
  const values = [...payload.origin, ...payload.direction, ...(payload.hit ?? [])];
  return values.every(Number.isFinite) ? payload : null;
}

/**
 * Resolves a received `playerShot` into world space.
 *
 * @returns origin, direction, end point (hit point or origin + direction × maxRange)
 *          and whether the shot hit something
 */
export function resolveShotWorld<T extends Vec3Like>(
  msg: PlayerShotMessage,
  out: { origin: T; direction: T; end: T },
  maxRange: number = SHOT_MAX_TRACER_RANGE
): { hit: boolean } {
  roomLocalToWorld(msg.origin, msg, out.origin);
  out.direction.x = msg.direction[0];
  out.direction.y = msg.direction[1];
  out.direction.z = msg.direction[2];
  if (msg.hit) {
    roomLocalToWorld(msg.hit, msg, out.end);
    return { hit: true };
  }
  out.end.x = out.origin.x + out.direction.x * maxRange;
  out.end.y = out.origin.y + out.direction.y * maxRange;
  out.end.z = out.origin.z + out.direction.z * maxRange;
  return { hit: false };
}

/** Light structural check for inbound `playerShot` messages. */
export function isPlayerShotMessage(m: unknown): m is PlayerShotMessage {
  if (typeof m !== "object" || m === null) return false;
  const msg = m as Record<string, unknown>;
  const isVec = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((c) => Number.isFinite(c));
  return (
    msg.type === "playerShot" &&
    typeof msg.id === "string" &&
    Number.isFinite(msg.room_coord_x) &&
    Number.isFinite(msg.room_coord_z) &&
    isVec(msg.origin) &&
    isVec(msg.direction) &&
    (msg.hit === undefined || isVec(msg.hit))
  );
}
