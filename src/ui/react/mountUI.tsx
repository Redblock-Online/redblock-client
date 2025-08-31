import { createRoot } from "react-dom/client";
import UIRoot from "./UIRoot";
import type { TimerController } from "./TimerDisplay";

export type GameApi = { onStart: (level: number) => void };
export type UIController = { timer: TimerController };

export function mountUI(api: GameApi): UIController {
  const el = document.getElementById("ui-root");
  if (!el) return { timer: { start() {}, stop() {}, reset() {} } };
  let timerCtrl: TimerController | null = null;
  let pending: Array<() => void> = [];
  const root = createRoot(el);
  root.render(
    <UIRoot
      onStart={api.onStart}
      bindTimerController={(ctrl) => {
        timerCtrl = ctrl;
        // flush any queued actions
        pending.forEach((fn) => fn());
        pending = [];
      }}
    />
  );
  return {
    timer: {
      start: () => {
        if (timerCtrl) timerCtrl.start();
        else pending.push(() => timerCtrl && timerCtrl.start());
      },
      stop: (hint?: string) => {
        if (timerCtrl) timerCtrl.stop(hint);
        else pending.push(() => timerCtrl && timerCtrl.stop(hint));
      },
      reset: () => {
        if (timerCtrl) timerCtrl.reset();
        else pending.push(() => timerCtrl && timerCtrl.reset());
      },
    },
  };
}
