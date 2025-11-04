import React from "react";

type Props = {
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
};

export default function MusicControlButton({ title, active = false, disabled = false, onClick, className = "", children }: Props) {
  const base = "flex items-center justify-center w-8 h-8 border-[3px] border-black transition select-none";
  const inactive = "bg-white text-black hover:bg-[#ff0000] hover:text-white";
  const activeCls = "bg-[#ff0000] text-white";
  const disabledCls = disabled ? "opacity-50 pointer-events-none" : "";

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[base, active ? activeCls : inactive, disabledCls, className].join(" ")}
    >
      {children}
    </button>
  );
}
