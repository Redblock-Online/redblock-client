import { useEffect, useState } from "react";

interface ControlsHintProps {
  started: boolean;
  hudScale?: number;
}

export default function ControlsHint({ started, hudScale = 100 }: ControlsHintProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (started) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [started]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const scaleValue = hudScale / 100;

  return (
    <>
      <img
        src="controls.png"
        className={`absolute bottom-5 left-5 w-[300px] pointer-events-none select-none transition-opacity duration-1000 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{ transform: `scale(${scaleValue})`, transformOrigin: 'bottom left' }}
      />
      {started && !visible && (
        <div 
          className="absolute bottom-2 left-5 text-[10px] text-black pointer-events-none select-none px-2 py-1 rounded"
          style={{ transform: `scale(${scaleValue})`, transformOrigin: 'bottom left' }}
        >
          Press F1 to show controls
        </div>
      )}
    </>
  );
}
