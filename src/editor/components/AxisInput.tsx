import { useCallback, useRef } from "react";
import type { ReactElement } from "react";

export type AxisInputProps = {
  label: "x" | "y" | "z" | string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  precision?: number; // for display rounding only
};

export function AxisInput({ label, value, onChange, step = 0.1, min, precision }: AxisInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const format = useCallback(
    (v: number): string => {
      const rounded = typeof precision === "number" ? Number(v.toFixed(precision)) : v;
      return String(rounded);
    },
    [precision],
  );

  const parse = useCallback((text: string): number | null => {
    const n = Number.parseFloat(text.trim());
    return Number.isNaN(n) ? null : n;
  }, []);

  const applyBounds = useCallback(
    (n: number): number => {
      if (typeof min === "number") {
        return Math.max(min, n);
      }
      return n;
    },
    [min],
  );

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 select-none text-[10px] uppercase tracking-widest text-rb-muted">
        {label}
      </span>
      <input
        ref={inputRef}
        type="text"
        className="h-8 w-full rounded border border-rb-border bg-white pl-7 pr-2 text-right text-rb-text outline-none focus:ring-1 focus:ring-black/20"
        value={format(value)}
        onChange={(e) => {
          const parsed = parse(e.target.value);
          if (parsed === null) return; // ignore invalid
          onChange(applyBounds(parsed));
        }}
        onKeyDown={(e) => {
          // prevent arrow up/down page scroll while focusing input
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? 1 : -1;
            const factor = e.shiftKey ? 10 : e.altKey || e.metaKey ? 0.1 : 1;
            onChange(applyBounds(value + dir * step * factor));
          }
        }}
        inputMode="decimal"
      />
    </div>
  );
}
