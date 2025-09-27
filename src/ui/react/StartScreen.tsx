import { useEffect, useState } from "react";
import Button from "@/ui/react/components/Button";
import type { ScenarioConfig } from "@/config/scenarios";

type Props = {
  scenarios: ScenarioConfig[];
  onStart: (scenarioId: string) => void;
};

export default function StartScreen({ scenarios, onStart }: Props) {
  const [sensitivity, setSensitivity] = useState<string>(() => {
    const saved = localStorage.getItem("mouseSensitivity");
    return saved ?? "1";
  });

  useEffect(() => {
    localStorage.setItem("mouseSensitivity", sensitivity);
  }, [sensitivity]);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSensitivity(e.target.value);
    // ControlsWithMovement listens to #sensitivityRange input event
  };

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

  return (
    <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] flex flex-col items-center justify-center gap-6 text-black z-10">
      {/* background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10 z-[1]" />

      {/* Decorative cubes */}
      <div className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float" style={{ top: '10%', left: '15%', transform: 'rotate(15deg)' }} />
      <div className="absolute w-10 h-10 border-2 border-black bg-[#ff0000] z-[2] animate-float" style={{ top: '20%', right: '20%', transform: 'rotate(-10deg)' }} />
      <div className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float" style={{ bottom: '30%', left: '10%', transform: 'rotate(25deg)' }} />
      <div className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float" style={{ bottom: '15%', right: '15%', transform: 'rotate(-20deg)' }} />
      <div className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float" style={{ top: '60%', left: '5%', transform: 'rotate(45deg)' }} />

      {/* Menu container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <img src="logo.png" alt="Logo" className="h-[200px] mx-auto translate-x-[20px]" />
        <img src="redblock-online.png" className="h-20 mt-10 mb-10" alt="Redblock Online" />
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
          {/* Sensitivity slider */}
          <div className=" p-6 border-[3px] border-black bg-white/90 min-w-[250px]">
            <div className="font-mono text-base font-bold  text-center tracking-wider">MOUSE SENSITIVITY</div>
            <div className="relative w-full h-5 my-4">
              <input
                type="range"
                min="0.01"
                max="2.0"
                step="0.01"
                value={sensitivity}
                onChange={onInput}
                className="sensitivity-slider"
                id="sensitivityRange"
              />
            </div>
            <div className="text-center font-mono font-bold text-sm" id="sensitivityValue">
              {parseFloat(sensitivity || '0').toFixed(2)}
            </div>
          </div>

          <Button size="lg" variant="outline" onClick={() => window.close()}>
            EXIT
          </Button>
          <p className="text-sm opacity-65">Click or press Space to choose randomly</p>
        </div>
        <div className="absolute bottom-4  text-sm opacity-60">v0.2.0 alpha</div>
      </div>
    </div>
  );
}
