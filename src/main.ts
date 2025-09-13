
import App from "./core/App";
import { mountUI, type UIController } from "@/ui/react/mountUI";
import { ensureCsrfCookie } from "@/ui/react/api/http";
import logCredits from "./credits";

logCredits();

const app = new App();
// Initialize CSRF cookie once on app load for write requests
ensureCsrfCookie().catch(() => {});
const ui: UIController = mountUI({
  onStart: (level: number) => app.startGame(level),
});
app.attachUI(ui);
app.start();
