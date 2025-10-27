/**
 * SelectionBox - Visual rectangle for drag selection
 */
export class SelectionBox {
  private element: HTMLDivElement;
  private startX = 0;
  private startY = 0;
  private isActive = false;

  constructor(private container: HTMLElement) {
    this.element = document.createElement("div");
    this.element.style.position = "absolute";
    this.element.style.border = "2px solid #4772b3";
    this.element.style.backgroundColor = "rgba(71, 114, 179, 0.1)";
    this.element.style.pointerEvents = "none";
    this.element.style.display = "none";
    this.element.style.zIndex = "1000";
    this.container.appendChild(this.element);
  }

  public start(clientX: number, clientY: number): void {
    this.startX = clientX;
    this.startY = clientY;
    this.isActive = true;
    this.element.style.display = "block";
    this.element.style.left = `${clientX}px`;
    this.element.style.top = `${clientY}px`;
    this.element.style.width = "0px";
    this.element.style.height = "0px";
  }

  public update(clientX: number, clientY: number): void {
    if (!this.isActive) return;

    const left = Math.min(this.startX, clientX);
    const top = Math.min(this.startY, clientY);
    const width = Math.abs(clientX - this.startX);
    const height = Math.abs(clientY - this.startY);

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
  }

  public end(): { left: number; top: number; right: number; bottom: number } | null {
    if (!this.isActive) return null;

    const rect = this.element.getBoundingClientRect();
    const bounds = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };

    this.hide();
    return bounds;
  }

  public hide(): void {
    this.isActive = false;
    this.element.style.display = "none";
  }

  public isSelecting(): boolean {
    return this.isActive;
  }

  public dispose(): void {
    this.container.removeChild(this.element);
  }
}
