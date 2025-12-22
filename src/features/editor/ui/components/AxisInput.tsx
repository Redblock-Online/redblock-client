import { useCallback, useRef, useState } from "react";
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
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

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
      <span className="absolute left-2 top-1/2 -translate-y-1/2 select-none text-editor-xs uppercase text-editor-muted font-medium">
        {label}
      </span>
      <input
        ref={inputRef}
        type="text"
        className="h-8 w-full rounded-md border border-editor-border bg-white pl-6 pr-2 text-right text-editor-sm text-editor-text outline-none transition-all duration-150 focus:border-editor-accent focus:bg-editor-surface"
        value={isEditing ? draft : format(value)}
        onFocus={(e) => {
          setIsEditing(true);
          setDraft(e.currentTarget.value);
        }}
        onChange={(e) => {
          // Allow free-form typing while focused; validate on blur/enter
          setDraft(e.target.value);
        }}
        onBlur={() => {
          const parsed = parse(draft);
          if (parsed !== null) {
            onChange(applyBounds(parsed));
          }
          // reset editing state and reflect the latest external value
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          // prevent arrow up/down page scroll while focusing input
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? 1 : -1;
            const factor = e.shiftKey ? 10 : e.altKey || e.metaKey ? 0.1 : 1;
            onChange(applyBounds(value + dir * step * factor));
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const parsed = parse(isEditing ? draft : format(value));
            if (parsed !== null) {
              onChange(applyBounds(parsed));
            }
            // Commit and exit edit mode
            setIsEditing(false);
            // blur to trigger consistent formatting
            inputRef.current?.blur();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            // Cancel edits and revert display
            setIsEditing(false);
            setDraft("");
            inputRef.current?.blur();
          }
        }}
        inputMode="decimal"
      />
    </div>
  );
}