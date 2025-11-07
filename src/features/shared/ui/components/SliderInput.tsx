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
  /** Optional helper/description text rendered under the label+slider inside the same box */
  description?: React.ReactNode;
  /** Optional icon to render inline before the description (pass any react-icon element) */
  descriptionIcon?: React.ReactNode;
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
  description,
  descriptionIcon,
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
        audio.play("slider-up", {
          volume: 0.15,
          randomizePitch: true,
          pitchJitter: 0.01,
          maxVoices: 3,
        });
      } else if (newValue < previousValueRef.current) {
        audio.play("slider-down", {
          volume: 0.1,
          randomizePitch: true,
          pitchJitter: 0.01,
          maxVoices: 3,
        });
      }

      lastSoundTimeRef.current = now;
    }

    previousValueRef.current = newValue;
    onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-1 px-4 py-2 border-[3px] border-black bg-white">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono font-bold text-xs tracking-wider uppercase whitespace-nowrap truncate">
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
            {value}
            {unit}
          </span>
        </div>
      </div>

      {description ? (
        <div className="px-0 py-0">
          <p className="font-mono text-[10px] uppercase opacity-70 leading-relaxed break-words mt-1">
            {descriptionIcon ? (
              <span className="inline-block mr-2 align-text-top">
                {descriptionIcon}
              </span>
            ) : null}
            {description}
          </p>
        </div>
      ) : null}
    </div>
  );
}
