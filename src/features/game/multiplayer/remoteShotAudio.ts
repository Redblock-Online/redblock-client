import type { AudioManager, AudioOptions } from "@/utils/AudioManager";
import type { Vec3Like } from "./shotProtocol";

/** Name the remote shot sound is registered under (separate voice pool from local shots). */
export const REMOTE_SHOT_SOUND = "remote-shot";
export const REMOTE_SHOT_URL = "/audio/sfx/events/weapons/pistol/lazer01_1.wav";
/** Local shots play at 0.35; remote ones peak at half of that, before distance falloff. */
export const REMOTE_SHOT_BASE_VOLUME = 0.18;
/** Distance (world units) at which a remote shot is at half volume. */
export const REMOTE_SHOT_HALF_VOLUME_DISTANCE = 12;
export const REMOTE_SHOT_MIN_VOLUME = 0.01;

/**
 * Volume and stereo pan of a remote shot heard from the listener.
 *
 * @param listenerPos - Listener (camera) world position
 * @param listenerRight - Unit vector pointing to the listener's right
 * @param source - Shot origin (world)
 * @returns `volume` in [0, REMOTE_SHOT_BASE_VOLUME] (before channel/master gains, which
 *          AudioManager applies) and `pan` in [-1, 1] (-1 = left)
 */
export function computeRemoteShotAudio(
  listenerPos: Vec3Like,
  listenerRight: Vec3Like,
  source: Vec3Like
): { volume: number; pan: number } {
  const dx = source.x - listenerPos.x;
  const dy = source.y - listenerPos.y;
  const dz = source.z - listenerPos.z;
  const dist = Math.hypot(dx, dy, dz);
  const volume = REMOTE_SHOT_BASE_VOLUME / (1 + dist / REMOTE_SHOT_HALF_VOLUME_DISTANCE);
  if (dist < 1e-6) return { volume, pan: 0 };
  const dot = (dx * listenerRight.x + dy * listenerRight.y + dz * listenerRight.z) / dist;
  // Keep some signal in both ears: full hard-panning sounds odd on headphones
  const pan = Math.max(-1, Math.min(1, dot)) * 0.8;
  return { volume, pan };
}

type AudioLike = Pick<AudioManager, "play" | "loadSound">;

/**
 * Plays remote shot sounds through the shared AudioManager on the `sfx` channel, so
 * the master/sfx volume settings apply. The sample is registered lazily under its own
 * name so its voice limit never cuts the local player's own gunshots.
 */
export class RemoteShotAudio {
  private loadState: "idle" | "loading" | "ready" | "failed" = "idle";

  constructor(private readonly audio: AudioLike | null) {}

  /** Starts loading the sample (call when the first neighbour appears). */
  public preload() {
    if (!this.audio || this.loadState !== "idle") return;
    this.loadState = "loading";
    this.audio
      .loadSound(REMOTE_SHOT_SOUND, REMOTE_SHOT_URL, "sfx")
      .then(() => {
        this.loadState = "ready";
      })
      .catch(() => {
        this.loadState = "failed";
      });
  }

  /** @returns the options passed to AudioManager.play, or null if nothing was played */
  public play(listenerPos: Vec3Like, listenerRight: Vec3Like, source: Vec3Like): AudioOptions | null {
    if (!this.audio) return null;
    if (this.loadState !== "ready") {
      this.preload();
      return null;
    }
    const { volume, pan } = computeRemoteShotAudio(listenerPos, listenerRight, source);
    if (volume < REMOTE_SHOT_MIN_VOLUME) return null;
    const options: AudioOptions = {
      channel: "sfx",
      volume,
      pan,
      randomizePitch: true,
      pitchJitter: 0.04,
      maxVoices: 4,
    };
    try {
      this.audio.play(REMOTE_SHOT_SOUND, options);
    } catch {
      return null;
    }
    return options;
  }
}
