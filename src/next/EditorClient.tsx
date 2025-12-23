"use client";

import { useEffect } from "react";

export default function EditorClient() {
  useEffect(() => {
    let disposed = false;

    const start = async () => {
      const { initEditor, disposeEditor } = await import("@/features/editor");
      if (disposed) return;
      initEditor();
      return disposeEditor;
    };

    let cleanup: (() => void) | undefined;
    start().then((fn) => {
      cleanup = fn;
    });

    return () => {
      disposed = true;
      try {
        cleanup?.();
      } catch {}
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <canvas id="canvas" className="absolute inset-0 h-full w-full" />
      <div id="ui-root" className="relative z-10 h-full w-full" />
    </div>
  );
}
