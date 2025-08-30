export type TimerOptions = {
  updateInterval?: number; // in ms, default 100
  format?: (elapsedSeconds: number) => string;
  initialText?: string; // default "0.00s"
};

export default class Timer {
  private el: HTMLElement;
  private startTime = 0;
  private intervalId: number | null = null;
  private _running = false;
  private readonly updateInterval: number;
  private readonly formatFn: (s: number) => string;

  constructor(elOrSelector: string | HTMLElement, options: TimerOptions = {}) {
    this.el =
      typeof elOrSelector === "string"
        ? (document.querySelector(elOrSelector) as HTMLElement)
        : elOrSelector;

    this.updateInterval = options.updateInterval ?? 100;
    this.formatFn = options.format ?? ((s) => `${s.toFixed(2)}s`);

    const initial = options.initialText ?? this.formatFn(0);
    if (this.el) this.el.innerText = initial;
  }

  get running() {
    return this._running;
  }

  start() {
    this.stop(); // ensure clean state
    this.startTime = performance.now();
    this._running = true;
    this.tick(); // immediate render
    this.intervalId = window.setInterval(
      () => this.tick(),
      this.updateInterval
    );
  }

  stop(): number {
    const elapsed = this.getElapsedSeconds();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._running = false;
    // keep last rendered time in place
    return elapsed;
  }

  reset() {
    if (this.el) this.el.innerText = this.formatFn(0);
    this.stop();
    this.startTime = 0;
  }

  getElapsedSeconds(): number {
    if (!this._running && this.startTime === 0) return 0;
    const now = performance.now();
    return Math.max(0, (now - this.startTime) / 1000);
  }

  appendHint(text: string) {
    if (!this.el) return;
    this.el.innerText += `\n${text}`;
  }

  private tick() {
    if (!this.el) return;
    const elapsed = (performance.now() - this.startTime) / 1000;
    this.el.innerText = this.formatFn(elapsed);
  }
}

