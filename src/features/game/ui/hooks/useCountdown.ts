import { useEffect, useState } from "react";

/**
 * useCountdown
 * - Starts a countdown from `seconds` when `active` becomes true.
 * - Resets to `seconds` on each activation.
 * - Returns the current count, reaching 0 and stopping.
 */
export function useCountdown(active: boolean, seconds: number): number {
  const [count, setCount] = useState<number>(seconds);

  useEffect(() => {
    if (!active) return;

    // Reset each time we become active
    setCount(seconds);

    if (seconds <= 0) return;

    let remaining = seconds;
    const id = setInterval(() => {
      remaining -= 1;
      setCount(remaining);
      if (remaining <= 0) {
        clearInterval(id);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [active, seconds]);

  return count;
}

