import { useEffect, useState, type ReactNode, type ReactPortal } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: ReactNode }): ReactPortal | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const element = document.createElement("div");
    element.className = "rb-portal-layer";
    document.body.appendChild(element);
    setContainer(element);
    return () => {
      document.body.removeChild(element);
    };
  }, []);

  if (!container) {
    return null;
  }

  return createPortal(children, container);
}
