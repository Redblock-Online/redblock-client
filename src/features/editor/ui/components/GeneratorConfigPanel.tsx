import type { ReactElement } from "react";
import type { GeneratorConfig, RandomStaticGeneratorConfig, MovingTargetGeneratorConfig } from "@/features/editor/types";
import { EventConfigPanel } from "./EventConfigPanel";
import { createEmptyEventCollection } from "@/features/editor/types";

type GeneratorConfigPanelProps = {
  config: GeneratorConfig;
  onChange: (config: GeneratorConfig) => void;
  onRequestGeneratorSelection?: (eventId: string) => void;
  setTyping?: (typing: boolean) => void;
};

export function GeneratorConfigPanel({ config, onChange, onRequestGeneratorSelection, setTyping }: GeneratorConfigPanelProps): ReactElement {
  const inputClass = "w-full rounded border border-[#3a3a3a] bg-[#2b2b2b] px-2 py-1 text-[11px] text-white outline-none focus:border-[#4772b3]";
  const labelClass = "text-[10px] text-[#999999] mb-1";

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
    <div className="flex flex-col gap-3 border-t border-[#1a1a1a] pt-3 mt-3">
      <div className="text-[10px] text-[#999999] uppercase tracking-wider font-medium">
        Generator Settings
      </div>

      {/* Enabled and Visible Checkboxes */}
      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => {
              console.log(`[GeneratorConfigPanel] Enabled checkbox changed to: ${e.target.checked}`);
              onChange({ ...config, enabled: e.target.checked });
            }}
            className="w-4 h-4 rounded border-[#3a3a3a] bg-[#2b2b2b] text-[#4772b3] focus:ring-[#4772b3] focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-[11px] text-[#cccccc]">Enabled</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.visible}
            onChange={(e) => onChange({ ...config, visible: e.target.checked })}
            className="w-4 h-4 rounded border-[#3a3a3a] bg-[#2b2b2b] text-[#4772b3] focus:ring-[#4772b3] focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-[11px] text-[#cccccc]">Visible</span>
        </label>
      </div>
      <div className="text-[9px] text-[#666666] leading-relaxed">
        <strong>Enabled:</strong> If unchecked, targets won&apos;t spawn until activated by an event.<br/>
        <strong>Visible:</strong> If unchecked, targets will be invisible until enabled.
      </div>

      {/* Target Count */}
      <div>
        <label className={labelClass}>Target Count</label>
        <div className="flex gap-1">
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
            className="px-2 py-1 rounded bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white text-[11px] font-bold cursor-pointer"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            max="50"
            step="1"
            value={config.targetCount}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 1 && val <= 50) {
                onChange({ ...config, targetCount: val });
              }
            }}
            onFocus={() => setTyping?.(true)}
            onBlur={(e) => {
              setTyping?.(false);
              // Ensure valid value on blur
              const val = parseInt(e.target.value);
              if (isNaN(val) || val < 1) {
                onChange({ ...config, targetCount: 1 });
              } else if (val > 50) {
                onChange({ ...config, targetCount: 50 });
              }
            }}
            className={`flex-1 ${inputClass}`}
          />
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
            className="px-2 py-1 rounded bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white text-[11px] font-bold cursor-pointer"
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
          <div className="text-[10px] text-[#999999] uppercase tracking-wider font-medium mt-2">
            Spawn Bounds (relative to generator)
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Min X</label>
              <input
                type="number"
                step="0.5"
                value={(config as RandomStaticGeneratorConfig).spawnBounds.minX}
                onChange={(e) => onChange({ 
                  ...config, 
                  spawnBounds: { 
                    ...(config as RandomStaticGeneratorConfig).spawnBounds, 
                    minX: parseFloat(e.target.value) 
                  } 
                })}
                onFocus={() => setTyping?.(true)}
                onBlur={() => setTyping?.(false)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Max X</label>
              <input
                type="number"
                step="0.5"
                value={(config as RandomStaticGeneratorConfig).spawnBounds.maxX}
                onChange={(e) => onChange({ 
                  ...config, 
                  spawnBounds: { 
                    ...(config as RandomStaticGeneratorConfig).spawnBounds, 
                    maxX: parseFloat(e.target.value) 
                  } 
                })}
                onFocus={() => setTyping?.(true)}
                onBlur={() => setTyping?.(false)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Min Y</label>
              <input
                type="number"
                step="0.5"
                value={(config as RandomStaticGeneratorConfig).spawnBounds.minY}
                onChange={(e) => onChange({ 
                  ...config, 
                  spawnBounds: { 
                    ...(config as RandomStaticGeneratorConfig).spawnBounds, 
                    minY: parseFloat(e.target.value) 
                  } 
                })}
                onFocus={() => setTyping?.(true)}
                onBlur={() => setTyping?.(false)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Max Y</label>
              <input
                type="number"
                step="0.5"
                value={(config as RandomStaticGeneratorConfig).spawnBounds.maxY}
                onChange={(e) => onChange({ 
                  ...config, 
                  spawnBounds: { 
                    ...(config as RandomStaticGeneratorConfig).spawnBounds, 
                    maxY: parseFloat(e.target.value) 
                  } 
                })}
                onFocus={() => setTyping?.(true)}
                onBlur={() => setTyping?.(false)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Min Z</label>
              <input
                type="number"
                step="0.5"
                value={(config as RandomStaticGeneratorConfig).spawnBounds.minZ}
                onChange={(e) => onChange({ 
                  ...config, 
                  spawnBounds: { 
                    ...(config as RandomStaticGeneratorConfig).spawnBounds, 
                    minZ: parseFloat(e.target.value) 
                  } 
                })}
                onFocus={() => setTyping?.(true)}
                onBlur={() => setTyping?.(false)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Max Z</label>
              <input
                type="number"
                step="0.5"
                value={(config as RandomStaticGeneratorConfig).spawnBounds.maxZ}
                onChange={(e) => onChange({ 
                  ...config, 
                  spawnBounds: { 
                    ...(config as RandomStaticGeneratorConfig).spawnBounds, 
                    maxZ: parseFloat(e.target.value) 
                  } 
                })}
                onFocus={() => setTyping?.(true)}
                onBlur={() => setTyping?.(false)}
                className={inputClass}
              />
            </div>
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
      <div className="text-[9px] text-[#666666] leading-relaxed">
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
