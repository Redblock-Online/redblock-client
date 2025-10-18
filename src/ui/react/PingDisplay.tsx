import { useState, useEffect } from "react";

type Props = {
  wsManager?: unknown; // Will be passed from UIRoot
};

export default function PingDisplay({ wsManager }: Props) {
  const [ping, setPing] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if Ping should be shown
    const checkSettings = () => {
      const saved = localStorage.getItem("gameSettings");
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          setVisible(settings.showPing || false);
        } catch {
          setVisible(false);
        }
      }
    };

    checkSettings();

    // Listen for settings changes
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.showPing !== undefined) {
        setVisible(customEvent.detail.showPing);
      }
    };

    window.addEventListener("gameSettingsChanged", handleSettingsChange);

    // Ping calculation (mock for now, can be integrated with actual WS later)
    const pingInterval = setInterval(() => {
      // TODO: Get actual ping from wsManager
      // For now, simulate ping between 10-50ms
      setPing(Math.floor(Math.random() * 40) + 10);
    }, 1000);

    return () => {
      window.removeEventListener("gameSettingsChanged", handleSettingsChange);
      clearInterval(pingInterval);
    };
  }, [wsManager]);

  if (!visible) return null;

  const pingColor = ping < 50 ? "text-green-600" : ping < 100 ? "text-yellow-600" : "text-red-600";

  return (
    <div className={`font-mono text-sm font-bold border-[3px] border-black bg-white px-3 py-1 ${pingColor}`}>
      PING: {ping}ms
    </div>
  );
}
