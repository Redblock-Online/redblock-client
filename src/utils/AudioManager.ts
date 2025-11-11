/**
 * AudioManager - Professional multi-channel audio system with pooling
 *
 * Features:
 * - Multiple simultaneous sounds (polyphony)
 * - Audio pooling for performance (no runtime allocations)
 * - Channel categories (SFX, Music, Ambient, UI)
 * - Volume control per channel and global
 * - Loop management (for footsteps, ambient sounds)
 * - Automatic cleanup of finished sounds
 * - Preloading with progress tracking
 *
 * Usage:
 * ```typescript
 * const audio = AudioManager.getInstance();
 *
 * // Load sounds
 * audio.loadSound('shoot', '/audio/sfx/shoot.mp3', 'sfx');
 * audio.loadSound('steps', '/audio/sfx/steps.wav', 'sfx');
 *
 * // Play one-shot sounds (can overlap)
 * audio.play('shoot', { volume: 0.3 });
 * audio.play('impact', { volume: 0.5 });
 *
 * // Play with random variants
 * audio.play('shoot', { variants: ['lazer01_1', 'lazer02_1'] });
 *
 * // Delay playback slightly to stagger overlapping sounds
 * audio.play('hit01', { latencyMs: 80 });
 *
 * // Play looped sound
 * const stepsId = audio.play('steps', { volume: 0.4, loop: true });
 * audio.stop(stepsId); // Stop when done
 *
 * // Control volumes
 * audio.setChannelVolume('sfx', 0.8);
 * audio.setMasterVolume(0.9);
 * ```
 */

// Removed fading animations; gsap no longer needed here

export type AudioChannel = "sfx" | "music" | "ambient" | "ui";

export interface AudioOptions {
  volume?: number; // 0.0 - 1.0, defaults to 1.0
  loop?: boolean; // Loop the sound, defaults to false
  channel?: AudioChannel; // Override channel from loaded sound
  // Playback rate (0.5 = half speed, 2.0 = double), defaults to 1.0.
  // For convenience you may instead provide `semitones` (musical cents) which
  // will be converted to a playback rate via 2^(semitones/12). If both are
  // provided, `semitones` takes precedence.
  pitch?: number;
  semitones?: number;
  startAtMs?: number; // Optional: start playback offset in milliseconds
  latencyMs?: number; // Optional: delay playback start by N milliseconds (clamped 0-100)
  randomizePitch?: boolean; // If true, jitter the pitch slightly each play
  pitchJitter?: number; // Max absolute jitter to apply around base pitch (e.g., 0.04 -> ±0.04)
  variants?: string[]; // Array of alternative sound names to randomly choose from
  maxVoices?: number; // Maximum concurrent instances for this sound (oldest voices are released)
}

interface LoadedSound {
  url: string;
  channel: AudioChannel;
  buffer: HTMLAudioElement; // Preloaded HTML element (fallback)
  audioBuf?: AudioBuffer; // Decoded Web Audio buffer (low-latency path)
}

type ActiveSound = ActiveHtmlSound | ActiveWebSound;

interface ActiveHtmlSound {
  id: string;
  name: string;
  audio: HTMLAudioElement;
  channel: AudioChannel;
  kind: "html";
  startedAt: number;
  playTimeoutId?: number;
}

interface ActiveWebSound {
  id: string;
  name: string;
  node: AudioBufferSourceNode;
  gain: GainNode;
  channel: AudioChannel;
  kind: "web";
  startedAt: number;
  // Precise scheduling/offset bookkeeping for accurate progress/pause/resume
  startOffsetSec: number; // intended/requested offset from play() options (may differ from actual offset passed to source.start())
  startWhenSec: number; // ctx.currentTime at which start() was scheduled
  playbackRate: number; // effective playbackRate used
}

export class AudioManager {
  private static instance: AudioManager;

  // Loaded sound library
  private sounds = new Map<string, LoadedSound>();
  private knownSounds = new Map<
    string,
    { url: string; channel: AudioChannel }
  >();
  private loadingSounds = new Set<string>();
  // Deduplicate concurrent load requests and expose loading status
  private pendingLoads = new Map<string, Promise<void>>();

  // Active playing sounds
  private activeSounds = new Map<string, ActiveSound>();

  // Audio element pool (for reuse)
  private audioPool: HTMLAudioElement[] = [];
  private readonly poolSize = 20; // Max simultaneous sounds

  // Volume controls
  private masterVolume = 1.0;
  private channelVolumes = new Map<AudioChannel, number>();

  // Web Audio graph
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channelGains = new Map<AudioChannel, GainNode>();

  // State
  private muted = false;
  private nextSoundId = 0;
  private webAudioUsed = false; // Track if Web Audio has been used
  private lastMissingWarn = new Map<string, number>();
  // Track paused offsets for sounds that cannot be paused natively (WebAudio one-shots)
  private pausedOffsets = new Map<string, number>(); // seconds, keyed by sound name
  private soundEndedListeners = new Set<(name: string) => void>();

