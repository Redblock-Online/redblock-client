import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StartScreen from "./StartScreen";
import { SCENARIOS } from "@/config/scenarios";
import TimerDisplay, { type TimerController, type TimerHint } from "./TimerDisplay";
import ControlsHint from "./controls/ControlsHint";
import IGBadge from "./badges/IGBadge";
import Navbar from "./navbar";
import { fetchMe } from "./api/me";
import { useMeStore } from "./state/me";
import PauseMenu from "./PauseMenu";
import SettingsMenu from "./SettingsMenu";
import Crosshair from "./components/Crosshair";
import StatsDisplay from "./components/StatsDisplay";
import { AudioManager } from "@/utils/AudioManager";

type Props = {
  onStart: (scenarioId: string) => void;
  onPauseChange: (paused: boolean) => void;
  bindTimerController: (ctrl: TimerController) => void;
  onExit?: () => void;
};

type MusicCategory = "none" | "energy" | "calm";

const DEFAULT_MUSIC_CATEGORY: MusicCategory = "calm";

const CALM_TRACKS = ["uncausal", "calm"] as const;

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

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
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
  const touch = useMemo(() => isTouchDevice(), []);
  const timerRef = useRef<TimerController | null>(null);
  const pausedRef = useRef(false);
  const timerRunningRef = useRef(false);
  const hadRunningBeforePauseRef = useRef(false);
  const lastPausedForSoundRef = useRef(paused);
  const calmPlaybackIdRef = useRef<string | null>(null);
  const calmCurrentTrackRef = useRef<string | null>(null);
  const calmPlaylistIndexRef = useRef<number>(0);
  const calmNextTimeoutRef = useRef<number | null>(null);
  const previousMusicCategoryRef = useRef<MusicCategory>(musicCategory);

  const clearCalmTimeout = useCallback(() => {
    if (calmNextTimeoutRef.current !== null) {
      window.clearTimeout(calmNextTimeoutRef.current);
      calmNextTimeoutRef.current = null;
    }
  }, []);

  const startCalmTrack = useCallback((index?: number) => {
    if (typeof window === "undefined") return;
    const audio = AudioManager.getInstance();
    const playlistLength = CALM_TRACKS.length;

    const normalizedIndex = index !== undefined
      ? ((index % playlistLength) + playlistLength) % playlistLength
      : calmPlaylistIndexRef.current % playlistLength;
    calmPlaylistIndexRef.current = (normalizedIndex + 1) % playlistLength;
    const track = CALM_TRACKS[normalizedIndex];
    calmCurrentTrackRef.current = track;

    clearCalmTimeout();

    try {
      audio.ensureResumed().catch(() => {});
      CALM_TRACKS.forEach((name) => {
        if (name !== track) {
          audio.stopAllByName(name);
        }
      });
      if (calmPlaybackIdRef.current) {
        audio.stop(calmPlaybackIdRef.current);
        calmPlaybackIdRef.current = null;
      }
      const id = audio.play(track, {
        channel: "music",
        volume: 0.35,
        loop: false,
      });
      calmPlaybackIdRef.current = id ?? calmPlaybackIdRef.current;

      const duration = audio.getSoundDuration(track);
      if (duration && duration > 0) {
        calmNextTimeoutRef.current = window.setTimeout(() => {
          calmPlaybackIdRef.current = null;
          calmCurrentTrackRef.current = null;
          startCalmTrack();
        }, Math.max(0, Math.floor(duration * 1000)));
      } else {
        calmPlaybackIdRef.current = null;
        calmCurrentTrackRef.current = null;
      }
    } catch {
      /* ignore */
    }
  }, [clearCalmTimeout]);

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
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("audioSettingsChanged" as never, handleAudioSettingsChanged as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const audio = AudioManager.getInstance();
      audio.ensureResumed().catch(() => {});

      const previousCategory = previousMusicCategoryRef.current;
      previousMusicCategoryRef.current = musicCategory;

      if (musicCategory === "calm") {
        if (previousCategory !== "calm") {
          calmPlaylistIndexRef.current = 0;
          calmCurrentTrackRef.current = null;
        }

        const currentTrack = calmCurrentTrackRef.current;
        const isCurrentPlaying = currentTrack ? audio.isPlaying(currentTrack) : false;
        if (!isCurrentPlaying) {
          startCalmTrack();
        }
        return;
      }

      clearCalmTimeout();
      if (calmPlaybackIdRef.current) {
        audio.stop(calmPlaybackIdRef.current);
        calmPlaybackIdRef.current = null;
      }
      CALM_TRACKS.forEach((track) => audio.stopAllByName(track));
      calmCurrentTrackRef.current = null;
      calmPlaylistIndexRef.current = 0;
      if (musicCategory === "energy" && process.env.NODE_ENV !== "production") {
        console.debug("[UIRoot] Energy playlist selected - awaiting tracks");
      }
    } catch {
      /* ignore */
    }
  }, [musicCategory, startCalmTrack, clearCalmTimeout]);

  useEffect(() => () => {
    clearCalmTimeout();
  }, [clearCalmTimeout]);

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

  if (touch) {
    return (
      <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] flex items-center justify-center text-black">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10" />
        <div className="relative z-10 flex flex-col p-5 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">This game is designed for PC</h1>
          <IGBadge started={false} />
          <p>Please switch to a desktop or laptop for the best experience.</p>
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
