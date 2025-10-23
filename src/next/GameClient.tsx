"use client";

import { useEffect } from "react";
import type App from "@/core/App";
import type { UIController } from "@/ui/react/mountUI";

export default function GameClient() {
  useEffect(() => {
    let disposed = false;
    let appInstance: App | undefined;
    let uiController: UIController | undefined;

    const start = async () => {
      const [{ default: logCredits }, { default: AppClass }, { mountUI }, { ensureCsrfCookie }] =
        await Promise.all([
          import("@/credits"),
          import("@/core/App"),
          import("@/ui/react/mountUI"),
          import("@/ui/react/api/http"),
        ]);

      if (disposed) return;

      logCredits();

      try {
        await ensureCsrfCookie();
      } catch (error) {
        console.warn("Failed to ensure CSRF cookie", error);
      }

      if (disposed) return;

      appInstance = new AppClass();
      uiController = mountUI({
        onStart: (scenarioId: string) => appInstance?.startGame(scenarioId),
        onPauseChange: (paused: boolean) => appInstance?.setPaused(paused),
        onExit: () => appInstance?.stopMusic(),
      });

      appInstance.attachUI(uiController);
      appInstance.start();
    };

    void start();

    return () => {
      disposed = true;
      if (appInstance) {
        appInstance.setPaused(true);
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <canvas id="canvas" className="absolute inset-0 h-full w-full" />
      <div id="ui-root" className="relative z-10 h-full w-full" />
    </div>
  );
}
