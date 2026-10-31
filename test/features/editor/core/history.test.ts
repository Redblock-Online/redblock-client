import { beforeEach, describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { EditorHistory } from "@/features/editor/core/EditorHistory";
import { HeadlessEditor } from "./headlessEditor";
import type { GeneratorConfig } from "@/features/editor/types";

function setup(now: () => number = () => Date.now()) {
  const editor = new HeadlessEditor();
  const history = new EditorHistory(editor, (id, transform) => editor.applyTransform(id, transform), 200, now);
  return { editor, history };
}

describe("EditorHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("undo/redo of a placement restores the same block (id and generator config)", () => {
    const { editor, history } = setup();
    const gen = editor.addGenerator(1, 2, { targetCount: 8 });
    history.push({ type: "create", ids: [gen.id], payload: editor.serializer.serializeBlocksByIds([gen.id]) });

    history.undo();
    expect(editor.getBlock(gen.id)).toBeUndefined();

    history.redo();
    const restored = editor.getBlock(gen.id)!;
    expect(restored).toBeDefined();
    expect(restored.mesh.userData.isGenerator).toBe(true);
    expect(restored.generatorConfig?.targetCount).toBe(8);
  });

  it("restores deleted blocks under their original ids so older entries still apply", () => {
    const { editor, history } = setup();
    const block = editor.addBlock();
    const before = editor.transformOf(block.id);
    const after = { ...before, position: new Vector3(5, 0.5, 5) };
    editor.applyTransform(block.id, after);
    history.push({ type: "transform", id: block.id, before, after });

    const payload = editor.serializer.serializeBlocksByIds([block.id]);
    editor.removeBlock(block.id);
    history.push({ type: "delete", ids: [block.id], payload });

    history.undo(); // undo delete
    expect(editor.getBlock(block.id)).toBeDefined();
    history.undo(); // undo the move: must find the block by its old id
    expect(editor.getBlock(block.id)!.mesh.position.x).toBeCloseTo(0);

    history.redo();
    history.redo(); // redo delete
    expect(editor.getBlock(block.id)).toBeUndefined();
  });

  it("undoing a group keeps the real members (spawn, generator) instead of plain cubes", () => {
    const { editor, history } = setup();
    const spawn = editor.addSpawn(0, 0);
    const gen = editor.addGenerator(2, 0, { targetCount: 4 });
    const memberIds = [spawn.id, gen.id];
    const group = editor.groupByIds(memberIds)!;
    history.push({ type: "group", groupId: group.id, memberIds });

    history.undo();
    expect(editor.getBlock(group.id)).toBeUndefined();
    expect(editor.getBlock(spawn.id)!.mesh.userData.isSpawnPoint).toBe(true);
    expect(editor.getBlock(gen.id)!.generatorConfig?.targetCount).toBe(4);

    history.redo();
    expect(editor.ids()).toEqual([group.id]);
  });

  it("undo of ungroup regroups under the same id", () => {
    const { editor, history } = setup();
    const a = editor.addBlock(0, 0);
    const b = editor.addBlock(2, 0);
    const group = editor.groupByIds([a.id, b.id])!;
    editor.setSelectionByIds([group.id]);
    const members = editor.ungroupSelected()!.map((block) => block.id);
    history.push({ type: "ungroup", groupId: group.id, memberIds: members });

    history.undo();
    expect(editor.ids()).toEqual([group.id]);
    history.redo();
    expect(editor.ids().sort()).toEqual([a.id, b.id].sort());
  });

  it("records generator config edits and merges rapid edits of the same block", () => {
    let clock = 0;
    const { editor, history } = setup(() => clock);
    const gen = editor.addGenerator();
    const c0 = gen.generatorConfig!;
    const c1: GeneratorConfig = { ...c0, targetCount: 6 };
    const c2: GeneratorConfig = { ...c0, targetCount: 7 };
    const c3: GeneratorConfig = { ...c0, targetCount: 8 };

    editor.updateGeneratorConfig(gen.id, c1);
    history.push({ type: "generator-config", id: gen.id, before: c0, after: c1 });
    clock = 300;
    editor.updateGeneratorConfig(gen.id, c2);
    history.push({ type: "generator-config", id: gen.id, before: c1, after: c2 });
    clock = 5000;
    editor.updateGeneratorConfig(gen.id, c3);
    history.push({ type: "generator-config", id: gen.id, before: c2, after: c3 });

    history.undo();
    expect(editor.getBlock(gen.id)!.generatorConfig?.targetCount).toBe(7);
    history.undo(); // the two quick edits were merged into one step
    expect(editor.getBlock(gen.id)!.generatorConfig?.targetCount).toBe(5);
    expect(history.canUndo()).toBe(false);
    history.redo();
    expect(editor.getBlock(gen.id)!.generatorConfig?.targetCount).toBe(7);
  });

  it("records renames", () => {
    const { editor, history } = setup();
    const block = editor.addBlock();
    editor.renameBlock(block.id, "Wall");
    history.push({ type: "rename", id: block.id, before: "", after: "Wall" });
    history.undo();
    expect(editor.getBlock(block.id)!.name).toBe("");
    history.redo();
    expect(editor.getBlock(block.id)!.name).toBe("Wall");
  });

  it("a new action clears the redo stack", () => {
    const { editor, history } = setup();
    const block = editor.addBlock();
    history.push({ type: "rename", id: block.id, before: "", after: "A" });
    history.undo();
    expect(history.canRedo()).toBe(true);
    history.push({ type: "rename", id: block.id, before: "", after: "B" });
    expect(history.canRedo()).toBe(false);
  });
});
