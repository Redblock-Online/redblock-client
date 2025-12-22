import type { UIController } from "@/features/menu";
import type AppClass from "./core/App";

export let app: AppClass | undefined;
export let ui: UIController | undefined;

const isEditorRoute =
  typeof window !== "undefined" &&
  (window.location.pathname === "/editor" ||
    window.location.pathname.startsWith("/editor/"));

(async () => {
  const { default: logCredits } = await import("./credits");
  logCredits();

  if (isEditorRoute) {
    const { initEditor } = await import("@/features/editor");
    await initEditor();
    return;
  }

  const [{ default: App }, { mountUI }, { ensureCsrfCookie }] = await Promise.all([
    import("./core/App"),
    import("@/features/menu"),
    import("@/ui/react/api/http"),
  ]);

  try {
    await ensureCsrfCookie();
  } catch {}

  app = new App();
  ui = mountUI({
    onStart: (scenarioId: string) => app!.startGame(scenarioId),
    onPauseChange: (paused: boolean) => app!.setPaused(paused),
    onExit: () => app!.stopMusic(),
  });

  app.attachUI(ui);
  app.start();
})();
