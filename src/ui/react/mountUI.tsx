import { createRoot } from "react-dom/client";
import UIRoot from "./UIRoot";
import type { TimerController } from "./TimerDisplay";

export type GameApi = { onStart: (level: number) => void };
export type UIController = { timer: TimerController };

export function mountUI(api: GameApi): UIController {
  const el = document.getElementById("ui-root");
  if (!el) return { timer: { start() {}, stop() {}, reset() {} } };
  let timerCtrl: TimerController = { start() {}, stop() {}, reset() {} };
  const root = createRoot(el);
  root.render(
    <UIRoot
      onStart={api.onStart}
      bindTimerController={(ctrl) => {
        timerCtrl = ctrl;
      }}
    />
  );
  return {
    timer: {
      start: () => timerCtrl.start(),
      stop: (hint?: string) => timerCtrl.stop(hint),
      reset: () => timerCtrl.reset(),
    },
  };
}
