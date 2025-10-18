import { Fragment, useCallback, useEffect, useRef, useState } from "react";

export type TimerHintLine = {
  text: string;
  tone?: "positive" | "negative" | "neutral";
};

export type TimerHintTableRow = {
  label: string;
  score: string;
  best: string;
  scoreTone?: "positive" | "neutral";
  bestTone?: "positive" | "neutral";
};

export type TimerHintTable = {
  kind: "table";
  rows: TimerHintTableRow[];
  note?: string;
};

export type TimerHint =
  | string
  | TimerHintLine
  | Array<string | TimerHintLine>
  | TimerHintTable;

export type TimerController = {
  start: () => void;
  stop: (hint?: TimerHint) => void;
  reset: () => void;
  pause: () => void;
  resume: () => void;
  getElapsedSeconds: () => number;
};

export default function TimerDisplay({
  bindController,
  interval = 100,
  hudScale = 100,
}: {
  bindController: (ctrl: TimerController) => void;
  interval?: number;
  hudScale?: number;
}) {
  const [running, setRunning] = useState(false);
  const [text, setText] = useState("0.00s");
  const [hintState, setHintState] = useState<HintState>({ kind: "none" });
  const startRef = useRef(0);
  const timerId = useRef<number | null>(null);
  const elapsedOffsetRef = useRef(0); // seconds accumulated before last start/resume
  const runningRef = useRef(false);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const computeElapsedSeconds = useCallback(() => {
    const base = elapsedOffsetRef.current;
    if (runningRef.current) {
      const now = performance.now();
      return base + (now - startRef.current) / 1000;
    }
    return base;
  }, []);

  useEffect(() => {
    bindController({
      start: () => {
        setHintState({ kind: "none" });
        elapsedOffsetRef.current = 0;
        startRef.current = performance.now();
        setRunning(true);
        setText("0.00s");
      },
      stop: (h?: TimerHint) => {
        const elapsed = computeElapsedSeconds();
        elapsedOffsetRef.current = elapsed;
        setText(`${elapsed.toFixed(2)}s`);
        setRunning(false);
        setHintState(normalizeHint(h));
      },
      reset: () => {
        setRunning(false);
        setText("0.00s");
        setHintState({ kind: "none" });
        elapsedOffsetRef.current = 0;
      },
      pause: () => {
        if (!runningRef.current) return;
        const elapsed = computeElapsedSeconds();
        elapsedOffsetRef.current = elapsed;
        setRunning(false);
      },
      resume: () => {
        if (runningRef.current) return;
        setHintState({ kind: "none" });
        startRef.current = performance.now();
        setRunning(true);
      },
      getElapsedSeconds: () => computeElapsedSeconds(),
    });
  }, [bindController, computeElapsedSeconds]);

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
      const elapsed = computeElapsedSeconds();
      setText(`${elapsed.toFixed(2)}s`);
    }, interval);
    return () => {
      if (timerId.current) clearInterval(timerId.current);
      timerId.current = null;
    };
  }, [running, interval, computeElapsedSeconds]);

  const scaleValue = hudScale / 100;

  return (
    <div 
      id="timer" 
      className="absolute top-5 left-5 text-[32px] pointer-events-none z-10 select-none"
      style={{ transform: `scale(${scaleValue})`, transformOrigin: 'top left' }}
    >
      {text}
      {hintState.kind === "lines" ? (
        <div className="mt-2 text-[18px] leading-snug">
          {hintState.lines.map((line, idx) => {
            const toneClass =
              line.tone === "positive"
                ? "text-green-500"
                : "text-black";
            return (
              <div key={idx} className={toneClass}>
                {renderHintText(line.text)}
              </div>
            );
          })}
        </div>
      ) : null}
      {hintState.kind === "table" ? (
        <div className="mt-4 w-full border-2 border-black max-w-sm bg-white/85 p-4 text-left text-[16px] text-black shadow-md backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-6 gap-y-3 font-mono">
            <div className="text-xs uppercase tracking-[0.25em] text-black/70">Statistic</div>
            <div className="text-right text-xs uppercase tracking-[0.25em] text-black/70">Score</div>
            <div className="text-right text-xs uppercase tracking-[0.25em] text-black/70">Best</div>
            {hintState.table.rows.map((row, idx) => {
              const isLastRow = idx === hintState.table.rows.length - 1;
              return (
                <Fragment key={`${row.label}-${idx}`}>
                  <div className="font-medium text-black">{row.label}</div>
                  <div
                    className={`${row.scoreTone === "positive" ? "text-green-500" : "text-black"} text-right font-semibold`}
                  >
                    {renderHintText(row.score)}
                  </div>
                  <div
                    className={`${row.bestTone === "positive" ? "text-green-500" : "text-black"} text-right font-semibold`}
                  >
                    {renderHintText(row.best)}
                  </div>
                  {!isLastRow && idx === 2 ? (
                    <div className="col-span-3 h-px bg-black/20" />
                  ) : null}
                </Fragment>
              );
            })}
          </div>
          {hintState.table.note ? (
            <div className="mt-4 text-center text-sm text-black/70">
              {hintState.table.note}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type HintState =
  | { kind: "none" }
  | { kind: "lines"; lines: TimerHintLine[] }
  | { kind: "table"; table: TimerHintTable };

function normalizeHint(hint?: TimerHint): HintState {
  if (!hint) return { kind: "none" };
  if (isTimerHintTable(hint)) {
    return { kind: "table", table: hint };
  }

  const raw: Array<string | TimerHintLine> = Array.isArray(hint)
    ? hint
    : [hint as string | TimerHintLine];

  const lines: TimerHintLine[] = raw.map((item) => {
    if (typeof item === "string") {
      return { text: item, tone: "neutral" };
    }
    const tone: TimerHintLine["tone"] = item.tone ?? "neutral";
    return {
      text: item.text,
      tone,
    };
  });
  return { kind: "lines", lines };
}

function isTimerHintTable(hint: TimerHint): hint is TimerHintTable {
  return (
    typeof hint === "object" &&
    hint !== null &&
    !Array.isArray(hint) &&
    (hint as TimerHintTable).kind === "table"
  );
}

function renderHintText(text: string) {
  const numberFragment = /\d+(?:\.\d+)?(?:%|s)?/g;
  const parts = text.split(numberFragment);
  const matches = text.match(numberFragment) ?? [];

  const nodes: Array<ReactElement | string> = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) nodes.push(parts[i]);
    if (i < matches.length) {
      nodes.push(
        <span key={`num-${i}-${matches[i]}`} className="font-semibold">
          {matches[i]}
        </span>
      );
    }
  }

  return nodes.length > 0 ? nodes : text;
}
import type { ReactElement } from "react";
