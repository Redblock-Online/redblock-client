import { useCallback, useRef, useState } from "react";
import type { ReactElement } from "react";

export type AxisInputProps = {
  label: "x" | "y" | "z" | string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number; // for display rounding only
};

export function AxisInput({ label, value, onChange, step = 0.1, min, max, precision }: AxisInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  // Set when Enter/Escape already handled the edit, so the blur that follows does not commit again
  const skipBlurCommitRef = useRef(false);

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
      let bounded = n;
      if (typeof min === "number") {
        bounded = Math.max(min, bounded);
      }
      if (typeof max === "number") {
        bounded = Math.min(max, bounded);
      }
      return bounded;
    },
    [min, max],
  );

  // Commit only real edits: re-submitting the rounded display text would silently round the
  // underlying value (e.g. 3.14159 -> 3.14) just by focusing and leaving the field.
  const commitDraft = useCallback(
    (text: string) => {
      if (text.trim() === format(value)) {
        return;
      }
      const parsed = parse(text);
      if (parsed !== null) {
        onChange(applyBounds(parsed));
      }
    },
    [applyBounds, format, onChange, parse, value],
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
          skipBlurCommitRef.current = false;
          setIsEditing(true);
          setDraft(e.currentTarget.value);
        }}
        onChange={(e) => {
          // Allow free-form typing while focused; validate on blur/enter
          setDraft(e.target.value);
        }}
        onBlur={() => {
          if (!skipBlurCommitRef.current) {
            commitDraft(draft);
          }
          skipBlurCommitRef.current = false;
          // reset editing state and reflect the latest external value
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          // prevent arrow up/down page scroll while focusing input
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? 1 : -1;
            const factor = e.shiftKey ? 10 : e.altKey || e.metaKey ? 0.1 : 1;
            const base = isEditing ? parse(draft) ?? value : value;
            const next = applyBounds(base + dir * step * factor);
            onChange(next);
            if (isEditing) {
              setDraft(format(next));
            }
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft(isEditing ? draft : format(value));
            skipBlurCommitRef.current = true;
            // Commit and exit edit mode
            setIsEditing(false);
            // blur to trigger consistent formatting
            inputRef.current?.blur();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            // Cancel edits and revert display (the blur below must not commit the draft)
            skipBlurCommitRef.current = true;
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