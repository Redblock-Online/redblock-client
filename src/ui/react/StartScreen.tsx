import Image from "next/image";
import React from "react";
import Button from "@/ui/react/components/Button";
import type { ScenarioConfig } from "@/config/scenarios";

type Props = {
  scenarios: ScenarioConfig[];
  onStart: (scenarioId: string) => void;
  onSettings: () => void;
};

export default function StartScreen({ scenarios, onStart, onSettings }: Props) {

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
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            {scenarios.map((scenario, idx) => (
              <Button
                key={scenario.id}
                className="startButton"
                id={`startButton-${scenario.id}`}
                size="lg"
                variant={idx === 0 ? "primary" : "outline"}
                onClick={() => onStartClick(scenario.id)}
              >
                {scenario.label}
              </Button>
            ))}
          </div>
          <Button size="lg" variant="outline" onClick={onSettings}>
            SETTINGS
          </Button>

          <Button size="lg" variant="outline" onClick={onExitClick}>
            EXIT
          </Button>
          <p className="text-sm opacity-65">Click or press Space to choose randomly</p>
        </div>
        <div className="absolute bottom-4  text-sm opacity-60">v0.2.0 alpha</div>
      </div>
    </div>
  );
}
