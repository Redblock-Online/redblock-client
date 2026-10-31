/**
 * Whether a keyboard event target is a form field where the user types text.
 * Editor shortcuts (G/R/F, B/I/C, WASD, Delete, Ctrl+Z...) must not fire there.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") {
    return false;
  }
  const element = target as HTMLElement;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true;
}
