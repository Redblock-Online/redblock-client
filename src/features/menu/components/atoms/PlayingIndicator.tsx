import React, { useEffect, useState } from "react";

type Props = {
  enabled: boolean;
  size?: number;
};

export default function PlayingIndicator({ enabled }: Props) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOn(false);
      return;
    }
    setOn(true);

    const blinkDuration = 1000; // Blink every 1000ms
    const id = setInterval(() => setOn((v) => !v), blinkDuration);

    return () => clearInterval(id);
  }, [enabled]);

  return (
    <div
      className="w-2 h-2 rounded-full border-2 border-black"
      style={{
        backgroundColor: on ? "#ff0000" : "#ffffff",
        transition: "background-color 250ms linear",
      }}
    />
  );
}
