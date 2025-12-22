type Props = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function SelectInput({ label, value, options, onChange, disabled = false }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-[3px] border-black bg-white">
      <span className="font-mono font-bold text-xs tracking-wider uppercase whitespace-nowrap">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="font-mono font-bold tracking-wider border-[3px] border-black px-3 py-1 uppercase bg-white text-black text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/5 cursor-pointer"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
