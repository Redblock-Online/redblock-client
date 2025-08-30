import  { useEffect, useState } from "react";

type Props = {
  onStart: (level: number) => void;
};

export default function StartScreen({ onStart }: Props) {
  const [sensitivity, setSensitivity] = useState<string>(() => {
    const saved = localStorage.getItem("mouseSensitivity");
    return saved ?? "0";
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
      const anyCanvas: any = canvas as any;
      const ret = anyCanvas?.requestPointerLock?.();
      if (ret && typeof ret.catch === "function") {
        ret.catch(() => {
          /* swallow SecurityError; user can click canvas to retry */
        });
      }
    } catch (_) {
      /* swallow; user can click inside the canvas later */
    }
  };

  const onStartClick = (level: number) => {
    // Arranca juego primero (oculta overlay) y luego pide pointer lock
    onStart(level);
    try {
      requestPointerLockOnCanvas();
    } catch (_) {
      /* noop */
    }
  };

  return (
    <div className="startScreen">
      <div className="background" />

      {/* Elementos decorativos */}
      <div className="cube" />
      <div className="cube red" />
      <div className="cube" />
      <div className="cube" />
      <div className="cube" />

      {/* Contenedor principal del menú */}
      <div className="menu-container" style={{ opacity: 1 }}>
        <img src="logo.png" alt="Logo" className="logo" />
        <img src="redblock-online.png" className="game-title" alt="Redblock Online" />
        <div className="menu-buttons">
          <button className="startButton menu-button primary" id="startButton1" onClick={() => onStartClick(1)}>
            PLAY 3 TARGETS
          </button>
          <button className="startButton menu-button" id="startButton2" onClick={() => onStartClick(2)}>
            PLAY 8 TARGETS
          </button>
          <button className="startButton menu-button" id="startButton3" onClick={() => onStartClick(3)}>
            PLAY 50 TARGETS
          </button>

          {/* Sensitivity slider - keep IDs for compatibility */}
          <div className="sensitivity-container">
            <div className="sensitivity-label">MOUSE SENSITIVITY</div>
            <div className="slider-container">
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
            <div className="sensitivity-value" id="sensitivityValue">
              {parseFloat(sensitivity || "0").toFixed(2)}
            </div>
          </div>

          <button className="menu-button exit-button" onClick={() => window.close()}>EXIT</button>
          <p className="hint">Click or press Space to choose randomly</p>
        </div>
        <div className="version">v0.2.0 alpha</div>
      </div>
    </div>
  );
}
