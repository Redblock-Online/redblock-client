
import App from "./core/App";
import { mountUI, type UIController } from "@/ui/react/mountUI";

console.log("Hello there, i'm Freddy. I did this :)");
console.log("My github: https://github.com/freddysae0");

const app = new App();
const ui: UIController = mountUI({
  onStart: (level: number) => app.startGame(level),
});
app.attachUI(ui);
app.start();
