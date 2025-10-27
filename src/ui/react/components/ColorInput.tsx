type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const PRESET_COLORS = [
  "#FFFFFF", // White
  "#00FF00", // Green
  "#FF0000", // Red
  "#00FFFF", // Cyan
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#FFA500", // Orange
  "#0000FF", // Blue
];

export default function ColorInput({ label, value, onChange, disabled = false }: Props) {
  return (
    <div className="flex flex-col gap-2 px-4 py-2 border-[3px] border-black bg-white">
      <span className="font-mono font-bold text-xs tracking-wider uppercase">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={`w-8 h-8 border-[3px] border-black transition-all ${
              value.toUpperCase() === color ? "scale-110 shadow-lg" : "hover:scale-105"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-8 h-8 border-[3px] border-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
