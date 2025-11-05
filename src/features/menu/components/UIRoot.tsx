import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StartScreen from "./StartScreen";
import { SCENARIOS } from "@/config/scenarios";
import { TimerDisplay, type TimerController, type TimerHint, PauseMenu } from "@/features/game/ui";
import ControlsHint from "@/ui/react/controls/ControlsHint";
import Navbar from "@/ui/react/navbar";
import { fetchMe } from "@/ui/react/api/me";
import { useMeStore } from "@/features/game/ui/state/me";
import { SettingsMenu } from "@/features/menu";
import Crosshair from "@/features/shared/ui/components/Crosshair";
import StatsDisplay from "@/features/shared/ui/components/StatsDisplay";
import { AudioManager } from "@/utils/AudioManager";
import { FaTwitter, FaTelegram, FaYoutube, FaGithub } from "react-icons/fa";
import { RiInstagramFill } from "react-icons/ri";
import socials from "@/config/socials.json";

type Props = {
  onStart: (scenarioId: string) => void;
  onPauseChange: (paused: boolean) => void;
  bindTimerController: (ctrl: TimerController) => void;
  onExit?: () => void;
};

type MusicCategory = "none" | "energy" | "calm";

const DEFAULT_MUSIC_CATEGORY: MusicCategory = "calm";

type TrackDef = { name: string; url: string };

// Central definition of playlists (expand as needed)
const PLAYLISTS: Record<Exclude<MusicCategory, "none">, TrackDef[]> = {
  // Calm playlist order
  calm: [
    { name: "uncausal", url: "/audio/music/calm/uncasual.ogg" },
    { name: "voices", url: "/audio/music/calm/voices.ogg" },
  ],
  // Energy playlist
  energy: [
    { name: "signal", url: "/audio/music/energy/signal.ogg" },
  ],
};

// Helper: derive track name lists from PLAYLISTS
const calmTrackNames = () => PLAYLISTS.calm.map(t => t.name);
const energyTrackNames = () => PLAYLISTS.energy.map(t => t.name);

const isMusicCategory = (value: unknown): value is MusicCategory =>
  value === "none" || value === "energy" || value === "calm";

const readStoredMusicCategory = (): MusicCategory => {
  if (typeof window === "undefined") return DEFAULT_MUSIC_CATEGORY;
  try {
    const raw = window.localStorage.getItem("audioSettings");
    if (!raw) return DEFAULT_MUSIC_CATEGORY;
    const parsed = JSON.parse(raw) as { musicCategory?: unknown } | null;
    if (parsed && isMusicCategory(parsed.musicCategory)) {
      return parsed.musicCategory;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[UIRoot] Failed to read stored music category", error);
    }
  }
  return DEFAULT_MUSIC_CATEGORY;
};

function isAMobile() {
  // Check if it's actually a mobile device, not just a PC with touchscreen
  // Use multiple signals to avoid false positives on touch-enabled laptops
  
  // 1. Check user agent for mobile indicators
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  // 2. Check if primary input is touch (not mouse/trackpad)
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  
  // 3. Check screen size (mobile devices typically < 768px width)
  const isSmallScreen = window.innerWidth < 768;
  
  // Device is mobile if:
  // - Has mobile user agent, OR
  // - Has touch AND no fine pointer (mouse/trackpad) AND small screen
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  
  return isMobileUA || (hasTouch && !hasFinePointer && isSmallScreen);
}

