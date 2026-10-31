import { useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import type { SerializedScenario } from "@/features/editor/scenarios";
import { SettingsMenu } from "@/features/menu";
import { FPSCounter, PingDisplay } from "@/features/game/ui";

interface GameTabProps {
  scenario: SerializedScenario | null;
  isActive: boolean;
  onStop: () => void;
}

export function GameTab({ scenario, isActive, onStop }: GameTabProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameInstanceRef = useRef<{ dispose: () => void; setPaused?: (paused: boolean) => void } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isInitializingRef = useRef(false);
  // Incremented whenever the preview stops, so a bootstrap still in flight knows it is stale
  const sessionRef = useRef(0);
  const isActiveRef = useRef(isActive);
  // Bumped to re-run initialization when a stale bootstrap finishes after a quick stop/start
  const [initRetry, setInitRetry] = useState(0);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);
  const [showExitHint, setShowExitHint] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Separate effect for cleanup when isActive becomes false
  useEffect(() => {
    if (isActive) return;
    sessionRef.current += 1;
    if (document.pointerLockElement === canvasRef.current && canvasRef.current) {
      document.exitPointerLock();
    }
    if (gameInstanceRef.current) {
      gameInstanceRef.current.dispose();
      gameInstanceRef.current = null;
    }
    // Remove canvas from container; a fresh one is created for the next session
    if (canvasRef.current && canvasRef.current.parentElement) {
      canvasRef.current.parentElement.removeChild(canvasRef.current);
    }
    canvasRef.current = null;
    setShowExitHint(false);
    setSettingsOpen(false);
  }, [isActive]);

  // Dispose the preview if the editor unmounts while it runs
  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      gameInstanceRef.current?.dispose();
      gameInstanceRef.current = null;
    };
  }, []);

  // Listen to pointer lock changes to show exit hint
  useEffect(() => {
    if (!isActive) return;

    const handlePointerLockChange = () => {
      if (!document.pointerLockElement) {
        // Pointer lock was released, show hint
        setShowExitHint(true);
      } else {
        // Pointer lock is active, hide hint
        setShowExitHint(false);
      }
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [isActive]);

  // ESC key listener to exit preview when pointer lock is not active
  useEffect(() => {
    if (!isActive) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // If pointer lock is active, let browser handle it
        if (document.pointerLockElement) {
          console.log("[GameTab] ESC pressed - browser will release pointer lock");
          return;
        }
        
        // If pointer lock is not active, exit preview
        console.log("[GameTab] ESC pressed without pointer lock - exiting preview");
        onStop();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isActive, onStop]);

  useEffect(() => {
    if (!isActive || !scenario || !containerRef.current) {
      return;
    }

    if (isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;
    const session = sessionRef.current;

    (async () => {
      try {
        const { bootstrapGameInEditor } = await import("@/features/editor/core/gameBootstrap");
        if (session !== sessionRef.current || !containerRef.current) {
          if (isActiveRef.current) {
            setTimeout(() => setInitRetry((n) => n + 1), 0);
          }
          return;
        }

        // Reuse existing canvas or create a new one
        let canvas = canvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvas.id = "game-canvas";
          canvas.className = "absolute inset-0 w-full h-full";
          canvas.style.pointerEvents = "auto";
          canvasRef.current = canvas;
        } else {
          canvas.style.pointerEvents = "auto";
        }
        
        if (containerRef.current && !canvas.parentElement) {
          containerRef.current.appendChild(canvas);
        }
          
        // Initialize the game with the scenario
        const gameInstance = await bootstrapGameInEditor(canvas, scenario);
        if (session !== sessionRef.current) {
          // Stopped while loading: don't leave a hidden game running
          gameInstance.dispose();
          if (isActiveRef.current) {
            // Play was pressed again meanwhile; that start was skipped while we were busy
            setTimeout(() => setInitRetry((n) => n + 1), 0);
          }
          return;
        }
        gameInstanceRef.current = gameInstance;

        // Request pointer lock after a short delay to ensure canvas is ready
        setTimeout(() => {
          if (session === sessionRef.current && canvas && document.body.contains(canvas)) {
            try {
              const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
              result?.catch?.(() => {
                // Not fatal: the player can click the canvas to lock the pointer
              });
            } catch {
              // ignore
            }
          }
        }, 200);
      } catch (error) {
        console.error("[GameTab] Failed to initialize game:", error);
      } finally {
        isInitializingRef.current = false;
      }
    })();
  }, [isActive, scenario, initRetry]);
  
  if (!isActive) {
    return <div className="hidden" />;
  }

  return (
    <div className="absolute inset-0 flex bg-[#2b2b2b] pointer-events-auto">
      {/* Game Canvas Container - Takes full area */}
      <div ref={containerRef} className="relative flex-1 pointer-events-auto" />
      {/* Control buttons - Top right (always visible) */}
      <div className="fixed top-4 right-4 z-50 flex gap-3 pointer-events-auto">
        <button
          onClick={() => setSettingsOpen(true)}
          className="font-mono text-sm font-bold border-[3px] border-black bg-white text-black px-3 py-1 hover:bg-black hover:text-white transition-all duration-200"
        >
          SETTINGS
        </button>
        <button
          onClick={onStop}
          className="font-mono text-sm font-bold border-[3px] border-black bg-[#ef4444] text-white px-3 py-1 hover:bg-[#dc2626] transition-all duration-200"
        >
          STOP
        </button>
      </div>
      
      {/* Stats Display (FPS/Ping) - Below buttons (optional) */}
      <div className="fixed top-[4.5rem] right-4 z-50 flex gap-3 pointer-events-auto">
        <PingDisplay />
        <FPSCounter />
      </div>
      
     
      
      {/* Exit hint when pointer lock is released */}
      {showExitHint && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#323232] border border-[#1a1a1a] text-[#cccccc] px-6 py-4 rounded text-center pointer-events-none z-50">
          <div className="text-[16px] font-medium mb-2">Cursor Released</div>
          <div className="text-[13px] mb-2">Press <span className="font-medium text-[#4772b3]">ESC</span> again to exit preview</div>
          <div className="text-[11px] text-[#999999]">or click the screen to continue playing</div>
        </div>
      )}
      
      {/* Settings Menu Background */}
      {settingsOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center text-black" onClick={() => setSettingsOpen(false)}>
          {/* background grid overlay */}
          <div className="absolute inset-0 bg-white/90" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10" />
        </div>
      )}
      
      {/* Settings Menu Content - Rendered via Portal to be on top */}
      {typeof document !== "undefined" && createPortal(
        <SettingsMenu
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          hideBackground={true}
        />,
        document.body
      )}
    </div>
  );
}
