import type { ComponentCategory } from "@/features/editor/ui/components/CategoryFilter";

export type ComponentMemberTransform = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
};

export type SavedComponent = {
  id: string; // e.g., comp-1
  label: string; // human label shown in the Components panel
  members: ComponentMemberTransform[]; // transforms are local to the component root
  category?: ComponentCategory; // Category for filtering (defaults to "target")
};

const STORAGE_KEY = "redblock.components";

export function loadComponents(): SavedComponent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedComponent[];
  } catch {
    return [];
  }
}

function saveComponents(list: SavedComponent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addComponent(input: Omit<SavedComponent, "id"> & { id?: string }): SavedComponent {
  const list = loadComponents();
  const nextId = input.id ?? nextComponentId(list);
  const comp: SavedComponent = { id: nextId, label: input.label, members: input.members };
  const idx = list.findIndex((c) => c.id === nextId);
  if (idx >= 0) list[idx] = comp; else list.push(comp);
  saveComponents(list);
  return comp;
}

export function removeComponent(id: string): void {
  const list = loadComponents().filter((c) => c.id !== id);
  saveComponents(list);
}

export function getComponent(id: string): SavedComponent | undefined {
  return loadComponents().find((c) => c.id === id);
}

function nextComponentId(list: SavedComponent[]): string {
  let max = 0;
  for (const c of list) {
    const m = /^comp-(\d+)$/.exec(c.id);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  return `comp-${max + 1}`;
}
