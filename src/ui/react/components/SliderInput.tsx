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
          onChange={(e) => onChange(parseFloat(e.target.value))}
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