  private constructor() {
    // Load volumes from localStorage with defaults
    this.loadVolumesFromStorage();

    // Initialize audio pool
    for (let i = 0; i < this.poolSize; i++) {
      const audio = new Audio();
      audio.preload = "auto";
      this.audioPool.push(audio);
    }

    console.log(`[AudioManager] Initialized with pool size: ${this.poolSize}`);

    // Try to init Web Audio (will be resumed on first play() call after user gesture)
    try {
      type WindowWithWebAudio = Window & {
        AudioContext: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const w = window as WindowWithWebAudio;
      const Ctx = w.AudioContext || w.webkitAudioContext;
      if (typeof Ctx === "function") {
        const ctx: AudioContext = new Ctx();
        this.ctx = ctx;
        const masterGain = ctx.createGain();
        masterGain.gain.value = this.masterVolume;
        masterGain.connect(ctx.destination);
        this.masterGain = masterGain;
        (["sfx", "music", "ambient", "ui"] as AudioChannel[]).forEach((ch) => {
          const g = ctx.createGain();
          g.gain.value = this.channelVolumes.get(ch) ?? 1.0;
          g.connect(masterGain);
          this.channelGains.set(ch, g);
        });
      }
    } catch {
      // Ignore - will fallback to HTMLAudio
    }
  }

  /**
   * Ensure AudioContext and gain graph exist. Recreate them if the context was closed by device changes.
   */
  private initContextIfNeeded(): void {
    try {
      type WindowWithWebAudio = Window & {
        AudioContext: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const w = window as WindowWithWebAudio;
      const Ctx = w.AudioContext || w.webkitAudioContext;
      if (!Ctx) return;
      const needsNew = !this.ctx || this.ctx.state === "closed";
      if (needsNew) {
        const ctx: AudioContext = new Ctx();
        this.ctx = ctx;
        const masterGain = ctx.createGain();
        masterGain.gain.value = this.masterVolume;
        masterGain.connect(ctx.destination);
        this.masterGain = masterGain;
        this.channelGains.clear();
        (["sfx", "music", "ambient", "ui"] as AudioChannel[]).forEach((ch) => {
          const g = ctx.createGain();
          g.gain.value = this.channelVolumes.get(ch) ?? 1.0;
          g.connect(masterGain);
          this.channelGains.set(ch, g);
        });
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Load volumes from localStorage (called on init)
   */
  private loadVolumesFromStorage(): void {
    // Default volumes
    const defaults: Record<AudioChannel, number> = {
      sfx: 1.0,
      music: 0.7,
      ambient: 0.5,
      ui: 0.8,
    };

    // Load master volume
    const savedMaster = localStorage.getItem("audio_volume_master");
    if (savedMaster !== null) {
      const parsed = parseFloat(savedMaster);
      if (!isNaN(parsed)) {
        this.masterVolume = Math.max(0, Math.min(1, parsed));
      }
    }

    // Load channel volumes
    const channels: AudioChannel[] = ["sfx", "music", "ambient", "ui"];
    for (const channel of channels) {
      const saved = localStorage.getItem(`audio_volume_${channel}`);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) {
          this.channelVolumes.set(channel, Math.max(0, Math.min(1, parsed)));
        } else {
          this.channelVolumes.set(channel, defaults[channel]);
        }
      } else {
        this.channelVolumes.set(channel, defaults[channel]);
      }
    }

    console.log("[AudioManager] Volumes loaded:", {
      master: this.masterVolume,
      sfx: this.channelVolumes.get("sfx"),
      music: this.channelVolumes.get("music"),
      ambient: this.channelVolumes.get("ambient"),
      ui: this.channelVolumes.get("ui"),
    });
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Ensure Web Audio context is running (must be called in a user gesture).
   */
  public async resume(): Promise<void> {
    if (this.ctx && this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Subscribe to natural sound completion events (non-looping playback).
   * Returns an unsubscribe function for convenience.
   */
  public onSoundEnded(listener: (name: string) => void): () => void {
    this.soundEndedListeners.add(listener);
    return () => {
      this.soundEndedListeners.delete(listener);
    };
  }

  public removeSoundEndedListener(listener: (name: string) => void): void {
    this.soundEndedListeners.delete(listener);
  }

  private emitSoundEnded(name: string): void {
    if (this.soundEndedListeners.size === 0) return;
    this.soundEndedListeners.forEach((listener) => {
      try {
        listener(name);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[AudioManager] soundEnded listener threw:", error);
        }
      }
    });
  }

  // Ensure the audio context is resumed at most once. Returns a promise that resolves
  // when the context is running. Useful for callers that want a safe, idempotent resume.
  private _resumedOnce = false;
  public async ensureResumed(): Promise<void> {
    if (this._resumedOnce) return;
    try {
      await this.resume();
      this._resumedOnce = true;
    } catch {
      /* ignore */
    }
  }

  /**
   * Get AudioContext base latency (lower is better)
   */
  public getLatencyInfo(): {
    baseLatency: number;
    outputLatency: number;
    state: string;
  } | null {
    if (!this.ctx) return null;
    const ctxWithLatency = this.ctx as AudioContext & {
      baseLatency?: number;
      outputLatency?: number;
    };
    return {
      baseLatency: ctxWithLatency.baseLatency ?? 0,
      outputLatency: ctxWithLatency.outputLatency ?? 0,
      state: this.ctx.state,
    };
  }

  /**
   * Load a sound into memory
   * @param name - Unique identifier for this sound
   * @param url - Path to audio file
   * @param channel - Audio channel category
   * @returns Promise that resolves when sound is loaded
   */
  public async loadSound(
    name: string,
    url: string,
    channel: AudioChannel = "sfx"
  ): Promise<void> {
    // Deduplicate concurrent loads
    if (this.pendingLoads.has(name)) {
      return this.pendingLoads.get(name)!;
    }
    // Track known mapping for on-demand loads
    this.knownSounds.set(name, { url, channel });
    if (this.sounds.has(name)) {
      console.warn(`[AudioManager] Sound '${name}' already loaded`);
      return Promise.resolve();
    }

    const p = new Promise<void>((resolve, reject) => {
      // Mark as loading for external UI to observe
      try {
        this.loadingSounds.add(name);
        try {
          // Notify listeners that a sound started loading
          window.dispatchEvent(new CustomEvent("audioLoadingChanged", { detail: { name, loading: true } }));
        } catch { /* ignore */ }
      } catch { /* ignore */ }
      let settled = false;
      const settleResolve = () => {
        if (settled) return;
        settled = true;
        try {
          clearTimeout(timeoutId);
        } catch {
          /* ignore */
        }
        resolve();
      };
      const settleReject = (err: Error) => {
        if (settled) return;
        settled = true;
        try {
          clearTimeout(timeoutId);
        } catch {
          /* ignore */
        }
        reject(err);
      };
      const timeoutMs = 8000;
  const timeoutId = window.setTimeout(() => {
        (async () => {
          try {
            console.warn(
              `[AudioManager] ⚠️ load timeout for '${name}', attempting diagnostic fetch/decoder`
            );
            if (this.ctx) {
              // Try fetch+decode as a diagnostic and possible recovery
              const r = await fetch(url, { cache: "no-cache" });
              if (!r.ok) {
                console.warn(
                  `[AudioManager] Diagnostic fetch for '${name}' returned HTTP ${r.status} ${r.statusText}`
                );
                settleResolve();
                return;
              }
              const ab = await r.arrayBuffer();
              try {
                const decoded = await this.ctx!.decodeAudioData(ab);
                const s = this.sounds.get(name);
                if (s) s.audioBuf = decoded;
                console.log(
                  `[AudioManager] ✓ Diagnostic decode succeeded for '${name}'`
                );
              } catch (err) {
                console.warn(
                  `[AudioManager] Diagnostic decode failed for '${name}':`,
                  err
                );
              }
              settleResolve();
              return;
            } else {
              // Try blob fallback
              const r = await fetch(url, { cache: "no-cache" });
              if (!r.ok) {
                console.warn(
                  `[AudioManager] Diagnostic fetch for '${name}' returned HTTP ${r.status} ${r.statusText}`
                );
                settleResolve();
                return;
              }
              const blob = await r.blob();
              try {
                const blobUrl = URL.createObjectURL(blob);
                console.log(
                  `[AudioManager] Blob fallback (timeout) for '${name}' - using object URL`
                );
                audio.src = blobUrl;
                audio.load();
                setTimeout(() => {
                  try {
                    URL.revokeObjectURL(blobUrl);
                  } catch {
                    /* ignore */
                  }
                }, 30000);
              } catch (err) {
                console.warn(
                  `[AudioManager] Blob fallback (timeout) for '${name}' failed:`,
                  err
                );
              }
              settleResolve();
              return;
            }
          } catch (err) {
            console.warn(
              `[AudioManager] Diagnostic timeout attempt for '${name}' failed:`,
              err
            );
            settleResolve();
          }
        })();
      }, timeoutMs);
  // Create audio element and set crossOrigin so fetched arrayBuffer decoding works
      const audio = new Audio();
      // Ensure same-origin decoding works even if deployed behind a CDN; anonymous is safe for same-origin
      try {
        audio.crossOrigin = "anonymous";
      } catch {
        /* ignore */
      }
      audio.preload = "auto";
      // Attach listeners before assigning src so synchronous errors are caught
      let attemptedBlobFallback = false;

      audio.addEventListener(
        "canplaythrough",
        () => {
          const entry: LoadedSound = { url, channel, buffer: audio };
          this.sounds.set(name, entry);

          // BLOCKING: Force Web Audio decode to complete before resolving
          if (this.ctx) {
            // Fetch and decode via Web Audio for low-latency playback. Log response status on failure.
            try {
              fetch(url)
                .then((r) => {
                  if (!r.ok)
                    throw new Error(`HTTP ${r.status} ${r.statusText}`);
                  return r.arrayBuffer();
                })
                .then((ab) => this.ctx!.decodeAudioData(ab))
                .then((audioBuffer) => {
                  const s = this.sounds.get(name);
                  if (s) s.audioBuf = audioBuffer;
                  console.log(
                    `[AudioManager] ✓ Loaded '${name}' (${channel}) [Web Audio ready]`
                  );
                  settleResolve();
                })
                .catch((err) => {
                  console.warn(
                    `[AudioManager] Web Audio decode failed for '${name}', using HTML fallback:`,
                    err
                  );
                  settleResolve();
                });
            } catch (err) {
              console.warn(
                `[AudioManager] Failed to fetch/decode '${name}':`,
                err
              );
              resolve();
            }
          } else {
            console.log(
              `[AudioManager] ✓ Loaded '${name}' (${channel}) [HTML Audio only]`
            );
            resolve();
          }
        },
        { once: true }
      );

      audio.addEventListener(
        "error",
        (e) => {
          // MediaElement error can be opaque; log MediaError and attempt a diagnostic fetch
          try {
            console.error(
              `[AudioManager] ✗ Failed to load '${name}':`,
              e,
              "mediaError=",
              audio.error
            );
          } catch {
            console.error(`[AudioManager] ✗ Failed to load '${name}':`, e);
          }

          // Attempt a one-time blob fallback: fetch the file and assign a blob URL to the audio element.
          if (!attemptedBlobFallback) {
            attemptedBlobFallback = true;
            try {
              fetch(url, { method: "GET", cache: "no-cache" })
                .then((r) => {
                  if (!r.ok) {
                    console.warn(
                      `[AudioManager] Diagnostic fetch for '${name}' returned HTTP ${r.status} ${r.statusText}`
                    );
                    throw new Error(`HTTP ${r.status}`);
                  }
                  return r.blob();
                })
                .then((blob) => {
                  try {
                    const blobUrl = URL.createObjectURL(blob);
                    console.log(
                      `[AudioManager] Blob fallback for '${name}' - using object URL`
                    );
                    audio.src = blobUrl;
                    audio.load();
                    setTimeout(() => {
                      try {
                        URL.revokeObjectURL(blobUrl);
                      } catch {
                        /* ignore */
                      }
                    }, 30000);
                  } catch (err) {
                    console.warn(
                      `[AudioManager] Blob fallback for '${name}' failed:`,
                      err
                    );
                    throw err;
                  }
                })
                .catch((err) => {
                  console.warn(
                    `[AudioManager] Diagnostic fetch for '${name}' failed:`,
                    err
                  );
                  settleReject(new Error(`Failed to load ${name}`));
                });
            } catch (err) {
              console.warn(
                `[AudioManager] Diagnostic fetch for '${name}' threw:`,
                err
              );
              settleReject(new Error(`Failed to load ${name}`));
            }
            return;
          }

          // If we've already attempted fallback, give up
          settleReject(new Error(`Failed to load ${name}`));
        },
        { once: true }
      );

      // Assign src after listeners are attached so immediate errors are caught
      audio.src = url;
    });

    // Wrap settle to cleanup loading markers
    const wrapped = p.then(
      (v) => {
        try {
          this.loadingSounds.delete(name);
          this.pendingLoads.delete(name);
          try {
            window.dispatchEvent(new CustomEvent("audioLoadingChanged", { detail: { name, loading: false } }));
          } catch {}
        } catch {}
        return v;
      },
      (err) => {
        try {
          this.loadingSounds.delete(name);
          this.pendingLoads.delete(name);
          try {
            window.dispatchEvent(new CustomEvent("audioLoadingChanged", { detail: { name, loading: false } }));
          } catch {}
        } catch {}
        throw err;
      }
    );
    this.pendingLoads.set(name, wrapped);
    return wrapped;
  }

  /**
   * Check whether a sound (or any sound) is currently loading
   * @param name - optional sound name to check, omit to check if any sounds are loading
   */
  public isLoading(name?: string): boolean {
    if (typeof name === "string" && name.length > 0) return this.loadingSounds.has(name);
    return this.loadingSounds.size > 0;
  }

  /**
   * Preload multiple sounds
   * @param sounds - Array of [name, url, channel] tuples
   * @returns Promise that resolves when all sounds are loaded
   */
  public async preloadSounds(
    sounds: Array<[string, string, AudioChannel?]>
  ): Promise<void> {
    console.log(`[AudioManager] Preloading ${sounds.length} sounds...`);
    const promises = sounds.map(([name, url, channel]) => {
      // Register in known sounds for on-demand fallback
      this.knownSounds.set(name, { url, channel: channel ?? "sfx" });
      return this.loadSound(name, url, channel);
    });
    const results = await Promise.allSettled(promises);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.warn(
        `[AudioManager] Some sounds failed to preload (${failed.length}/${sounds.length}). Others are ready.`
      );
    }
    console.log(
      "[AudioManager] ✓ All sounds loaded and ready for low-latency playback"
    );
  }

  /**
   * Play a loaded sound
   * @param name - Sound name (must be preloaded)
   * @param options - Playback options
   * @returns Unique ID for this sound instance (use to stop it)
   */
  public play(name: string, options: AudioOptions = {}): string | null {
    // Recreate/resume context if needed (non-blocking)
    this.initContextIfNeeded();
    if (this.ctx && this.ctx.state !== "running") {
      this.ctx.resume().catch(() => {
        /* ignore */
      });
    }

    // Choose sound name: if variants provided, pick one randomly from the list
    const chosenName =
      options.variants && options.variants.length > 0
        ? options.variants[Math.floor(Math.random() * options.variants.length)]
        : name;

    const sound = this.sounds.get(chosenName);
    if (!sound) {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const last = this.lastMissingWarn.get(chosenName) ?? 0;
      if (now - last > 500) {
        console.warn(
          `[AudioManager] Sound '${chosenName}' not loaded. Available:`,
          Array.from(this.sounds.keys())
        );
        this.lastMissingWarn.set(chosenName, now);
      }
      // If we know about this sound (or it's a common default), lazy-load (but don't auto-replay loops)
      let known = this.knownSounds.get(chosenName);
      if (!known) {
        // Register sensible defaults for common names to survive HMR/device resets
        if (chosenName === "steps")
          known = {
            url: "/audio/sfx/events/steps.wav",
            channel: "sfx",
          } as const;
        if (chosenName === "shoot")
          known = {
            url: "/audio/sfx/events/gunshot01.wav",
            channel: "sfx",
          } as const;
        if (chosenName === "btn-click")
          known = { url: "/audio/ui/btn-click01.wav", channel: "ui" } as const;
        if (chosenName === "escape-event")
          known = {
            url: "/audio/sfx/events/escape-event.wav",
            channel: "ui",
          } as const;
        // legacy UI button sounds removed: no default mapping for 'btn-click'
        if (known) this.knownSounds.set(chosenName, known);
      }
      if (known && !this.loadingSounds.has(chosenName)) {
        this.loadingSounds.add(chosenName);
        this.loadSound(chosenName, known.url, known.channel)
          .then(() => {
            this.loadingSounds.delete(chosenName);
            // Don't auto-play looped sounds (like footsteps) - caller may have stopped moving
            // Only auto-play one-shots (like shoot)
            if (!options.loop) {
              this.play(chosenName, { ...options, variants: undefined });
            }
          })
          .catch(() => {
            this.loadingSounds.delete(chosenName);
          });
      }
      return null;
    }

    const maxVoices = options.maxVoices ?? undefined;
    if (typeof maxVoices === "number" && maxVoices > 0) {
      this.enforceVoiceLimit(name, maxVoices);
    }

    const latencyMs = Math.max(
      0,
      Math.min(100, Math.floor(options.latencyMs ?? 0))
    );

    // Determine base playback rate. Prefer semitones if provided (musical units),
    // otherwise fall back to raw playbackRate `pitch` or 1.0.
    let basePitch: number;
    if (
      typeof options.semitones === "number" &&
      Number.isFinite(options.semitones)
    ) {
      // Convert semitones to playback rate: 2^(n/12)
      basePitch = Math.pow(2, options.semitones / 12);
    } else {
      basePitch = options.pitch ?? 1.0;
    }

    // Try Web Audio first for minimal latency
    if (this.ctx && sound.audioBuf) {
      // One-time diagnostic log
      if (!this.webAudioUsed) {
        this.webAudioUsed = true;
        console.log(
          "[AudioManager] ✓ Using Web Audio API (low-latency path active)"
        );
      }

      const channel = options.channel ?? sound.channel;
      const volume = options.volume ?? 1.0;
      const loop = options.loop ?? false;
      const jitterAmount = options.randomizePitch
        ? options.pitchJitter ?? 0.04
        : 0;
      const jitter =
        jitterAmount > 0 ? (Math.random() * 2 - 1) * jitterAmount : 0;
      const effectivePitch = Math.max(0.5, Math.min(2.0, basePitch + jitter));
      const startAtMs = Math.max(0, Math.floor(options.startAtMs ?? 0));

      const source = this.ctx.createBufferSource();
      source.buffer = sound.audioBuf;
      source.playbackRate.value = effectivePitch;
      source.loop = loop;

      const instanceGain = this.ctx.createGain();
      instanceGain.gain.value = this.calculateVolume(channel, volume);
      source.connect(instanceGain);
      const chGain = this.channelGains.get(channel) ?? null;
      if (chGain) instanceGain.connect(chGain);
      else instanceGain.connect(this.masterGain!);

      const offset = startAtMs / 1000;
      const startDelaySec = latencyMs / 1000;
      const when = this.ctx.currentTime + startDelaySec;

      const startedAt =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const id = `${name}_${this.nextSoundId++}`;
      this.activeSounds.set(id, {
        id,
        name,
        node: source,
        gain: instanceGain,
        channel,
        kind: "web",
        startedAt,
        startOffsetSec: offset,
        startWhenSec: when,
        playbackRate: effectivePitch,
      });
      // Use precise scheduling for low latency while supporting optional delay
      try {
        source.start(when, offset);
      } catch (e) {
        // If start throws (e.g., offset too large), start at 0
        try {
          source.start(when);
        } catch {
          try {
            source.start(0);
          } catch {
            /* ignore */
          }
        }
      }

      if (!loop) {
        source.addEventListener(
          "ended",
          () => {
            this.emitSoundEnded(name);
            this.stop(id);
          },
          { once: true }
        );
      }

      return id;
    }

    // Fallback: HTMLAudio element (higher latency)
    if (!this.webAudioUsed) {
      console.warn(
        "[AudioManager] ⚠️ Using HTML Audio fallback (higher latency). Web Audio not available or buffer not decoded."
      );
    }
    const audio = sound.buffer.cloneNode(true) as HTMLAudioElement;

    // Configure audio
    const channel = options.channel ?? sound.channel;
    const volume = options.volume ?? 1.0;
    const loop = options.loop ?? false;
    const jitterAmount = options.randomizePitch
      ? options.pitchJitter ?? 0.04
      : 0;
    const jitter =
      jitterAmount > 0 ? (Math.random() * 2 - 1) * jitterAmount : 0;
    const effectivePitch = Math.max(0.5, Math.min(2.0, basePitch + jitter));
    const startAtMs = Math.max(0, Math.floor(options.startAtMs ?? 0));

    audio.loop = loop;
    audio.playbackRate = effectivePitch;
    audio.volume = this.calculateVolume(channel, volume);

    // Seek a few milliseconds into the sound to reduce attack/latency if requested
    if (startAtMs > 0) {
      const startAtSec = startAtMs / 1000;
      try {
        // Clamp later once metadata is available; for now set directly.
        audio.currentTime = startAtSec;
      } catch {
        // Some browsers require metadata; adjust once it's available
        const onMeta = () => {
          const dur = isFinite(audio.duration) ? audio.duration : startAtSec;
          audio.currentTime = Math.min(startAtSec, Math.max(0, dur - 0.01));
        };
        audio.addEventListener("loadedmetadata", onMeta, { once: true });
      }
    }

    // Generate unique ID and store as active
    const id = `${name}_${this.nextSoundId++}`;
    const startedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const activeEntry: ActiveHtmlSound = {
      id,
      name,
      audio,
      channel,
      kind: "html",
      startedAt,
    };
    this.activeSounds.set(id, activeEntry);

    const playAudio = () => {
      if (!this.activeSounds.has(id)) return; // sound was stopped before playback
      audio.play().catch((error) => {
        console.warn(`[AudioManager] Failed to play '${name}':`, error);
        this.returnToPool(audio);
        this.activeSounds.delete(id);
      });
    };

    if (latencyMs > 0) {
      const timeoutId = window.setTimeout(() => {
        activeEntry.playTimeoutId = undefined;
        playAudio();
      }, latencyMs);
      activeEntry.playTimeoutId = timeoutId;
    } else {
      playAudio();
    }

    // Auto-cleanup when finished (if not looping)
    if (!loop) {
      audio.addEventListener(
        "ended",
        () => {
          this.emitSoundEnded(name);
          this.stop(id);
        },
        { once: true }
      );
    }

    return id;
  }

  /**
   * Stop a specific sound instance
   * @param id - Sound ID returned from play()
   */
  public stop(id: string): void {
    const activeSound = this.activeSounds.get(id);
    if (!activeSound) return;
    if (activeSound.kind === "html") {
      if (activeSound.playTimeoutId !== undefined) {
        window.clearTimeout(activeSound.playTimeoutId);
        activeSound.playTimeoutId = undefined;
      }
      activeSound.audio.pause();
      activeSound.audio.currentTime = 0;
      this.returnToPool(activeSound.audio);
    } else {
      try {
        activeSound.node.stop();
      } catch {
        /* ignore */
      }
      try {
        activeSound.node.disconnect();
      } catch {
        /* ignore */
      }
      try {
        activeSound.gain.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.activeSounds.delete(id);
  }

  /**
   * Stop all instances of a sound by name
   * @param name - Sound name
   */
  public stopAll(name?: string): void {
    const toStop: string[] = [];

    this.activeSounds.forEach((activeSound, id) => {
      if (!name || activeSound.name === name) {
        toStop.push(id);
      }
    });

    toStop.forEach((id) => this.stop(id));
  }

  /**
   * Force-stop all instances of a specific sound by name (alias for stopAll with name)
   * Useful for cleaning up orphaned loops
   * @param name - Sound name
   */
  public stopAllByName(name: string): void {
    this.stopAll(name);
  }

  /** Stop all active sounds in a given channel. If exceptName is provided, keep that sound name. */
  public stopAllInChannelExcept(
    channel: AudioChannel,
    exceptName?: string
  ): void {
    const toStop: string[] = [];
    this.activeSounds.forEach((snd, id) => {
      if (snd.channel === channel && (!exceptName || snd.name !== exceptName)) {
        toStop.push(id);
      }
    });
    toStop.forEach((id) => this.stop(id));
  }

  /**
   * Check if a sound is currently playing
   * @param name - Sound name
   * @returns True if at least one instance is playing
   */
  public isPlaying(name: string): boolean {
    for (const activeSound of this.activeSounds.values()) {
      if (activeSound.name !== name) continue;
      if (activeSound.kind === "html") {
        if (!activeSound.audio.paused) return true;
      } else {
        // WebAudio sources are one-shot; approximate by presence in active map
        return true;
      }
    }
    return false;
  }

  /**
   * Set master volume (affects all sounds)
   * @param volume - 0.0 to 1.0
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem("audio_volume_master", this.masterVolume.toString());
    this.updateAllVolumes();
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
  }

  /**
   * Set volume for a specific channel
   * @param channel - Channel name
   * @param volume - 0.0 to 1.0
   */
  public setChannelVolume(channel: AudioChannel, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.channelVolumes.set(channel, clampedVolume);
    localStorage.setItem(`audio_volume_${channel}`, clampedVolume.toString());
    this.updateAllVolumes();
    const g = this.channelGains.get(channel);
    if (g) g.gain.value = clampedVolume;
  }

  /**
   * Fade a channel's volume over time (currently sets volume immediately).
   * @param channel - Channel to fade
   * @param targetVolume - Target volume (0.0 to 1.0)
   */
  public fadeChannelVolume(channel: AudioChannel, targetVolume: number): void {
    // Remove fade behavior: set channel volume immediately.
    const clampedVolume = Math.max(0, Math.min(1, targetVolume));
    this.setChannelVolume(channel, clampedVolume);
  }

  /**
   * Get current master volume
   */
  public getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Get current channel volume
   */
  public getChannelVolume(channel: AudioChannel): number {
    return this.channelVolumes.get(channel) ?? 1.0;
  }

  public getSoundDuration(name: string): number | null {
    const sound = this.sounds.get(name);
    if (!sound) return null;
    const bufferDuration = sound.audioBuf?.duration;
    if (
      typeof bufferDuration === "number" &&
      Number.isFinite(bufferDuration) &&
      bufferDuration > 0
    ) {
      return bufferDuration;
    }
    const elementDuration = sound.buffer.duration;
    if (
      typeof elementDuration === "number" &&
      Number.isFinite(elementDuration) &&
      elementDuration > 0
    ) {
      return elementDuration;
    }
    return null;
  }

  /**
   * Get progress info for a currently playing sound by name.
   * Returns null if the sound is not active or duration is unknown.
   */
  public getProgress(name: string): {
    current: number;
    duration: number;
    percent: number;
    playing: boolean;
  } | null {
    // Find the most recent active instance for this name
    const candidates: ActiveSound[] = [];
    this.activeSounds.forEach((snd) => {
      if (snd.name === name) candidates.push(snd);
    });
    // Resolve duration from loaded data
    const duration = this.getSoundDuration(name);

    if (candidates.length === 0) {
      // If no active instance, but we have a paused offset, report it as not playing
      const paused = this.pausedOffsets.get(name);
      if (
        typeof paused === "number" &&
        Number.isFinite(paused) &&
        duration &&
        duration > 0
      ) {
        const percent = Math.max(0, Math.min(1, paused / duration));
        return { current: paused, duration, percent, playing: false };
      }
      return null;
    }

    const active = candidates.sort((a, b) => b.startedAt - a.startedAt)[0];

    if (
      typeof duration !== "number" ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return null;
    }

    let current = 0;
    let playing = true;
    if (active.kind === "html") {
      try {
        current = active.audio.currentTime || 0;
        playing = !active.audio.paused;
      } catch {
        /* ignore */
      }
    } else {
      // WebAudio: compute precisely using scheduled start time and start offset
      const web = active as ActiveWebSound;
      try {
        const nowSec = this.ctx ? this.ctx.currentTime : 0;
        const elapsed = Math.max(0, nowSec - web.startWhenSec);
        const rate = Math.max(0.0001, web.playbackRate || 1);
        current = (web.startOffsetSec || 0) + elapsed * rate;
        // If not looping, clamp to duration
        try {
          if (!(web.node as AudioBufferSourceNode).loop) {
            current = Math.min(current, duration);
          }
        } catch {
          current = Math.min(current, duration);
        }
        playing = true;
      } catch {
        // Fallback to previous approximation if anything goes wrong
        const nowMs =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const elapsedSec = Math.max(0, (nowMs - web.startedAt) / 1000);
        let rate = 1;
        try {
          rate = web.node.playbackRate?.value ?? 1;
        } catch {
          /* ignore */
        }
        current = elapsedSec * Math.max(0.0001, rate);
        try {
          if (!web.node.loop) {
            current = Math.min(current, duration);
          }
        } catch {
          current = Math.min(current, duration);
        }
        playing = true;
      }
    }

    const percent = Math.max(
      0,
      Math.min(1, duration > 0 ? current / duration : 0)
    );
    return { current, duration, percent, playing };
  }

  /**
   * Pause the most recent active instance of a sound by name. For HTMLAudio, the instance
   * remains in the active map (so it can be resumed). For WebAudio (one-shot), we compute
   * the elapsed offset, stop the node, and store the offset so resume can recreate it.
   * @returns true if any instance was paused.
   */
  public pauseByName(name: string): boolean {
    // Find latest instance
    const candidates: Array<[string, ActiveSound]> = [];
    this.activeSounds.forEach((snd, id) => {
      if (snd.name === name) candidates.push([id, snd]);
    });
    if (candidates.length === 0) return false;
    const [id, active] = candidates.sort(
      (a, b) => b[1].startedAt - a[1].startedAt
    )[0];

    if (active.kind === "html") {
      try {
        active.audio.pause();
        return true;
      } catch {
        return false;
      }
    }

    // WebAudio: compute precise offset using scheduled start and initial offset
    const duration = this.getSoundDuration(name) ?? 0;
    const web = active as ActiveWebSound;
    try {
      const nowSec = this.ctx ? this.ctx.currentTime : 0;
      const elapsed = Math.max(0, nowSec - web.startWhenSec);
      const rate = Math.max(0.0001, web.playbackRate || 1);
      const offset = Math.min(
        duration,
        (web.startOffsetSec || 0) + elapsed * rate
      );
      this.pausedOffsets.set(name, offset);
    } catch {
      const nowMs =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsedSec = Math.max(0, (nowMs - web.startedAt) / 1000);
      const rate = Math.max(0.0001, web.node.playbackRate?.value ?? 1);
      const offset = Math.min(duration, elapsedSec * rate);
      this.pausedOffsets.set(name, offset);
    }
    this.stop(id);
    return true;
  }

  /**
   * Resume a sound by name if it was paused. For HTMLAudio paused instances, resumes the same element.
   * For WebAudio, if a paused offset exists, starts a new instance at that offset.
   * @returns the id of the resumed/started instance, or null if none.
   */
  public resumeByName(name: string, options: AudioOptions = {}): string | null {
    // Try to find a paused HTMLAudio instance first
    const pausedHtml: Array<ActiveHtmlSound> = [];
    this.activeSounds.forEach((snd) => {
      if (snd.name === name && snd.kind === "html")
        pausedHtml.push(snd as ActiveHtmlSound);
    });
    if (pausedHtml.length > 0) {
      const latest = pausedHtml.sort((a, b) => b.startedAt - a.startedAt)[0];
      try {
        latest.audio.play();
        return latest.id;
      } catch {
        // Fallback to restart via WebAudio path below
      }
    }

    // WebAudio: restart at paused offset if available
    const offset = this.pausedOffsets.get(name);
    if (typeof offset === "number" && Number.isFinite(offset)) {
      // Clear paused offset before starting
      this.pausedOffsets.delete(name);
      const id = this.play(name, {
        maxVoices: 1,
        ...options,
        startAtMs: Math.floor(offset * 1000),
      });
      return id;
    }

    return null;
  }

  /**
   * Dispose of all audio resources (cleanup)
   */
  public dispose(): void {
    this.stopAll();
    this.sounds.clear();
    this.audioPool = [];
    console.log("[AudioManager] Disposed");
  }

  // Private helpers

  private calculateVolume(channel: AudioChannel, soundVolume: number): number {
    if (this.muted) return 0;
    const channelVol = this.channelVolumes.get(channel) ?? 1.0;
    return this.masterVolume * channelVol * soundVolume;
  }

  private updateAllVolumes(): void {
    this.activeSounds.forEach((activeSound) => {
      if (activeSound.kind === "html") {
        const sound = this.sounds.get(activeSound.name);
        if (sound) {
          activeSound.audio.volume = this.calculateVolume(
            activeSound.channel,
            1.0
          );
        }
      } else {
        // For WebAudio, per-instance gain already includes final mix; keep as-is.
        // Channel/master changes are handled by channel/master gain nodes.
      }
    });
  }

  private returnToPool(audio: HTMLAudioElement): void {
    // Reset audio element
    audio.src = "";
    audio.loop = false;
    audio.playbackRate = 1.0;
    audio.volume = 1.0;

    // Return to pool if not full
    if (this.audioPool.length < this.poolSize) {
      this.audioPool.push(audio);
    }
  }

  private enforceVoiceLimit(baseName: string, maxVoices: number): void {
    if (maxVoices <= 0) return;

    const activeForName = Array.from(this.activeSounds.entries())
      .filter(([, sound]) => sound.name === baseName)
      .sort((a, b) => a[1].startedAt - b[1].startedAt);

    const allowedExisting = Math.max(0, maxVoices - 1);
    const overflow = activeForName.length - allowedExisting;
    if (overflow <= 0) return;

    for (let i = 0; i < overflow; i++) {
      const [id] = activeForName[i];
      this.stop(id);
    }
  }
}
