import React, { useRef } from "react";
import { AudioManager } from "@/utils/AudioManager";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export default function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  disabled = false,
}: Props) {
  const previousValueRef = useRef(value);
  const lastSoundTimeRef = useRef(0);

  const handleChange = (newValue: number) => {
    const audio = AudioManager.getInstance();
    const now = Date.now();
    
    // Throttle sound playback to every 100ms (0.1 seconds)
    if (now - lastSoundTimeRef.current >= 100) {
      // Play sound based on direction with different volumes
      if (newValue > previousValueRef.current) {
        audio.play('slider-up', {volume: 0.15, randomizePitch: true, pitchJitter: 0.01});
      } else if (newValue < previousValueRef.current) {
        audio.play('slider-down', {volume: 0.08, randomizePitch: true, pitchJitter: 0.01});
      }
      
      lastSoundTimeRef.current = now;
    }
    
    previousValueRef.current = newValue;
    onChange(newValue);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-[3px] border-black bg-white">
      <span className="font-mono font-bold text-xs tracking-wider uppercase whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-3 flex-1 max-w-[300px]">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="sensitivity-slider flex-1"
        />
        <span className="font-mono font-bold text-xs min-w-[50px] text-right">
          {value}{unit}
        </span>
      </div>
    </div>
  );
}
