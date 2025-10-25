import React, { useCallback } from "react";
import { AudioManager } from "@/utils/AudioManager";

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
  disabled = false,
  onClick,
  onMouseEnter,
  ...rest
}: Props) {
  const playClickSound = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const audio = AudioManager.getInstance();
      audio.play("btn-click01", {
        variants: ["btn-click01", "btn-click02", "btn-click03"],
        volume: 0.45,
        randomizePitch: true,
        pitchJitter: 0.012,
        channel: "sfx",
      });
    } catch {
      /* ignore */
    }
  }, []);

  const playHoverSound = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const audio = AudioManager.getInstance();
      audio.play("btn-hover", {
        volume: 0.2,
        randomizePitch: true,
        pitchJitter: 0.01,
        channel: "sfx",
      });
    } catch {
      /* ignore */
    }
  }, []);

  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      playClickSound();
    }
    onClick?.(event);
  }, [disabled, onClick, playClickSound]);

  const handleMouseEnter = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      playHoverSound();
    }
    onMouseEnter?.(event);
  }, [disabled, onMouseEnter, playHoverSound]);

  const base = cn(
    "flex items-center justify-center font-mono font-bold tracking-wider border-[3px] border-black transition-all select-none",
    "uppercase text-center",
    // disable interactions appearance
    "disabled:opacity-50 disabled:cursor-not-allowed",
    // shared hover effect only when enabled
    !disabled && "hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-red-3",
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
    <button
      type={type}
      disabled={disabled}
      className={cn(base, byVariant[variant], bySize[size], className)}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      {...rest}
    >
      {leftIcon ? <span className="mr-3 inline-flex items-center ">{leftIcon}</span> : null}
      <p>{children}</p>
      {rightIcon ? <span className="ml-3 inline-flex items-center">{rightIcon}</span> : null}
    </button>
  );
}
