import  { useEffect, useRef, useState } from "react";

export type TimerController = {
  start: () => void;
  stop: (hint?: string) => void;
  reset: () => void;
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

  useEffect(() => {
    bindController({
      start: () => {
        setHint(null);
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
      const elapsed = (performance.now() - startRef.current) / 1000;
      setText(`${elapsed.toFixed(2)}s`);
    }, interval);
    return () => {
      if (timerId.current) clearInterval(timerId.current);
      timerId.current = null;
    };
  }, [running, interval]);

  return (
    <div id="timer">
      {text}
      {hint ? <><br />{hint}</> : null}
    </div>
  );
}
