import type { ReactElement } from "react";
import type { GeneratorConfig, RandomStaticGeneratorConfig, MovingTargetGeneratorConfig } from "../../types/generatorConfig";
import { EventConfigPanel } from "./EventConfigPanel";
import { AxisInput } from "./AxisInput";
import { createEmptyEventCollection } from "../../types/eventConfig";

type GeneratorConfigPanelProps = {
  config: GeneratorConfig;
  onChange: (config: GeneratorConfig) => void;
  onRequestGeneratorSelection?: (eventId: string) => void;
  setTyping?: (typing: boolean) => void;
};

export function GeneratorConfigPanel({ config, onChange, onRequestGeneratorSelection, setTyping }: GeneratorConfigPanelProps): ReactElement {
  const inputClass = "w-full rounded-md border border-editor-border bg-white px-3 py-2 text-editor-sm text-editor-text outline-none transition-all duration-150 focus:border-editor-accent";
  const labelClass = "text-editor-xs text-editor-muted font-medium mb-1.5 block";

  type BoundsKey = keyof RandomStaticGeneratorConfig["spawnBounds"];
  const BOUND_PAIRS: Record<BoundsKey, BoundsKey> = {
    minX: "maxX", maxX: "minX", minY: "maxY", maxY: "minY", minZ: "maxZ", maxZ: "minZ",
  };

  // Keep min <= max: moving one edge past the other drags the other edge along
  const handleBoundChange = (key: BoundsKey, value: number) => {
    if (config.type !== "randomStatic" || !Number.isFinite(value)) return;
    const bounds = { ...config.spawnBounds, [key]: value };
    const other = BOUND_PAIRS[key];
    const isMin = key.startsWith("min");
    if (isMin ? bounds[key] > bounds[other] : bounds[key] < bounds[other]) {
      bounds[other] = value;
    }
    onChange({ ...config, spawnBounds: bounds });
  };

  const handleNumberChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      onChange({ ...config, [field]: numValue });
    } else if (value === '' || value === '-') {
      // Allow empty or minus sign for typing
      return;
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t border-editor-border pt-4 mt-4">
      <div className="text-editor-xs text-editor-muted uppercase tracking-wider font-semibold">
        Generator Settings
      </div>

      {/* Enabled and Visible Checkboxes */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-editor-border bg-editor-bg text-editor-accent focus:ring-editor-accent focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-editor-sm text-editor-text">Enabled</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.visible}
            onChange={(e) => onChange({ ...config, visible: e.target.checked })}
            className="w-4 h-4 rounded border-editor-border bg-editor-bg text-editor-accent focus:ring-editor-accent focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-editor-sm text-editor-text">Visible</span>
        </label>
      </div>
      <div className="text-editor-xs text-editor-muted leading-relaxed">
        <strong>Enabled:</strong> If unchecked, targets won&apos;t spawn until activated by an event.<br/>
        <strong>Visible:</strong> If unchecked, targets will be invisible until enabled.
      </div>

      {/* Target Count */}
      <div>
        <label className={labelClass}>Target Count</label>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const newVal = Math.max(1, config.targetCount - 1);
              if (newVal !== config.targetCount) {
                onChange({ 
                  ...config, 
                  targetCount: newVal 
                });
              }
            }}
            className="px-3 py-2 rounded-md bg-editor-surface hover:bg-editor-panel text-editor-text text-editor-sm font-bold cursor-pointer transition-all duration-150"
          >
            −
          </button>
          <div className="flex-1">
            <AxisInput
              label=""
              value={config.targetCount}
              step={1}
              min={1}
              max={50}
              precision={0}
              onChange={(next) => {
                const count = Math.round(next);
                if (count !== config.targetCount) {
                  onChange({ ...config, targetCount: count });
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const newVal = Math.min(50, config.targetCount + 1);
              if (newVal !== config.targetCount) {
                onChange({ 
                  ...config, 
                  targetCount: newVal 
                });
              }
            }}
            className="px-3 py-2 rounded-md bg-editor-surface hover:bg-editor-panel text-editor-text text-editor-sm font-bold cursor-pointer transition-all duration-150"
          >
            +
          </button>
        </div>
      </div>

      {/* Target Scale */}
      <div>
        <label className={labelClass}>Target Scale</label>
        <select
          value={config.targetScale}
          onChange={(e) => onChange({ ...config, targetScale: parseFloat(e.target.value) })}
          onFocus={() => setTyping?.(true)}
          onBlur={() => setTyping?.(false)}
          className={inputClass}
        >
          <option value="0.2">Half Size (0.2)</option>
          <option value="0.4">Normal (0.4)</option>
          <option value="0.6">Large (0.6)</option>
        </select>
      </div>

      {/* Random Static specific settings */}
      {config.type === "randomStatic" && (
        <>
          <div className="text-editor-xs text-editor-muted uppercase tracking-wider font-semibold mt-2">
            Spawn Bounds (relative to generator)
          </div>
          
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ["minX", "Min X"], ["maxX", "Max X"],
              ["minY", "Min Y"], ["maxY", "Max Y"],
              ["minZ", "Min Z"], ["maxZ", "Max Z"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <AxisInput
                  label=""
                  value={(config as RandomStaticGeneratorConfig).spawnBounds[key]}
                  step={0.5}
                  precision={2}
                  onChange={(next) => handleBoundChange(key, next)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Moving-specific settings */}
      {config.type === "moving" && (
        <>
          <div>
            <label className={labelClass}>Movement Speed</label>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={(config as MovingTargetGeneratorConfig).speed}
              onChange={(e) => handleNumberChange("speed", e.target.value)}
              onFocus={() => setTyping?.(true)}
              onBlur={() => setTyping?.(false)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Movement Pattern</label>
            <select
              value={(config as MovingTargetGeneratorConfig).pattern}
              onChange={(e) => onChange({ ...config, pattern: e.target.value as "linear" | "circular" | "random" })}
              onFocus={() => setTyping?.(true)}
              onBlur={() => setTyping?.(false)}
              className={inputClass}
            >
              <option value="linear">Linear</option>
              <option value="circular">Circular</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Movement Amplitude</label>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              value={(config as MovingTargetGeneratorConfig).amplitude}
              onChange={(e) => handleNumberChange("amplitude", e.target.value)}
              onFocus={() => setTyping?.(true)}
              onBlur={() => setTyping?.(false)}
              className={inputClass}
            />
          </div>
        </>
      )}

      {/* Info text */}
      <div className="text-editor-xs text-editor-muted leading-relaxed">
        {config.type === "randomStatic" 
          ? "Generates static targets randomly positioned in front of the player."
          : "Generates moving targets with configurable speed and pattern."}
      </div>

      {/* Event Configuration */}
      <EventConfigPanel
        events={config.events || createEmptyEventCollection()}
        onChange={(events) => onChange({ ...config, events })}
        onRequestGeneratorSelection={onRequestGeneratorSelection}
        setTyping={setTyping}
      />
    </div>
  );
}