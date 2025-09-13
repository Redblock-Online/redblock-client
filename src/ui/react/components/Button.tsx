import React from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "lg" | "md" | "sm";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  leftIcon,
  rightIcon,
  type = "button",
  ...rest
}: Props) {
  const base = cn(
    "flex items-center justify-center font-mono font-bold tracking-wider border-[3px] border-black transition-all select-none",
    "uppercase text-center",
    // shared hover effect
    "hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-red-3",
  );

  const byVariant: Record<Variant, string> = {
    primary: "bg-[#ff0000] text-white hover:bg-black",
    outline: "bg-transparent text-black hover:bg-black hover:text-white",
    ghost: "bg-transparent text-black hover:bg-black/5",
  };

  const bySize: Record<Size, string> = {
    lg: "px-12 py-4 min-w-[250px]",
    md: "px-6 py-2",
    sm: "px-4 py-1.5 text-sm",
  };

  return (
    <button type={type} className={cn(base, byVariant[variant], bySize[size], className)} {...rest}>
      {leftIcon ? <span className="mr-3 inline-flex items-center ">{leftIcon}</span> : null}
      <p>{children}</p>
      {rightIcon ? <span className="ml-3 inline-flex items-center">{rightIcon}</span> : null}
    </button>
  );
}

