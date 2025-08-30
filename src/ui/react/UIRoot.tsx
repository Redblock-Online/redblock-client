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

  const handleStart = (level: number) => {
    setStarted(true);
    onStart(level);
  };

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
  }, [started, handleStart]);

  if (touch) {
    return (
      <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] flex items-center justify-center text-black">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10" />
        <div className="relative z-10 flex flex-col p-5 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">This game is designed for PC</h1>
        <IGBadge />
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
