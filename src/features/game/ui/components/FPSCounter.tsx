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

    // Listen for FPS updates from the game loop
    const handleFPSUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.fps !== undefined) {
        setFps(customEvent.detail.fps);
      }
    };

    window.addEventListener("fpsUpdate", handleFPSUpdate);

    return () => {
      window.removeEventListener("gameSettingsChanged", handleSettingsChange);
      window.removeEventListener("fpsUpdate", handleFPSUpdate);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="font-mono text-sm font-bold border-[3px] border-black bg-white px-3 py-1">
      FPS: {fps}
    </div>
  );
}
