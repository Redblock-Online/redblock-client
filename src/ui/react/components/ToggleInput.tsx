type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export default function ToggleInput({ label, value, onChange, disabled = false }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-[3px] border-black bg-white">
      <span className="font-mono font-bold text-xs tracking-wider uppercase whitespace-nowrap">
        {label}
      </span>
      <button
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`font-mono font-bold tracking-wider border-[3px] border-black px-4 py-1 min-w-[60px] uppercase transition-all text-xs ${
          value
            ? "bg-[#00ff00] text-black"
            : "bg-white text-black hover:bg-black/5"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {value ? "ON" : "OFF"}
      </button>
    </div>
  );
}
