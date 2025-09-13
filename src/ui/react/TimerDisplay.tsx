import  { useEffect, useRef, useState } from "react";

export type TimerController = {
  start: () => void;
  stop: (hint?: string) => void;
  reset: () => void;
  pause: () => void;
  resume: () => void;
};

export default function TimerDisplay({
  bindController,
  interval = 100,
}: {
  bindController: (ctrl: TimerController) => void;
  interval?: number;
}) {
  const [running, setRunning] = useState(false);
  const [text, setText] = useState("0.00s");
  const [hint, setHint] = useState<string | null>(null);
  const startRef = useRef(0);
  const timerId = useRef<number | null>(null);
  const elapsedOffsetRef = useRef(0); // seconds accumulated before last start/resume
  const runningRef = useRef(false);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    bindController({
      start: () => {
        setHint(null);
        elapsedOffsetRef.current = 0;
        startRef.current = performance.now();
        setRunning(true);
        setText("0.00s");
      },
      stop: (h?: string) => {
        setRunning(false);
        if (h) setHint(h);
      },
      reset: () => {
        setRunning(false);
        setText("0.00s");
        setHint(null);
        elapsedOffsetRef.current = 0;
      },
      pause: () => {
        if (!runningRef.current) return;
        const now = performance.now();
        const accumulated = (now - startRef.current) / 1000;
        elapsedOffsetRef.current += accumulated;
        setRunning(false);
      },
      resume: () => {
        if (runningRef.current) return;
        setHint(null);
        startRef.current = performance.now();
        setRunning(true);
      },
    });
  }, [bindController]);

  useEffect(() => {
    if (!running) {
      if (timerId.current) {
        clearInterval(timerId.current);
        timerId.current = null;
      }
      return;
    }
    // update immediately
    setText("0.00s");
    timerId.current = window.setInterval(() => {
      const elapsed = elapsedOffsetRef.current + (performance.now() - startRef.current) / 1000;
      setText(`${elapsed.toFixed(2)}s`);
    }, interval);
    return () => {
      if (timerId.current) clearInterval(timerId.current);
      timerId.current = null;
    };
  }, [running, interval]);

  return (
    <div id="timer" className="absolute top-5 left-5 text-[32px]  pointer-events-none z-10 select-none">
      {text}
      {hint ? <><br />{hint}</> : null}
    </div>
  );
}
