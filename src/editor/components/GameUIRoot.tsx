import { useCallback, useEffect, useRef, useState } from "react";
import TimerDisplay, { type TimerController, type TimerHint } from "@/ui/react/TimerDisplay";
import ControlsHint from "@/ui/react/controls/ControlsHint";
import PauseMenu from "@/ui/react/PauseMenu";

type Props = {
  onStart: (scenarioId: string) => void;
  onPauseChange: (paused: boolean) => void;
  bindTimerController: (ctrl: TimerController) => void;
  autoStartScenario?: string;
  isEditorPreview?: boolean;
};

export default function GameUIRoot({ onStart, onPauseChange, bindTimerController, autoStartScenario, isEditorPreview = false }: Props) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<TimerController | null>(null);
  const pausedRef = useRef(false);
  const timerRunningRef = useRef(false);
  const hadRunningBeforePauseRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const requestPointerLockOnCanvas = useCallback(() => {
    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
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

  // Auto-start if scenario is provided
  useEffect(() => {
    if (autoStartScenario && !started) {
      handleStart(autoStartScenario);
    }
  }, [autoStartScenario, started, handleStart]);

  // Auto-pause when pointer lock is lost (e.g., user presses Esc)
  // Disabled in editor preview mode
  useEffect(() => {
    if (isEditorPreview) return; // Don't pause in editor preview
    
    const onPointerLockChange = () => {
      const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
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
  }, [started, onPauseChange, isEditorPreview]);

  return (
    <>
      {/* Hide timer in editor preview */}
      {started && !isEditorPreview && (
        <TimerDisplay
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
      {/* Hide controls hint in editor preview */}
      {!isEditorPreview && <ControlsHint started={started} />}
      {/* Hide pause menu in editor preview */}
      {!isEditorPreview && (
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
      )}
    </>
  );
}
