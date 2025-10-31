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
  const [showExitHint, setShowExitHint] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Separate effect for cleanup when isActive becomes false
  useEffect(() => {
    if (!isActive && gameInstanceRef.current) {
      console.log("[GameTab] isActive is false, disposing game instance");
      gameInstanceRef.current.dispose();
      gameInstanceRef.current = null;
      
      // Remove canvas from container
      if (canvasRef.current && canvasRef.current.parentElement) {
        canvasRef.current.parentElement.removeChild(canvasRef.current);
        console.log("[GameTab] Canvas removed from container");
      }
    }
  }, [isActive]);

  // Listen to pointer lock changes to show exit hint
  useEffect(() => {
    if (!isActive) return;

    const handlePointerLockChange = () => {
      if (!document.pointerLockElement) {
        // Pointer lock was released, show hint
        console.log("[GameTab] Pointer lock released - showing exit hint");
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
      console.log("[GameTab] Effect triggered", { isActive, hasScenario: !!scenario, hasContainer: !!containerRef.current });
      return;
    }

    if (isInitializingRef.current) {
      console.log("[GameTab] Already initializing, skipping...");
      return;
    }

    isInitializingRef.current = true;

    (async () => {
      try {
        console.log("[GameTab] Starting game initialization...");
        const { bootstrapGameInEditor } = await import("@/features/editor/core/gameBootstrap");
        
        // Reuse existing canvas or create a new one
        let canvas = canvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvas.id = "game-canvas";
          canvas.className = "absolute inset-0 w-full h-full";
          canvas.style.pointerEvents = "auto";
          canvasRef.current = canvas;
          console.log("[GameTab] Canvas created");
        } else {
          console.log("[GameTab] Reusing existing canvas");
          canvas.style.pointerEvents = "auto";
        }
        
        if (containerRef.current && !canvas.parentElement) {
          containerRef.current.appendChild(canvas);
          console.log("[GameTab] Canvas appended to container");
        }
          
        // Initialize the game with the scenario
        console.log("[GameTab] Bootstrapping game with scenario:", scenario.name);
        const gameInstance = await bootstrapGameInEditor(canvas, scenario);
        gameInstanceRef.current = gameInstance;
        console.log("[GameTab] Game initialized successfully");
        
        // Request pointer lock after a short delay to ensure canvas is ready
        setTimeout(() => {
          if (canvas && document.body.contains(canvas)) {
            console.log("[GameTab] Requesting pointer lock");
            canvas.requestPointerLock().catch((err) => {
              console.warn("[GameTab] Pointer lock request failed:", err);
            });
          }
        }, 200);
      } catch (error) {
        console.error("[GameTab] Failed to initialize game:", error);
      } finally {
        isInitializingRef.current = false;
      }
    })();
  }, [isActive, scenario]);
  
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
