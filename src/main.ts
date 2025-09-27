
import App from "./core/App";
import { mountUI, type UIController } from "@/ui/react/mountUI";
import { ensureCsrfCookie } from "@/ui/react/api/http";
import logCredits from "./credits";

logCredits();

/**
 * Central application controller instance managing game lifecycle and UI interaction.
 *
 * Defined as export const app = new App() in src/main.ts.
 * Ties UI via attachUI(ui) and lifecycle via start(); UI callbacks call app methods.
 * App class lives in src/core/App.ts; handles game state, rendering, and controls.
 */

export const app = new App();

/**
 * Central UI controller instance managing UI lifecycle and game interaction.
 *
 * Defined as export const ui: UIController = mountUI({ ... }) in src/main.ts.
 * Ties UI via attachUI(ui) and lifecycle via start(); UI callbacks call app methods.
 * UIController interface lives in src/ui/react/mountUI.ts; handles DOM mounting, events, and state.
 */

// Initialize CSRF cookie once on app load for write requests
ensureCsrfCookie().catch(() => {});
export const ui: UIController = mountUI({
  onStart: (scenarioId: string) => app.startGame(scenarioId),
  onPauseChange: (paused: boolean) => app.setPaused(paused),
});
app.attachUI(ui);
app.start();
