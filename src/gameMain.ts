import App from "./core/App";
import { mountUI, type UIController } from "@/features/menu";
import { ensureCsrfCookie } from "@/ui/react/api/http";

export function initGame(): void {
  const app = new App();
  ensureCsrfCookie().catch(() => {});
  const ui: UIController = mountUI({
    onStart: (scenarioId: string) => app.startGame(scenarioId),
    onPauseChange: (paused: boolean) => app.setPaused(paused),
    onExit: () => app.stopMusic(),
  });
  app.attachUI(ui);
  app.start();
}

export default initGame;
