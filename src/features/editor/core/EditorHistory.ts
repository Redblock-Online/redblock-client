import type { EditorBlock, SelectionTransform, SerializedNode } from "@/features/editor/types";
import type { GeneratorConfig } from "@/features/editor/types/generatorConfig";

export type SerializedPayload = { nodes: SerializedNode[]; componentIds: string[] };

export type HistoryAction =
  /** Blocks placed from the palette or pasted. `payload` restores them (with the same ids) on redo. */
  | { type: "create"; ids: string[]; payload: SerializedPayload }
  | { type: "delete"; ids: string[]; payload: SerializedPayload }
  | { type: "transform"; id: string; before: SelectionTransform; after: SelectionTransform }
  | {
      type: "multi-transform";
      entries: Array<{ id: string; before: SelectionTransform; after: SelectionTransform }>;
    }
  | { type: "group"; groupId: string; memberIds: string[] }
  | { type: "ungroup"; groupId: string; memberIds: string[] }
  | { type: "generator-config"; id: string; before: GeneratorConfig; after: GeneratorConfig }
  | { type: "rename"; id: string; before: string; after: string };

/**
 * The editor operations history needs. `EditorApp` satisfies it; tests use a headless stand-in.
 */
export interface HistoryEditor {
  removeBlock(id: string): boolean;
  getBlock(id: string): EditorBlock | undefined;
  setSelectionByIds(ids: string[]): void;
  clearSelection(): void;
  instantiateSerializedNodes(
    nodes: SerializedNode[],
    componentIds: string[],
    options?: { preserveIds?: boolean },
  ): EditorBlock[];
  groupByIds(ids: string[], groupId?: string): EditorBlock | null;
  ungroupSelected(): EditorBlock[] | null;
  updateGeneratorConfig(id: string, config: GeneratorConfig): boolean;
  renameBlock(id: string, name: string): boolean;
}

type Entry = { action: HistoryAction; time: number };

/** Consecutive generator edits on the same block within this window merge into one step. */
const COALESCE_MS = 800;
const DEFAULT_LIMIT = 200;

function cloneConfig(config: GeneratorConfig): GeneratorConfig {
  return JSON.parse(JSON.stringify(config)) as GeneratorConfig;
}

/**
 * Undo/redo stack for editor operations.
 *
 * @remarks
 * Blocks are always restored with their original ids (`preserveIds`), so older history entries
 * and generator event links keep pointing at the right blocks after an undo/redo cycle.
 */
export class EditorHistory {
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];

  constructor(
    private readonly editor: HistoryEditor,
    private readonly applyTransform: (id: string, transform: SelectionTransform) => void,
    private readonly limit: number = DEFAULT_LIMIT,
    private readonly now: () => number = () => Date.now(),
  ) {}

  public push(action: HistoryAction): void {
    const time = this.now();
    const top = this.undoStack[this.undoStack.length - 1];
    if (
      top &&
      action.type === "generator-config" &&
      top.action.type === "generator-config" &&
      top.action.id === action.id &&
      time - top.time < COALESCE_MS
    ) {
      top.action = { ...top.action, after: cloneConfig(action.after) };
      top.time = time;
    } else {
      const stored =
        action.type === "generator-config"
          ? { ...action, before: cloneConfig(action.before), after: cloneConfig(action.after) }
          : action;
      this.undoStack.push({ action: stored, time });
      if (this.undoStack.length > this.limit) {
        this.undoStack.shift();
      }
    }
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** @returns the undone action, or null when there was nothing to undo */
  public undo(): HistoryAction | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.revert(entry.action);
    this.redoStack.push(entry);
    return entry.action;
  }

  /** @returns the redone action, or null when there was nothing to redo */
  public redo(): HistoryAction | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.apply(entry.action);
    this.undoStack.push(entry);
    return entry.action;
  }

  private restore(payload: SerializedPayload): void {
    const created = this.editor.instantiateSerializedNodes(payload.nodes, payload.componentIds, { preserveIds: true });
    if (created.length > 0) {
      this.editor.setSelectionByIds(created.map((block) => block.id));
    } else {
      this.editor.clearSelection();
    }
  }

  private remove(ids: string[]): void {
    ids.forEach((id) => this.editor.removeBlock(id));
    this.editor.clearSelection();
  }

  private ungroup(groupId: string): void {
    if (!this.editor.getBlock(groupId)) return;
    this.editor.setSelectionByIds([groupId]);
    this.editor.ungroupSelected();
  }

  private revert(action: HistoryAction): void {
    switch (action.type) {
      case "create":
        this.remove(action.ids);
        break;
      case "delete":
        this.restore(action.payload);
        break;
      case "transform":
        this.applyTransform(action.id, action.before);
        break;
      case "multi-transform":
        action.entries.forEach((entry) => this.applyTransform(entry.id, entry.before));
        this.editor.setSelectionByIds(action.entries.map((entry) => entry.id));
        break;
      case "group":
        // Ungrouping keeps the real member objects (spawn, generators, components, nested groups)
        this.ungroup(action.groupId);
        break;
      case "ungroup":
        this.editor.groupByIds(action.memberIds, action.groupId);
        break;
      case "generator-config":
        this.editor.updateGeneratorConfig(action.id, cloneConfig(action.before));
        this.editor.setSelectionByIds([action.id]);
        break;
      case "rename":
        this.editor.renameBlock(action.id, action.before);
        break;
    }
  }

  private apply(action: HistoryAction): void {
    switch (action.type) {
      case "create":
        this.restore(action.payload);
        break;
      case "delete":
        this.remove(action.ids);
        break;
      case "transform":
        this.applyTransform(action.id, action.after);
        break;
      case "multi-transform":
        action.entries.forEach((entry) => this.applyTransform(entry.id, entry.after));
        this.editor.setSelectionByIds(action.entries.map((entry) => entry.id));
        break;
      case "group":
        this.editor.groupByIds(action.memberIds, action.groupId);
        break;
      case "ungroup":
        this.ungroup(action.groupId);
        break;
      case "generator-config":
        this.editor.updateGeneratorConfig(action.id, cloneConfig(action.after));
        this.editor.setSelectionByIds([action.id]);
        break;
      case "rename":
        this.editor.renameBlock(action.id, action.after);
        break;
    }
  }
}
