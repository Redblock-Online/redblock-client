import Image from "next/image";
import React, { useState, useEffect } from "react";
import Button from "@/ui/react/components/Button";
import type { ScenarioConfig } from "@/config/scenarios";
import { listScenarios, type StoredScenario } from "@/editor/scenarioStore";

type Props = {
  scenarios: ScenarioConfig[];
  onStart: (scenarioId: string) => void;
  onSettings: () => void;
};

export default function StartScreen({ scenarios, onStart, onSettings }: Props) {
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<StoredScenario[]>([]);

  useEffect(() => {
    // Load saved scenarios from localStorage
    const scenarios = listScenarios();
    setSavedScenarios(scenarios);
  }, []);

  const requestPointerLockOnCanvas = () => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
    try {
      const ret = canvas?.requestPointerLock?.();
      if (ret && typeof ret.catch === "function") {
        ret.catch(() => {
          /* swallow SecurityError; user can click canvas to retry */
        });
      }
    } catch (_) {
      /* swallow; user can click inside the canvas later */
    }
  };

  const onStartClick = (scenarioId: string) => {
    // Arranca juego primero (oculta overlay) y luego pide pointer lock
    onStart(scenarioId);
    try {
      requestPointerLockOnCanvas();
    } catch (_) {
      /* noop */
    }
  };

  const onLoadScenarioClick = (scenario: StoredScenario) => {
    // Create a custom scenario config that will load from localStorage
    const customScenarioId = `custom-${scenario.id}`;
    
    // Store the scenario data temporarily for the game to load
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`scenario-${customScenarioId}`, JSON.stringify(scenario.data));
    }
    
    // Start the game with this custom scenario
    onStartClick(customScenarioId);
    setShowScenarioMenu(false);
  };

  const onExitClick = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    const fallback = process.env.NEXT_PUBLIC_EXIT_URL ?? "about:blank";
    try {
      window.location.assign(fallback);
    } catch (error) {
      console.warn("Failed to navigate away via EXIT button", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] flex flex-col items-center justify-center gap-6 text-black z-10">
      {/* background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10 z-[1]" />

      {/* Decorative cubes */}
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ top: "10%", left: "15%", transform: "translate3d(0, 0, 0) rotate(15deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-[#ff0000] z-[2] animate-float will-change-transform"
        style={{ top: "20%", right: "20%", transform: "translate3d(0, 0, 0) rotate(-10deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ bottom: "30%", left: "10%", transform: "translate3d(0, 0, 0) rotate(25deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ bottom: "15%", right: "15%", transform: "translate3d(0, 0, 0) rotate(-20deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ top: "60%", left: "5%", transform: "translate3d(0, 0, 0) rotate(45deg)" }}
      />

      {/* Menu container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <Image
          src="/logo.png"
          alt="Logo"
          width={498}
          height={410}
          priority
          className="h-[200px] w-auto mx-auto translate-x-[20px]"
          sizes="(max-width: 768px) 60vw, 498px"
        />
        <Image
          src="/redblock-online.png"
          alt="Redblock Online"
          width={1719}
          height={172}
          className="h-20 w-auto mt-10 mb-10"
          sizes="(max-width: 768px) 70vw, 600px"
        />
        <div className="flex flex-col gap-4 items-center">
          {!showScenarioMenu ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
                <Button
                  className="startButton"
                  id="startButton-quick-warmup"
                  size="lg"
                  variant="primary"
                  onClick={() => onStartClick(scenarios[0].id)}
                >
                  Quick Warmup
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowScenarioMenu(true)}
                >
                  Load Scenario
                </Button>
              </div>
              <Button size="lg" variant="outline" onClick={onSettings}>
                SETTINGS
              </Button>
              <Button size="lg" variant="outline" onClick={onExitClick}>
                EXIT
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 w-full max-w-md">
                <h2 className="text-2xl font-bold text-center mb-2">Load Scenario</h2>
                {savedScenarios.length === 0 ? (
                  <p className="text-center opacity-65 py-8">
                    No saved scenarios found.<br />
                    Create one in the Editor!
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                    {savedScenarios.map((scenario) => (
                      <Button
                        key={scenario.id}
                        size="lg"
                        variant="outline"
                        onClick={() => onLoadScenarioClick(scenario)}
                        className="justify-between"
                      >
                        <span>{scenario.name}</span>
                        <span className="text-xs opacity-60">
                          {new Date(scenario.updatedAt).toLocaleDateString()}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowScenarioMenu(false)}
                  className="mt-4"
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </div>
        <div className="absolute bottom-4  text-sm opacity-60">v0.2.0 alpha</div>
      </div>
    </div>
  );
}
