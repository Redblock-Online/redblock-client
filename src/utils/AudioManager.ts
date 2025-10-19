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
 * // Play looped sound
 * const stepsId = audio.play('steps', { volume: 0.4, loop: true });
 * audio.stop(stepsId); // Stop when done
 * 
 * // Control volumes
 * audio.setChannelVolume('sfx', 0.8);
 * audio.setMasterVolume(0.9);
 * ```
 */

export type AudioChannel = 'sfx' | 'music' | 'ambient' | 'ui';

interface AudioOptions {
  volume?: number;        // 0.0 - 1.0, defaults to 1.0
  loop?: boolean;         // Loop the sound, defaults to false
  channel?: AudioChannel; // Override channel from loaded sound
  pitch?: number;         // Playback rate (0.5 = half speed, 2.0 = double), defaults to 1.0
  startAtMs?: number;     // Optional: start playback offset in milliseconds
  randomizePitch?: boolean; // If true, jitter the pitch slightly each play
  pitchJitter?: number;     // Max absolute jitter to apply around base pitch (e.g., 0.04 -> ±0.04)
}

interface LoadedSound {
  url: string;
  channel: AudioChannel;
  buffer: HTMLAudioElement; // Preloaded HTML element (fallback)
  audioBuf?: AudioBuffer;   // Decoded Web Audio buffer (low-latency path)
}

type ActiveSound = ActiveHtmlSound | ActiveWebSound;

interface ActiveHtmlSound {
  id: string;
  name: string;
  audio: HTMLAudioElement;
  channel: AudioChannel;
  kind: 'html';
}

interface ActiveWebSound {
  id: string;
  name: string;
  node: AudioBufferSourceNode;
  gain: GainNode;
  channel: AudioChannel;
  kind: 'web';
}

export class AudioManager {
  private static instance: AudioManager;
  
  // Loaded sound library
  private sounds = new Map<string, LoadedSound>();
  private knownSounds = new Map<string, { url: string; channel: AudioChannel }>();
  private loadingSounds = new Set<string>();
  
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
  
  private constructor() {
    // Load volumes from localStorage with defaults
    this.loadVolumesFromStorage();
    
    // Initialize audio pool
    for (let i = 0; i < this.poolSize; i++) {
      const audio = new Audio();
      audio.preload = 'auto';
      this.audioPool.push(audio);
    }
    
    console.log(`[AudioManager] Initialized with pool size: ${this.poolSize}`);

    // Try to init Web Audio (will be resumed on first play() call after user gesture)
    try {
      type WindowWithWebAudio = Window & { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const w = window as WindowWithWebAudio;
      const Ctx = w.AudioContext || w.webkitAudioContext;
      if (typeof Ctx === 'function') {
        const ctx: AudioContext = new Ctx();
        this.ctx = ctx;
        const masterGain = ctx.createGain();
        masterGain.gain.value = this.masterVolume;
        masterGain.connect(ctx.destination);
        this.masterGain = masterGain;
        (['sfx','music','ambient','ui'] as AudioChannel[]).forEach(ch => {
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
      type WindowWithWebAudio = Window & { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const w = window as WindowWithWebAudio;
      const Ctx = w.AudioContext || w.webkitAudioContext;
      if (!Ctx) return;
      const needsNew = !this.ctx || this.ctx.state === 'closed';
      if (needsNew) {
        const ctx: AudioContext = new Ctx();
        this.ctx = ctx;
        const masterGain = ctx.createGain();
        masterGain.gain.value = this.masterVolume;
        masterGain.connect(ctx.destination);
        this.masterGain = masterGain;
        this.channelGains.clear();
        (['sfx','music','ambient','ui'] as AudioChannel[]).forEach(ch => {
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
      ui: 0.8
    };
    
    // Load master volume
    const savedMaster = localStorage.getItem('audio_volume_master');
    if (savedMaster !== null) {
      const parsed = parseFloat(savedMaster);
      if (!isNaN(parsed)) {
        this.masterVolume = Math.max(0, Math.min(1, parsed));
      }
    }
    
    // Load channel volumes
    const channels: AudioChannel[] = ['sfx', 'music', 'ambient', 'ui'];
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
    
    console.log('[AudioManager] Volumes loaded:', {
      master: this.masterVolume,
      sfx: this.channelVolumes.get('sfx'),
      music: this.channelVolumes.get('music'),
      ambient: this.channelVolumes.get('ambient'),
      ui: this.channelVolumes.get('ui')
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
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch { /* ignore */ }
    }
  }

  /**
   * Get AudioContext base latency (lower is better)
   */
  public getLatencyInfo(): { baseLatency: number; outputLatency: number; state: string } | null {
    if (!this.ctx) return null;
    const ctxWithLatency = this.ctx as AudioContext & { baseLatency?: number; outputLatency?: number };
    return {
      baseLatency: ctxWithLatency.baseLatency ?? 0,
      outputLatency: ctxWithLatency.outputLatency ?? 0,
      state: this.ctx.state
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
    channel: AudioChannel = 'sfx'
  ): Promise<void> {
    // Track known mapping for on-demand loads
    this.knownSounds.set(name, { url, channel });
    if (this.sounds.has(name)) {
      console.warn(`[AudioManager] Sound '${name}' already loaded`);
      return;
    }

    return new Promise(async (resolve, reject) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      
      audio.addEventListener('canplaythrough', () => {
        const entry: LoadedSound = { url, channel, buffer: audio };
        this.sounds.set(name, entry);
        
        // BLOCKING: Force Web Audio decode to complete before resolving
        if (this.ctx) {
          fetch(url)
            .then(r => r.arrayBuffer())
            .then(ab => this.ctx!.decodeAudioData(ab))
            .then(decoded => {
              const s = this.sounds.get(name);
              if (s) s.audioBuf = decoded;
              console.log(`[AudioManager] ✓ Loaded '${name}' (${channel}) [Web Audio ready]`);
              resolve();
            })
            .catch((err) => {
              console.warn(`[AudioManager] Web Audio decode failed for '${name}', using HTML fallback:`, err);
              resolve();
            });
        } else {
          console.log(`[AudioManager] ✓ Loaded '${name}' (${channel}) [HTML Audio only]`);
          resolve();
        }
      }, { once: true });
      
      audio.addEventListener('error', (e) => {
        console.error(`[AudioManager] ✗ Failed to load '${name}':`, e);
        reject(new Error(`Failed to load ${name}`));
      }, { once: true });
    });
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
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {/* ignore */});
    }

    const sound = this.sounds.get(name);
    if (!sound) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const last = this.lastMissingWarn.get(name) ?? 0;
      if (now - last > 500) {
        console.warn(`[AudioManager] Sound '${name}' not loaded. Available:`, Array.from(this.sounds.keys()));
        this.lastMissingWarn.set(name, now);
      }
      // If we know about this sound (or it's a common default), lazy-load (but don't auto-replay loops)
      let known = this.knownSounds.get(name);
      if (!known) {
        // Register sensible defaults for common names to survive HMR/device resets
        if (name === 'steps') known = { url: '/audio/sfx/steps.wav', channel: 'sfx' } as const;
        if (name === 'shoot') known = { url: '/audio/sfx/shoot.mp3', channel: 'sfx' } as const;
        if (known) this.knownSounds.set(name, known);
      }
      if (known && !this.loadingSounds.has(name)) {
        this.loadingSounds.add(name);
        this.loadSound(name, known.url, known.channel)
          .then(() => {
            this.loadingSounds.delete(name);
            // Don't auto-play looped sounds (like footsteps) - caller may have stopped moving
            // Only auto-play one-shots (like shoot)
            if (!options.loop) {
              this.play(name, options);
            }
          })
          .catch(() => {
            this.loadingSounds.delete(name);
          });
      }
      return null;
    }

    // Try Web Audio first for minimal latency
    if (this.ctx && sound.audioBuf) {
      // One-time diagnostic log
      if (!this.webAudioUsed) {
        this.webAudioUsed = true;
        console.log('[AudioManager] ✓ Using Web Audio API (low-latency path active)');
      }
      
      const channel = options.channel ?? sound.channel;
      const volume = options.volume ?? 1.0;
      const loop = options.loop ?? false;
      const basePitch = options.pitch ?? 1.0;
      const jitterAmount = options.randomizePitch ? (options.pitchJitter ?? 0.04) : 0;
      const jitter = jitterAmount > 0 ? (Math.random() * 2 - 1) * jitterAmount : 0;
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

      const id = `${name}_${this.nextSoundId++}`;
      this.activeSounds.set(id, {
        id,
        name,
        node: source,
        gain: instanceGain,
        channel,
        kind: 'web'
      });

      const offset = startAtMs / 1000;
      // Use immediate scheduling for lowest latency (no scheduling overhead)
      try {
        source.start(0, offset);
      } catch (e) {
        // If start throws (e.g., offset too large), start at 0
        try { source.start(0); } catch { /* ignore */ }
      }

      if (!loop) {
        source.addEventListener('ended', () => {
          this.stop(id);
        }, { once: true });
      }

      return id;
    }

    // Fallback: HTMLAudio element (higher latency)
    if (!this.webAudioUsed) {
      console.warn('[AudioManager] ⚠️ Using HTML Audio fallback (higher latency). Web Audio not available or buffer not decoded.');
    }
    const audio = sound.buffer.cloneNode(true) as HTMLAudioElement;

    // Configure audio
    const channel = options.channel ?? sound.channel;
    const volume = options.volume ?? 1.0;
    const loop = options.loop ?? false;
    const basePitch = options.pitch ?? 1.0;
    const jitterAmount = options.randomizePitch ? (options.pitchJitter ?? 0.04) : 0;
    const jitter = jitterAmount > 0 ? (Math.random() * 2 - 1) * jitterAmount : 0;
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
        audio.addEventListener('loadedmetadata', onMeta, { once: true });
      }
    }

    // Generate unique ID and store as active
    const id = `${name}_${this.nextSoundId++}`;
    this.activeSounds.set(id, { id, name, audio, channel, kind: 'html' });

    // Play
    audio.play().catch(error => {
      console.warn(`[AudioManager] Failed to play '${name}':`, error);
      this.returnToPool(audio!);
      this.activeSounds.delete(id);
    });

    // Auto-cleanup when finished (if not looping)
    if (!loop) {
      audio.addEventListener('ended', () => {
        this.stop(id);
      }, { once: true });
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
    if (activeSound.kind === 'html') {
      activeSound.audio.pause();
      activeSound.audio.currentTime = 0;
      this.returnToPool(activeSound.audio);
    } else {
      try { activeSound.node.stop(); } catch { /* ignore */ }
      try { activeSound.node.disconnect(); } catch { /* ignore */ }
      try { activeSound.gain.disconnect(); } catch { /* ignore */ }
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

    toStop.forEach(id => this.stop(id));
  }

  /**
   * Force-stop all instances of a specific sound by name (alias for stopAll with name)
   * Useful for cleaning up orphaned loops
   * @param name - Sound name
   */
  public stopAllByName(name: string): void {
    this.stopAll(name);
  }

  /**
   * Check if a sound is currently playing
   * @param name - Sound name
   * @returns True if at least one instance is playing
   */
  public isPlaying(name: string): boolean {
    for (const activeSound of this.activeSounds.values()) {
      if (activeSound.name !== name) continue;
      if (activeSound.kind === 'html') {
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
    localStorage.setItem('audio_volume_master', this.masterVolume.toString());
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

  /**
   * Mute/unmute all audio
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateAllVolumes();
  }

  /**
   * Check if audio is muted
   */
  public isMuted(): boolean {
    return this.muted;
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
      this.knownSounds.set(name, { url, channel: (channel ?? 'sfx') });
      return this.loadSound(name, url, channel);
    });
    const results = await Promise.allSettled(promises);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[AudioManager] Some sounds failed to preload (${failed.length}/${sounds.length}). Others are ready.`);
    }
    console.log('[AudioManager] ✓ All sounds preloaded');
  }

  /**
   * Get list of loaded sounds
   */
  public getLoadedSounds(): string[] {
    return Array.from(this.sounds.keys());
  }

  /**
   * Get count of currently playing sounds
   */
  public getActiveSoundCount(): number {
    return this.activeSounds.size;
  }

  /**
   * Dispose of all audio resources (cleanup)
   */
  public dispose(): void {
    this.stopAll();
    this.sounds.clear();
    this.audioPool = [];
    console.log('[AudioManager] Disposed');
  }

  // Private helpers

  private calculateVolume(channel: AudioChannel, soundVolume: number): number {
    if (this.muted) return 0;
    const channelVol = this.channelVolumes.get(channel) ?? 1.0;
    return this.masterVolume * channelVol * soundVolume;
  }

  private updateAllVolumes(): void {
    this.activeSounds.forEach(activeSound => {
      if (activeSound.kind === 'html') {
        const sound = this.sounds.get(activeSound.name);
        if (sound) {
          activeSound.audio.volume = this.calculateVolume(activeSound.channel, 1.0);
        }
      } else {
        // For WebAudio, per-instance gain already includes final mix; keep as-is.
        // Channel/master changes are handled by channel/master gain nodes.
      }
    });
  }

  private returnToPool(audio: HTMLAudioElement): void {
    // Reset audio element
    audio.src = '';
    audio.loop = false;
    audio.playbackRate = 1.0;
    audio.volume = 1.0;
    
    // Return to pool if not full
    if (this.audioPool.length < this.poolSize) {
      this.audioPool.push(audio);
    }
  }
}