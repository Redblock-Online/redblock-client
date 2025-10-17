import { useEffect, useRef, useState, type ReactElement } from "react";
import type { SerializedScenario } from "../scenarioStore";

interface GameTabProps {
  scenario: SerializedScenario | null;
  isActive: boolean;
  onStop: () => void;
}

export function GameTab({ scenario, isActive, onStop }: GameTabProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameInstanceRef = useRef<{ dispose: () => void } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isInitializingRef = useRef(false);
  const [showExitHint, setShowExitHint] = useState(false);

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
        const { bootstrapGameInEditor } = await import("../utils/gameBootstrap");
        
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
    <div className="absolute inset-0 flex bg-white pointer-events-auto">
      {/* Game Canvas Container - Takes full area */}
      <div ref={containerRef} className="relative flex-1 pointer-events-auto" />
      
      {/* Exit hint when pointer lock is released */}
      {showExitHint && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-80 text-white px-8 py-4 rounded-lg text-center pointer-events-none z-50">
          <div className="text-2xl font-bold mb-2">Cursor Released</div>
          <div className="text-lg mb-2">Press <span className="font-bold text-yellow-300">ESC</span> again to exit preview</div>
          <div className="text-sm text-gray-300">or click the screen to continue playing</div>
        </div>
      )}
    </div>
  );
}
