type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Optional helper/description text rendered under the label inside the same box */
  description?: React.ReactNode;
  /** Optional icon to render inline before the description (pass any react-icon element) */
  descriptionIcon?: React.ReactNode;
};

export default function ToggleInput({
  label,
  value,
  onChange,
  disabled = false,
  description,
  descriptionIcon,
}: Props) {
  return (
    <div className="flex flex-col gap-1 px-4 py-2 border-[3px] border-black bg-white">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono font-bold text-xs tracking-wider uppercase whitespace-nowrap truncate">
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

      {description ? (
        <div className="px-0 py-0 ">
          <p className="font-mono text-[10px] uppercase opacity-70 leading-relaxed break-words mt-1 flex items-center gap-2">
            {descriptionIcon ? (
              <span className="flex items-center">{descriptionIcon}</span>
            ) : null}
            <span>{description}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
