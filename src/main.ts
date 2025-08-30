
import App from "./core/App";
import { mountUI, type UIController } from "@/ui/react/mountUI";
import logCredits from "./credits";

logCredits();

const app = new App();
const ui: UIController = mountUI({
  onStart: (level: number) => app.startGame(level),
});
app.attachUI(ui);
app.start();
