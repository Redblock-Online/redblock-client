"use client";

import { useEffect } from "react";

export default function EditorClient() {
  useEffect(() => {
    let disposed = false;

    const start = async () => {
      const { initEditor } = await import("@/editor/initEditor");
      if (disposed) return;
      initEditor();
    };

    void start();

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <canvas id="canvas" className="absolute inset-0 h-full w-full" />
      <div id="ui-root" className="relative z-10 h-full w-full" />
    </div>
  );
}
