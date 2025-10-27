import { useEffect, useState } from "react";

interface CrosshairProps {
  style?: "cross" | "dot" | "circle" | "square";
  color?: string;
  size?: number;
  opacity?: number;
}

export default function Crosshair({
  style = "cross",
  color = "#FFFFFF",
  size = 10,
  opacity = 100,
}: CrosshairProps) {
  const [settings, setSettings] = useState({ style, color, size, opacity });

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem("gameSettings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          style: parsed.crosshairStyle || "cross",
          color: parsed.crosshairColor || "#FFFFFF",
          size: parsed.crosshairSize || 10,
          opacity: parsed.crosshairOpacity || 100,
        });
      } catch (e) {
        console.error("[Crosshair] Error parsing settings:", e);
      }
    }

    // Listen for settings changes
    const handleSettingsChange = () => {
      const saved = localStorage.getItem("gameSettings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings({
            style: parsed.crosshairStyle || "cross",
            color: parsed.crosshairColor || "#FFFFFF",
            size: parsed.crosshairSize || 10,
            opacity: parsed.crosshairOpacity || 100,
          });
        } catch (e) {
          console.error("[Crosshair] Error parsing settings:", e);
        }
      }
    };

    window.addEventListener("gameSettingsChanged", handleSettingsChange);
    return () => window.removeEventListener("gameSettingsChanged", handleSettingsChange);
  }, []);

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: 9999,
    opacity: settings.opacity / 100,
    imageRendering: "crisp-edges",
    WebkitFontSmoothing: "none",
    backfaceVisibility: "hidden",
    willChange: "transform",
  };

  const renderCross = () => (
    <div style={baseStyle}>
      {/* Horizontal line */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: `${settings.size * 2}px`,
          height: "2px",
          backgroundColor: settings.color,
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 1px 0.5px rgba(0, 0, 0, 0.9)`,
        }}
      />
      {/* Vertical line */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "2px",
          height: `${settings.size * 2}px`,
          backgroundColor: settings.color,
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 1px 0.5px rgba(0, 0, 0, 0.9)`,
        }}
      />
    </div>
  );

  const renderDot = () => (
    <div style={baseStyle}>
      <div
        style={{
          width: `${settings.size}px`,
          height: `${settings.size}px`,
          borderRadius: "50%",
          backgroundColor: settings.color,
          boxShadow: `0 0 1px 0.5px rgba(0, 0, 0, 0.9)`,
        }}
      />
    </div>
  );

  const renderCircle = () => (
    <div style={baseStyle}>
      <div
        style={{
          width: `${settings.size * 2}px`,
          height: `${settings.size * 2}px`,
          borderRadius: "50%",
          border: `2px solid ${settings.color}`,
          boxShadow: `0 0 1px 0.5px rgba(0, 0, 0, 0.9)`,
        }}
      />
    </div>
  );

  const renderSquare = () => (
    <div style={baseStyle}>
      <div
        style={{
          width: `${settings.size * 2}px`,
          height: `${settings.size * 2}px`,
          border: `2px solid ${settings.color}`,
          boxShadow: `0 0 1px 0.5px rgba(0, 0, 0, 0.9)`,
        }}
      />
    </div>
  );

  switch (settings.style) {
    case "dot":
      return renderDot();
    case "circle":
      return renderCircle();
    case "square":
      return renderSquare();
    case "cross":
    default:
      return renderCross();
  }
}
