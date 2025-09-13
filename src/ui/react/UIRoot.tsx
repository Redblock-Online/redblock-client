import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StartScreen from "./StartScreen";
import TimerDisplay, { type TimerController } from "./TimerDisplay";
import ControlsHint from "./controls/ControlsHint";
import IGBadge from "./badges/IGBadge";
import Navbar from "./navbar";
import { fetchMe } from "./api/me";
import { useMeStore } from "./state/me";
import PauseMenu from "./PauseMenu";

type Props = {
  onStart: (level: number) => void;
  onPauseChange: (paused: boolean) => void;
  bindTimerController: (ctrl: TimerController) => void;
};

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export default function UIRoot({ onStart, onPauseChange, bindTimerController }: Props) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const { setUser, setHydrated } = useMeStore();
  const touch = useMemo(() => isTouchDevice(), []);
  const timerRef = useRef<TimerController | null>(null);
  const pausedRef = useRef(false);
  const timerRunningRef = useRef(false);
  const hadRunningBeforePauseRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

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

  const handleStart = useCallback((level: number) => {
    setStarted(true);
    setPaused(false);
    onStart(level);
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

  // Keyboard: start (Space) and toggle pause (P)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started && e.code === "Space") {
        // choose random level 1-3
        const level = Math.floor(Math.random() * 3) + 1;
        handleStart(level);
        return;
      }
      if (started && e.code === "KeyP") {
        const next = !pausedRef.current;
        const ctrl = timerRef.current;
        if (next) {
          // entering pause: remember if timer was running
          hadRunningBeforePauseRef.current = timerRunningRef.current;
          if (timerRunningRef.current) ctrl?.pause();
        } else {
          // leaving pause: only resume if it was running before
          if (hadRunningBeforePauseRef.current) ctrl?.resume();
          requestPointerLockOnCanvas();
        }
        onPauseChange(next);
        setPaused(next);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [started, handleStart, requestPointerLockOnCanvas, onPauseChange]);

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
  }, [started]);

  if (touch) {
    return (
      <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] flex items-center justify-center text-black">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10" />
        <div className="relative z-10 flex flex-col p-5 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">This game is designed for PC</h1>
        <IGBadge />
          <p>Please switch to a desktop or laptop for the best experience.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!started && <StartScreen onStart={handleStart} />}
      {started && (
        <TimerDisplay
          bindController={(ctrl) => {
            // Wrap the controller to track running state locally
            const wrapped: TimerController = {
              start: () => {
                timerRunningRef.current = true;
                ctrl.start();
              },
              stop: (hint?: string) => {
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
            };
            timerRef.current = wrapped;
            bindTimerController(wrapped);
          }}
        />
      )}
      {!started && <Navbar />}
      <ControlsHint />
      <IGBadge />
      <PauseMenu
        visible={started && paused}
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
        }}
      />
    </>
  );
}
