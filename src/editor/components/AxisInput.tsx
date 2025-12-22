import { useCallback, useRef, useState } from "react";
import type { ReactElement } from "react";

export type AxisInputProps = {
  label: "x" | "y" | "z" | string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  precision?: number;
};

const axisColors: Record<string, string> = {
  x: "#ef4444",
  y: "#22c55e", 
  z: "#3b82f6",
};

export function AxisInput({ label, value, onChange, step = 0.1, min, precision }: AxisInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const axisColor = axisColors[label.toLowerCase()] || "#999999";

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
    <div className="relative group">
      <span 
        className="absolute left-2 top-1/2 -translate-y-1/2 select-none text-[9px] font-bold uppercase transition-colors duration-200"
        style={{ color: axisColor }}
      >
        {label}
      </span>
      <input
        ref={inputRef}
        type="text"
        className={`
          h-7 w-full rounded-md border bg-[#1e1e1e] pl-6 pr-2 text-right text-[11px] font-medium text-[#e0e0e0] 
          outline-none transition-all duration-200
          ${isEditing 
            ? "border-[#4772b3] bg-[#252525] ring-2 ring-[#4772b3]/20" 
            : "border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#232323]"
          }
        `}
        value={isEditing ? draft : format(value)}
        onFocus={(e) => {
          setIsEditing(true);
          setDraft(e.currentTarget.value);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          const parsed = parse(draft);
          if (parsed !== null) {
            onChange(applyBounds(parsed));
          }
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
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
            setIsEditing(false);
            inputRef.current?.blur();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setIsEditing(false);
            setDraft("");
            inputRef.current?.blur();
          }
        }}
        inputMode="decimal"
      />
      <div 
        className="absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-200"
        style={{ 
          backgroundColor: axisColor,
          width: isEditing ? "100%" : "0%",
          opacity: isEditing ? 1 : 0
        }}
      />
    </div>
  );
}