export default function UIRoot({ onStart, onPauseChange, bindTimerController, onExit }: Props) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [_hudScale, setHudScale] = useState(100);
  const [showTimer, setShowTimer] = useState(true);
  const [showHints, setShowHints] = useState(true);
  const [musicCategory, setMusicCategory] = useState<MusicCategory>(() => readStoredMusicCategory());
  const { setUser, setHydrated } = useMeStore();
  const isMobile = useMemo(() => isAMobile(), []);
  const [mobileWarningDismissed, setMobileWarningDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dismissMobileWarning") === "true";
  });
  const timerRef = useRef<TimerController | null>(null);
  const pausedRef = useRef(false);
  const timerRunningRef = useRef(false);
  const hadRunningBeforePauseRef = useRef(false);
  const lastPausedForSoundRef = useRef(paused);
  const calmPlaybackIdRef = useRef<string | null>(null);
  const calmCurrentTrackRef = useRef<string | null>(null);
  const calmPlaylistIndexRef = useRef<number>(0);
  const calmAdvanceTimerRef = useRef<number | null>(null);
  const energyPlaybackIdRef = useRef<string | null>(null);
  const energyCurrentTrackRef = useRef<string | null>(null);
  const energyPlaylistIndexRef = useRef<number>(0);
  const energyAdvanceTimerRef = useRef<number | null>(null);
  const previousMusicCategoryRef = useRef<MusicCategory>(musicCategory);
  // Shuffle/order state per playlist
  const calmOrderRef = useRef<number[]>([]);
  const energyOrderRef = useRef<number[]>([]);
  const calmShuffleRef = useRef<boolean>(false);
  const energyShuffleRef = useRef<boolean>(false);

  useEffect(() => {
    // Initialize identity orders
    calmOrderRef.current = PLAYLISTS.calm.map((_, i) => i);
    energyOrderRef.current = PLAYLISTS.energy.map((_, i) => i);
  }, []);

  const getAndClampIndex = (list: TrackDef[], idx: number) => {
    const len = list.length;
    if (len === 0) return 0;
    return ((idx % len) + len) % len;
  };

  const getOrder = (category: Exclude<MusicCategory, 'none'>): number[] => {
    const list = PLAYLISTS[category];
    const ref = category === 'calm' ? calmOrderRef : energyOrderRef;
    return ref.current.length === list.length ? ref.current : list.map((_, i) => i);
  };

  const persistPlaylistIndex = (category: Exclude<MusicCategory, "none">, idx: number) => {
    try {
      localStorage.setItem(`musicPlaylistIndex:${category}`, String(idx));
    } catch { /* ignore */ }
  };

  const readPlaylistIndex = (category: Exclude<MusicCategory, "none">): number => {
    try {
      const raw = localStorage.getItem(`musicPlaylistIndex:${category}`);
      if (!raw) return 0;
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  };

  const startCalmTrack = useCallback(async (options?: { index?: number }) => {
    const { index } = options || {};
    if (typeof window === "undefined") return;
    const audio = AudioManager.getInstance();
    const calmList = PLAYLISTS.calm;
    if (calmList.length === 0) return;

    const baseIdx = index ?? calmPlaylistIndexRef.current ?? 0;
    const normalizedIndex = getAndClampIndex(calmList, baseIdx);
    const order = getOrder('calm');
    const actualIdx = order[normalizedIndex] ?? 0;
    const current = calmList[actualIdx];

    calmPlaylistIndexRef.current = normalizedIndex;
    calmCurrentTrackRef.current = current.name;
    persistPlaylistIndex("calm", normalizedIndex);

    // Broadcast current track change for UI updates
    window.dispatchEvent(new CustomEvent("currentTrackChanged", { 
      detail: { category: "calm", trackName: current.name } 
    }));

    try {
      audio.ensureResumed().catch(() => {});
      
      // Stop any other calm tracks to prevent overlaps
      calmTrackNames().forEach((name) => {
        if (name !== current.name) audio.stopAllByName(name);
      });
      
      // Stop current track if playing
      if (calmPlaybackIdRef.current) {
        audio.stop(calmPlaybackIdRef.current);
        calmPlaybackIdRef.current = null;
      }

      // Clear any pending auto-advance timers before starting a new track
      if (calmAdvanceTimerRef.current !== null) {
        window.clearTimeout(calmAdvanceTimerRef.current);
        calmAdvanceTimerRef.current = null;
      }

      // Load and play current track
      // Load sound (no-op if already loaded)
      await audio.loadSound(current.name, current.url, "music");

      // Ensure no other music is playing before starting this track
      audio.stopAllInChannelExcept('music', current.name);

      const id = audio.play(current.name, {
        channel: "music",
        volume: 0.35,
        loop: false,
        maxVoices: 1,
      });
      calmPlaybackIdRef.current = id ?? calmPlaybackIdRef.current;

      // Schedule auto-advance to next track (wraps around)
      try {
        const prog = audio.getProgress(current.name);
        const dur = prog?.duration ?? (audio.getSoundDuration(current.name) ?? 0);
        let remainingMs = 0;
        if (prog && dur > 0) {
          remainingMs = Math.max(100, Math.floor((dur - prog.current) * 1000));
        } else if (dur > 0) {
          remainingMs = Math.max(100, Math.floor(dur * 1000));
        } else {
          // Fallback: 2 minutes if duration unknown
          remainingMs = 120_000;
        }
        calmAdvanceTimerRef.current = window.setTimeout(() => {
          // Advance logical index by +1 (getAndClampIndex handles wrap-around)
          const nextIndex = (calmPlaylistIndexRef.current ?? 0) + 1;
          startCalmTrack({ index: nextIndex });
        }, remainingMs + 100); // small padding to ensure the track ended
      } catch {
        /* ignore scheduling errors */
      }
    } catch (error) {
      console.error('[UIRoot] Error in startCalmTrack:', error);
    }
  }, []);

  const startEnergyTrack = useCallback(async (options?: { index?: number }) => {
    const { index } = options || {};
    if (typeof window === "undefined") return;
    const audio = AudioManager.getInstance();
    const list = PLAYLISTS.energy;
    if (list.length === 0) return;

    const baseIdx = index ?? energyPlaylistIndexRef.current ?? 0;
    const normalizedIndex = getAndClampIndex(list, baseIdx);
    const order = getOrder('energy');
    const actualIdx = order[normalizedIndex] ?? 0;
    const current = list[actualIdx];

    energyPlaylistIndexRef.current = normalizedIndex;
    energyCurrentTrackRef.current = current.name;
    persistPlaylistIndex("energy", normalizedIndex);

    // Broadcast current track change for UI updates
    window.dispatchEvent(new CustomEvent("currentTrackChanged", { 
      detail: { category: "energy", trackName: current.name } 
    }));

    try {
      audio.ensureResumed().catch(() => {});
      
      // Stop any other energy tracks to prevent overlaps
      energyTrackNames().forEach((name) => {
        if (name !== current.name) audio.stopAllByName(name);
      });
      
      // Stop current track if playing
      if (energyPlaybackIdRef.current) {
        audio.stop(energyPlaybackIdRef.current);
        energyPlaybackIdRef.current = null;
      }

      // Clear any pending auto-advance timers before starting a new track
      if (energyAdvanceTimerRef.current !== null) {
        window.clearTimeout(energyAdvanceTimerRef.current);
        energyAdvanceTimerRef.current = null;
      }

      // Load and play current track
      // Load sound (no-op if already loaded)
      await audio.loadSound(current.name, current.url, "music");

      // Ensure no other music is playing before starting this track
      audio.stopAllInChannelExcept('music', current.name);

      const id = audio.play(current.name, {
        channel: "music",
        volume: 0.35,
        loop: false,
        maxVoices: 1,
      });
      energyPlaybackIdRef.current = id ?? energyPlaybackIdRef.current;
      // Schedule auto-advance to next energy track
      try {
        const prog = audio.getProgress(current.name);
        const dur = prog?.duration ?? (audio.getSoundDuration(current.name) ?? 0);
        let remainingMs = 0;
        if (prog && dur > 0) {
          remainingMs = Math.max(100, Math.floor((dur - prog.current) * 1000));
        } else if (dur > 0) {
          remainingMs = Math.max(100, Math.floor(dur * 1000));
        } else {
          remainingMs = 120_000;
        }
        energyAdvanceTimerRef.current = window.setTimeout(() => {
          const nextIndex = (energyPlaylistIndexRef.current ?? 0) + 1;
          startEnergyTrack({ index: nextIndex });
        }, remainingMs + 100);
      } catch {
        /* ignore scheduling errors */
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAudioSettingsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ musicCategory?: unknown }>).detail;
      if (detail && isMusicCategory(detail.musicCategory)) {
        setMusicCategory(detail.musicCategory);
      }
    };

    const handleJumpToTrack = (event: Event) => {
      const detail = (event as CustomEvent<{ category: Exclude<MusicCategory, "none">; trackIndex: number }>).detail;
      if (detail && detail.category === musicCategory) {
        // Jump to specific track in current playlist with fade in
        if (detail.category === "calm") {
          startCalmTrack({ index: detail.trackIndex });
        } else if (detail.category === "energy") {
          startEnergyTrack({ index: detail.trackIndex });
        }
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "audioSettings" || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { musicCategory?: unknown };
        if (isMusicCategory(parsed.musicCategory)) {
          setMusicCategory(parsed.musicCategory);
        }
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("audioSettingsChanged" as never, handleAudioSettingsChanged as EventListener);
    window.addEventListener("jumpToMusicTrack" as never, handleJumpToTrack as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("audioSettingsChanged" as never, handleAudioSettingsChanged as EventListener);
      window.removeEventListener("jumpToMusicTrack" as never, handleJumpToTrack as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [musicCategory, startCalmTrack, startEnergyTrack]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const audio = AudioManager.getInstance();
      audio.ensureResumed().catch(() => {});

      const previousCategory = previousMusicCategoryRef.current;
      previousMusicCategoryRef.current = musicCategory;

      if (musicCategory === "calm") {
        // Switching to calm: clear energy auto-advance timer
        if (energyAdvanceTimerRef.current !== null) {
          window.clearTimeout(energyAdvanceTimerRef.current);
          energyAdvanceTimerRef.current = null;
        }
        // Stop energy tracks when switching to calm
        if (energyPlaybackIdRef.current) {
          audio.stop(energyPlaybackIdRef.current);
          energyPlaybackIdRef.current = null;
        }
        
        if (previousCategory !== "calm") {
          // Resume from persisted index
          calmPlaylistIndexRef.current = readPlaylistIndex("calm");
        }

        const currentTrack = calmCurrentTrackRef.current;
        const isCurrentPlaying = currentTrack ? audio.isPlaying(currentTrack) : false;
        if (!isCurrentPlaying) {
          startCalmTrack({ index: calmPlaylistIndexRef.current });
        }
        return;
      }

      // Stop calm tracks when switching away from calm
      if (calmPlaybackIdRef.current) {
        audio.stop(calmPlaybackIdRef.current);
        calmPlaybackIdRef.current = null;
      }
      if (calmAdvanceTimerRef.current !== null) {
        window.clearTimeout(calmAdvanceTimerRef.current);
        calmAdvanceTimerRef.current = null;
      }

      if (musicCategory === "energy") {
        // Switching to energy: clear calm auto-advance timer handled above
        if (previousCategory !== "energy") {
          energyPlaylistIndexRef.current = readPlaylistIndex("energy");
        }
        const currentEnergy = energyCurrentTrackRef.current;
        const isEnergyPlaying = currentEnergy ? audio.isPlaying(currentEnergy) : false;
        if (!isEnergyPlaying) {
          startEnergyTrack({ index: energyPlaylistIndexRef.current });
        }
      }

      // Stop all music if none selected
      if (musicCategory === "none") {
        calmTrackNames().forEach((track) => audio.stopAllByName(track));
        energyTrackNames().forEach((name) => audio.stopAllByName(name));
        if (calmAdvanceTimerRef.current !== null) {
          window.clearTimeout(calmAdvanceTimerRef.current);
          calmAdvanceTimerRef.current = null;
        }
        if (energyAdvanceTimerRef.current !== null) {
          window.clearTimeout(energyAdvanceTimerRef.current);
          energyAdvanceTimerRef.current = null;
        }
      }
    } catch {
      /* ignore */
    }
  }, [musicCategory, startCalmTrack, startEnergyTrack]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (calmAdvanceTimerRef.current !== null) {
        window.clearTimeout(calmAdvanceTimerRef.current);
        calmAdvanceTimerRef.current = null;
      }
      if (energyAdvanceTimerRef.current !== null) {
        window.clearTimeout(energyAdvanceTimerRef.current);
        energyAdvanceTimerRef.current = null;
      }
    };
  }, []);

  // Handle external music control events (prev/next/play-stop/shuffle)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const audio = AudioManager.getInstance();

    const seekRelative = (delta: number) => {
      const category = previousMusicCategoryRef.current = musicCategory;
      if (category === 'none') return;
      if (category === 'calm') {
        const pos = calmPlaylistIndexRef.current ?? 0;
        startCalmTrack({ index: pos + delta });
      } else if (category === 'energy') {
        const pos = energyPlaylistIndexRef.current ?? 0;
        startEnergyTrack({ index: pos + delta });
      }
    };

    const onPrev = () => seekRelative(-1);
    const onNext = () => seekRelative(1);

    const onTogglePlayback = () => {
      const category = previousMusicCategoryRef.current = musicCategory;
      if (category === 'none') return;
      const name = category === 'calm' ? calmCurrentTrackRef.current : energyCurrentTrackRef.current;
      if (!name) {
        // Nothing has played yet; start current position
        if (category === 'calm') startCalmTrack({ index: calmPlaylistIndexRef.current ?? 0 });
        else startEnergyTrack({ index: energyPlaylistIndexRef.current ?? 0 });
        return;
      }
      const isPlaying = audio.isPlaying(name);
      if (isPlaying) {
        audio.pauseByName(name);
        // Clear auto-advance timers when pausing
        if (category === 'calm') {
          if (calmAdvanceTimerRef.current !== null) {
            window.clearTimeout(calmAdvanceTimerRef.current);
            calmAdvanceTimerRef.current = null;
          }
        } else if (category === 'energy') {
          if (energyAdvanceTimerRef.current !== null) {
            window.clearTimeout(energyAdvanceTimerRef.current);
            energyAdvanceTimerRef.current = null;
          }
        }
      } else {
        // Guarantee no other music plays concurrently
        audio.stopAllInChannelExcept('music', name);
        const resumed = audio.resumeByName(name, { channel: 'music', volume: 0.35, loop: false, maxVoices: 1 });
        if (!resumed) {
          // If resume failed (no paused offset), start from current logical index
          if (category === 'calm') startCalmTrack({ index: calmPlaylistIndexRef.current ?? 0 });
          else startEnergyTrack({ index: energyPlaylistIndexRef.current ?? 0 });
        } else {
          // Resumed successfully: re-schedule auto-advance based on remaining time
          try {
            const prog = audio.getProgress(name);
            const dur = prog?.duration ?? (audio.getSoundDuration(name) ?? 0);
            if (dur > 0 && prog) {
              const remainingMs = Math.max(100, Math.floor((dur - prog.current) * 1000));
              if (category === 'calm') {
                if (calmAdvanceTimerRef.current !== null) window.clearTimeout(calmAdvanceTimerRef.current);
                calmAdvanceTimerRef.current = window.setTimeout(() => {
                  const nextIndex = (calmPlaylistIndexRef.current ?? 0) + 1;
                  startCalmTrack({ index: nextIndex });
                }, remainingMs + 100);
              } else if (category === 'energy') {
                if (energyAdvanceTimerRef.current !== null) window.clearTimeout(energyAdvanceTimerRef.current);
                energyAdvanceTimerRef.current = window.setTimeout(() => {
                  const nextIndex = (energyPlaylistIndexRef.current ?? 0) + 1;
                  startEnergyTrack({ index: nextIndex });
                }, remainingMs + 100);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
    };

    const shuffleArray = (arr: number[]) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const onToggleShuffle = () => {
      const category = previousMusicCategoryRef.current = musicCategory;
      if (category === 'none') return;
      const list = PLAYLISTS[category];
      const orderRef = category === 'calm' ? calmOrderRef : energyOrderRef;
      const shuffleRef = category === 'calm' ? calmShuffleRef : energyShuffleRef;
      const indexRef = category === 'calm' ? calmPlaylistIndexRef : energyPlaylistIndexRef;
      const oldOrder = getOrder(category);
      const currentPos = indexRef.current ?? 0;
      const currentActual = oldOrder[getAndClampIndex(list, currentPos)];

      const enabling = !shuffleRef.current;
      shuffleRef.current = enabling;

      if (enabling) {
        orderRef.current = shuffleArray(list.map((_, i) => i));
      } else {
        orderRef.current = list.map((_, i) => i);
      }
      // Keep current song the same; update logical position to match new order
      const newPos = orderRef.current.indexOf(currentActual);
      indexRef.current = newPos >= 0 ? newPos : 0;
      persistPlaylistIndex(category, indexRef.current);

      // Notify UI of shuffle state
      window.dispatchEvent(new CustomEvent('musicShuffleChanged', { detail: { category, enabled: shuffleRef.current } }));
    };

    window.addEventListener('prevMusicTrack', onPrev as EventListener);
    window.addEventListener('nextMusicTrack', onNext as EventListener);
    window.addEventListener('toggleMusicPlayback', onTogglePlayback as EventListener);
    window.addEventListener('toggleShuffleMusic', onToggleShuffle as EventListener);

    return () => {
      window.removeEventListener('prevMusicTrack', onPrev as EventListener);
      window.removeEventListener('nextMusicTrack', onNext as EventListener);
      window.removeEventListener('toggleMusicPlayback', onTogglePlayback as EventListener);
      window.removeEventListener('toggleShuffleMusic', onToggleShuffle as EventListener);
    };
  }, [musicCategory, startCalmTrack, startEnergyTrack]);

  // Broadcast current playing track for UI updates
  useEffect(() => {
    const currentTrack = musicCategory === "calm" ? calmCurrentTrackRef.current : 
                        musicCategory === "energy" ? energyCurrentTrackRef.current : null;
    window.dispatchEvent(new CustomEvent("currentTrackChanged", { 
      detail: { category: musicCategory, trackName: currentTrack } 
    }));
    // Also broadcast shuffle state for current category
    const shuffle = musicCategory === 'calm' ? calmShuffleRef.current : musicCategory === 'energy' ? energyShuffleRef.current : false;
    window.dispatchEvent(new CustomEvent('musicShuffleChanged', { detail: { category: musicCategory, enabled: shuffle } }));
  }, [musicCategory]); // Update when category changes

  // Ensure music starts on page load if calm is selected
  useEffect(() => {
    if (musicCategory === "calm") {
      startCalmTrack();
    }
  }, [musicCategory, startCalmTrack]); // Include dependencies to satisfy linter

  useEffect(() => {
    const wasPaused = lastPausedForSoundRef.current;
    if (!wasPaused && paused && started) {
      try {
        const audio = AudioManager.getInstance();
        audio.play("escape-event", { channel: "ui", volume: 0.7 });
      } catch {
        /* ignore */
      }
    }
    lastPausedForSoundRef.current = paused;
  }, [paused, started]);

  // Load and listen to game settings
  useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem("gameSettings");
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          setHudScale(settings.hudScale || 100);
          setShowTimer(settings.showTimer !== undefined ? settings.showTimer : true);
          setShowHints(settings.showHints !== undefined ? settings.showHints : true);
        } catch {
          // Use defaults
        }
      }
    };

    loadSettings();

    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.hudScale !== undefined) setHudScale(customEvent.detail.hudScale);
        if (customEvent.detail.showTimer !== undefined) setShowTimer(customEvent.detail.showTimer);
        if (customEvent.detail.showHints !== undefined) setShowHints(customEvent.detail.showHints);
      }
    };

    window.addEventListener("gameSettingsChanged", handleSettingsChange);
    return () => window.removeEventListener("gameSettingsChanged", handleSettingsChange);
  }, []);

  const requestPointerLockOnCanvas = useCallback(() => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    try {
      const result = (canvas.requestPointerLock as unknown as () => void | Promise<void>)?.();
      if ((result as unknown) && (result as unknown) instanceof Promise) {
        (result as Promise<void>).catch(() => {
          /* swallow */
        });
      }
    } catch (_) {
      /* swallow */
    }
  }, []);

  const handleStart = useCallback((scenarioId: string) => {
    setStarted(true);
    setPaused(false);
    onStart(scenarioId);
  }, [onStart]);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((me) => {
        if (!mounted) return;
        if (me) setUser(me);
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, [setUser, setHydrated]);

  // While in-game, prevent accidental browser navigation (back/forward)
  useEffect(() => {
    if (!started) return;

    const preventBackForwardMouse = (e: MouseEvent) => {
      const btn = e.button;
      if (btn === 3 || btn === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const preventBackForwardPointer = (e: PointerEvent) => {
      const btn = e.button;
      if (btn === 3 || btn === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const preventBackspaceNav = (e: KeyboardEvent) => {
      if (e.code === "Backspace") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const editable = !!(
          target && ((tag === "INPUT" || tag === "TEXTAREA") || target.isContentEditable)
        );
        if (!editable) e.preventDefault();
      }
      if ((e.altKey || e.metaKey) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
      }
    };

    const onPopState = (_e: PopStateEvent) => {
      history.pushState(null, "", window.location.href);
    };

    history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("mousedown", preventBackForwardMouse);
    document.addEventListener("mouseup", preventBackForwardMouse);
    document.addEventListener("pointerdown", preventBackForwardPointer);
    document.addEventListener("pointerup", preventBackForwardPointer);
    document.addEventListener("keydown", preventBackspaceNav);

    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("mousedown", preventBackForwardMouse);
      document.removeEventListener("mouseup", preventBackForwardMouse);
      document.removeEventListener("pointerdown", preventBackForwardPointer);
      document.removeEventListener("pointerup", preventBackForwardPointer);
      document.removeEventListener("keydown", preventBackspaceNav);
    };
  }, [started, onPauseChange]);

  
  // Auto-pause when pointer lock is lost (e.g., user presses Esc)
  useEffect(() => {
    const onPointerLockChange = () => {
      const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
      const locked = !!canvas && document.pointerLockElement === canvas;
      if (started && !locked && !pausedRef.current) {
        hadRunningBeforePauseRef.current = timerRunningRef.current;
        if (timerRunningRef.current) timerRef.current?.pause();
        onPauseChange(true);
        setPaused(true);
      }
    };
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("pointerlockerror", onPointerLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("pointerlockerror", onPointerLockChange);
    };
  }, [started, onPauseChange]);

  const handleDismissMobileWarning = useCallback(() => {
    localStorage.setItem("dismissMobileWarning", "true");
    setMobileWarningDismissed(true);
  }, []);

  // Social links setup (same as StartScreen)
  const SOCIAL_ICONS = {
    twitter: FaTwitter,
    telegram: FaTelegram,
    youtube: FaYoutube,
    github: FaGithub,
    instagram: RiInstagramFill,
  } as const;

  type SocialIconKey = keyof typeof SOCIAL_ICONS;
  type SocialLink = {
    id: string;
    label: string;
    url: string;
    icon: SocialIconKey;
  };

  const socialLinks: SocialLink[] = Array.isArray((socials as { links?: unknown }).links)
    ? (((socials as { links: unknown }).links) as SocialLink[])
    : [];

  if (isMobile && !mobileWarningDismissed) {
    return (
      <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] flex items-center justify-center text-black">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10" />
        
        {/* Social Links - top right */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {socialLinks.map((link) => {
            const Icon = SOCIAL_ICONS[link.icon] ?? FaGithub;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-1 transition-transform duration-150 hover:scale-110"
                aria-label={link.label}
                title={link.label}
              >
                <Icon className="text-2xl text-black/80 group-hover:text-black transition-colors" />
              </a>
            );
          })}
        </div>

        <div className="relative z-10 flex flex-col gap-4 p-8 text-center max-w-lg border-[3px] border-black bg-white">
          <h1 className="text-2xl font-bold font-mono tracking-wider uppercase">This game is designed for PC</h1>
          <p className="text-base leading-relaxed">
            This game requires a keyboard and mouse for the best experience.
          </p>
          <div className="border-t-[3px] border-black pt-4 mt-2">
            <p className="font-mono text-sm font-bold mb-4 uppercase">
              Do you have a keyboard and mouse connected?
            </p>
            <button
              onClick={handleDismissMobileWarning}
              className="w-full font-mono font-bold tracking-wider border-[3px] border-black px-6 py-3 uppercase transition-all bg-[#ff0000] text-white hover:bg-black"
            >
              Yes, Let Me Play
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!started && (
        <StartScreen scenarios={SCENARIOS} onStart={handleStart} onSettings={() => setSettingsOpen(true)} />
      )}
      {started && showTimer && (
        <TimerDisplay
          hudScale={_hudScale}
          bindController={(ctrl) => {
            // Wrap the controller to track running state locally
            const wrapped: TimerController = {
              start: () => {
                timerRunningRef.current = true;
                ctrl.start();
              },
              stop: (hint?: TimerHint) => {
                timerRunningRef.current = false;
                ctrl.stop(hint);
              },
              reset: () => {
                timerRunningRef.current = false;
                ctrl.reset();
              },
              pause: () => {
                if (!timerRunningRef.current) return;
                timerRunningRef.current = false;
                ctrl.pause();
              },
              resume: () => {
                if (timerRunningRef.current) return;
                timerRunningRef.current = true;
                ctrl.resume();
              },
              getElapsedSeconds: () => ctrl.getElapsedSeconds(),
            };
            timerRef.current = wrapped;
            bindTimerController(wrapped);
          }}
        />
      )}
      {!started && <Navbar />}
      {showHints && <ControlsHint started={started} hudScale={_hudScale} />}
      {/* <IGBadge started={started} /> */}
      {started && <StatsDisplay hudScale={_hudScale} />}
      {started && !paused && <Crosshair />}
      <PauseMenu
        visible={started && paused}
        hideContent={settingsOpen}
        hudScale={_hudScale}
        onContinue={() => {
          // Only resume timer if it was running before pausing
          if (hadRunningBeforePauseRef.current) timerRef.current?.resume();
          onPauseChange(false);
          setPaused(false);
          requestPointerLockOnCanvas();
        }}
        onExit={() => {
          timerRef.current?.reset();
          onPauseChange(false);
          setPaused(false);
          setStarted(false);
          onExit?.();
        }}
        onSettings={() => setSettingsOpen(true)}
      />
      <SettingsMenu
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        hudScale={_hudScale}
        escapeSoundEnabled={started}
      />
    </>
  );
}
