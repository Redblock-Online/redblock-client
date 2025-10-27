import { useState, useEffect } from "react";

type Props = {
  label: string;
  currentKey: string;
  onKeyChange: (newKey: string) => void;
  disabled?: boolean;
  onPlayClick?: () => void;
  onPlayHover?: () => void;
};

export default function KeybindInput({ label, currentKey, onKeyChange, disabled, onPlayClick, onPlayHover }: Props) {
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (!isListening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier keys alone
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      // Escape cancels
      if (e.key === "Escape") {
        setIsListening(false);
        return;
      }

      // Get a display-friendly key name
      let keyName = e.key;
      if (e.code === "Space") keyName = "Space";
      
      onKeyChange(keyName.toLowerCase());
      setIsListening(false);
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Map mouse buttons to friendly names
      const buttonNames = ["mouse1", "mouse3", "mouse2", "mouse4", "mouse5"];
      const buttonName = buttonNames[e.button] || `mouse${e.button}`;
      
      onKeyChange(buttonName);
      setIsListening(false);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [isListening, onKeyChange]);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-[3px] border-black bg-white">
      <span className="font-mono font-bold text-xs tracking-wider uppercase">{label}</span>
      <button
        disabled={disabled}
        onClick={() => {
          onPlayClick?.();
          setIsListening(true);
        }}
        onMouseEnter={() => {
          if (!disabled) {
            onPlayHover?.();
          }
        }}
        className={`font-mono font-bold tracking-wider border-[3px] border-black px-4 py-1 min-w-[90px] uppercase transition-all text-xs ${
          isListening
            ? "bg-[#ff0000] text-white animate-pulse"
            : "bg-white text-black hover:bg-black/5"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isListening ? "..." : currentKey}
      </button>
    </div>
  );
}
