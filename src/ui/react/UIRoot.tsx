import { useEffect, useMemo, useState } from "react";
import StartScreen from "./StartScreen";
import TimerDisplay, { type TimerController } from "./TimerDisplay";
import ControlsHint from "./controls/ControlsHint";
import IGBadge from "./badges/IGBadge";

type Props = {
  onStart: (level: number) => void;
  bindTimerController: (ctrl: TimerController) => void;
};

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export default function UIRoot({ onStart, bindTimerController }: Props) {
  const [started, setStarted] = useState(false);
  const touch = useMemo(() => isTouchDevice(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started && e.code === "Space") {
        // choose random level 1-3
        const level = Math.floor(Math.random() * 3) + 1;
        handleStart(level);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [started]);

  const handleStart = (level: number) => {
    setStarted(true);
    onStart(level);
  };

  if (touch) {
    return (
      <div className="startScreen">
        <div className="background" />
        <div className="mobile-warning">
          <h1>This game is designed for PC</h1>
          <p>Please switch to a desktop or laptop for the best experience.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!started && <StartScreen onStart={handleStart} />}
      <TimerDisplay bindController={bindTimerController} />
      <ControlsHint />
      <IGBadge />
    </>
  );
}
