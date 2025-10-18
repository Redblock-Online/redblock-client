import { useState, useEffect } from "react";

export default function FPSCounter() {
  const [fps, setFps] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if FPS should be shown
    const checkSettings = () => {
      const saved = localStorage.getItem("gameSettings");
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          setVisible(settings.showFps || false);
        } catch {
          setVisible(false);
        }
      }
    };

    checkSettings();

    // Listen for settings changes
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.showFps !== undefined) {
        setVisible(customEvent.detail.showFps);
      }
    };

    window.addEventListener("gameSettingsChanged", handleSettingsChange);

    // FPS calculation
    let lastTime = performance.now();
    let frames = 0;
    let fpsInterval: number;

    const calculateFPS = () => {
      frames++;
      const currentTime = performance.now();
      const delta = currentTime - lastTime;

      if (delta >= 1000) {
        setFps(Math.round((frames * 1000) / delta));
        frames = 0;
        lastTime = currentTime;
      }

      fpsInterval = requestAnimationFrame(calculateFPS);
    };

    fpsInterval = requestAnimationFrame(calculateFPS);

    return () => {
      window.removeEventListener("gameSettingsChanged", handleSettingsChange);
      cancelAnimationFrame(fpsInterval);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="font-mono text-sm font-bold border-[3px] border-black bg-white px-3 py-1">
      FPS: {fps}
    </div>
  );
}
