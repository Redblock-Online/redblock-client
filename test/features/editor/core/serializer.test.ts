import { beforeEach, describe, expect, it } from "vitest";
import { Euler, Group, Vector3 } from "three";
import { HeadlessEditor } from "./headlessEditor";
import type { SavedComponent } from "@/features/editor/components-system";
import type { GeneratorConfig, StartGeneratorEvent } from "@/features/editor/types";

function linkEvent(targetGeneratorId: string): StartGeneratorEvent {
  return { id: "ev-1", type: "startGenerator", enabled: true, targetGeneratorId };
}

function firstLink(config: GeneratorConfig | undefined): string | undefined {
  const event = config?.events?.onComplete[0];
  return event && event.type === "startGenerator" ? event.targetGeneratorId : undefined;
}

describe("EditorSerializer round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps ids, names, transforms, spawn and generator events across export/import", () => {
    const source = new HeadlessEditor();
    const gone = source.addBlock(0, 0);
    const wall = source.addBlock(2, 0);
    wall.mesh.rotation.set(0.1, 0.2, 0.3);
    wall.mesh.scale.set(2, 3, 4);
    source.blocks.renameBlock(wall.id, "Wall");
    const genA = source.addGenerator(4, 0, { targetCount: 7, enabled: true });
    const genB = source.addGenerator(6, 0, { enabled: false, visible: false });
    genA.generatorConfig = { ...genA.generatorConfig!, events: { onComplete: [linkEvent(genB.id)] } };
    genA.mesh.userData.generatorConfig = genA.generatorConfig;
    const spawn = source.addSpawn(1, 1);
    // A gap in the id sequence: before the fix, import renumbered every block
    source.removeBlock(gone.id);

    const { nodes } = source.serializer.serializeScene();
    const target = new HeadlessEditor();
    target.serializer.instantiateNodes(JSON.parse(JSON.stringify(nodes)), new Map(), { preserveIds: true });

    expect(target.ids().sort()).toEqual([wall.id, genA.id, genB.id, spawn.id].sort());
    const restoredWall = target.getBlock(wall.id)!;
    expect(restoredWall.name).toBe("Wall");
    expect(restoredWall.mesh.rotation.toArray().slice(0, 3).map((v) => +(v as number).toFixed(5))).toEqual([0.1, 0.2, 0.3]);
    expect(restoredWall.mesh.scale.toArray().map((v) => +v.toFixed(5))).toEqual([2, 3, 4]);
    expect(target.getBlock(spawn.id)!.mesh.userData.isSpawnPoint).toBe(true);
    const restoredA = target.getBlock(genA.id)!;
    expect(restoredA.mesh.userData.isGenerator).toBe(true);
    expect(restoredA.generatorConfig?.targetCount).toBe(7);
    expect(firstLink(restoredA.generatorConfig)).toBe(genB.id);
    expect(target.getBlock(genB.id)!.generatorConfig).toMatchObject({ enabled: false, visible: false });
  });

  it("keeps generators and names nested inside groups, including after ungroup", () => {
    const source = new HeadlessEditor();
    const block = source.addBlock(0, 0);
    source.blocks.renameBlock(block.id, "Floor");
    const gen = source.addGenerator(2, 0, { targetCount: 3 });
    const group = source.groupByIds([block.id, gen.id])!;

    const { nodes } = source.serializer.serializeScene();
    const target = new HeadlessEditor();
    target.serializer.instantiateNodes(JSON.parse(JSON.stringify(nodes)), new Map(), { preserveIds: true });

    expect(target.ids()).toEqual([group.id]);
    target.setSelectionByIds([group.id]);
    target.ungroupSelected();
    expect(target.ids().sort()).toEqual([block.id, gen.id].sort());
    expect(target.getBlock(block.id)!.name).toBe("Floor");
    const restoredGen = target.getBlock(gen.id)!;
    expect(restoredGen.mesh.userData.isGenerator).toBe(true);
    expect(restoredGen.generatorConfig?.targetCount).toBe(3);
  });

  it("does not alias live generator config objects in serialized snapshots", () => {
    const editor = new HeadlessEditor();
    const gen = editor.addGenerator();
    const { nodes } = editor.serializer.serializeBlocksByIds([gen.id]);
    gen.generatorConfig!.targetCount = 42;
    expect(nodes[0].generatorConfig?.targetCount).toBe(5);
  });

  it("writes a component being edited back as a single instance", () => {
    const component: SavedComponent = {
      id: "comp-1",
      label: "Component 1",
      members: [
        { position: { x: -0.5, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        { position: { x: 0.5, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      ],
    };
    localStorage.setItem("redblock.components", JSON.stringify([component]));
    const editor = new HeadlessEditor();
    editor.components.registerComponentDefinitions([component]);
    const instance = editor.components.instantiateComponent(component, {
      position: new Vector3(3, 0.5, 0),
      rotation: new Euler(),
      scale: new Vector3(1, 1, 1),
    });

    editor.setSelectionByIds([instance.id]);
    expect(editor.components.startEditingComponent(component.id)).toBe(true);
    // While editing, the members are loose blocks in the scene
    expect(editor.ids().length).toBe(2);

    const { nodes } = editor.serializer.serializeScene();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: "component", componentId: "comp-1", id: instance.id });
    expect(nodes[0].transform.position).toMatchObject({ x: 3, y: 0.5, z: 0 });
  });
});

describe("EditorSerializer paste (fresh ids)", () => {
  it("gives pasted blocks new ids and re-links events inside the pasted set", () => {
    const editor = new HeadlessEditor();
    const genA = editor.addGenerator(0, 0);
    const genB = editor.addGenerator(2, 0);
    const outside = editor.addGenerator(4, 0);
    genA.generatorConfig = {
      ...genA.generatorConfig!,
      events: { onComplete: [linkEvent(genB.id), { ...linkEvent(outside.id), id: "ev-2" }] },
    };
    genA.mesh.userData.generatorConfig = genA.generatorConfig;

    const { nodes, componentIds } = editor.serializer.serializeBlocksByIds([genA.id, genB.id]);
    const pasted = editor.instantiateSerializedNodes(nodes, componentIds, { offset: new Vector3(1, 0, 1) });

    expect(pasted).toHaveLength(2);
    const [copyA, copyB] = pasted;
    expect([copyA.id, copyB.id]).not.toContain(genA.id);
    expect([copyA.id, copyB.id]).not.toContain(genB.id);
    const events = copyA.generatorConfig!.events!.onComplete as StartGeneratorEvent[];
    expect(events[0].targetGeneratorId).toBe(copyB.id); // remapped to the copy
    expect(events[1].targetGeneratorId).toBe(outside.id); // outside the paste: unchanged
    expect(firstLink(genA.generatorConfig)).toBe(genB.id); // original untouched
    expect(copyA.mesh.position.x).toBeCloseTo(genA.mesh.position.x + 1);
  });

  it("never pastes a second spawn point", () => {
    const editor = new HeadlessEditor();
    const spawn = editor.addSpawn();
    const block = editor.addBlock(2, 0);
    const { nodes, componentIds } = editor.serializer.serializeBlocksByIds([spawn.id, block.id]);
    const pasted = editor.instantiateSerializedNodes(nodes, componentIds);
    expect(pasted).toHaveLength(1);
    expect(editor.blocks.getAllBlocks().filter((b) => b.mesh.userData.isSpawnPoint)).toHaveLength(1);
  });

  it("ungrouping a pasted group does not collide with the original children", () => {
    const editor = new HeadlessEditor();
    const a = editor.addBlock(0, 0);
    const b = editor.addBlock(2, 0);
    const group = editor.groupByIds([a.id, b.id])!;
    const { nodes, componentIds } = editor.serializer.serializeBlocksByIds([group.id]);
    const [copy] = editor.instantiateSerializedNodes(nodes, componentIds);

    // Ungroup the original first so its children are registered under their old ids
    editor.setSelectionByIds([group.id]);
    editor.ungroupSelected();
    editor.setSelectionByIds([copy.id]);
    const restored = editor.ungroupSelected()!;

    const ids = editor.ids();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
    expect(restored.map((block) => block.id)).not.toContain(a.id);
    // Every child mesh in the scene is still a registered (selectable, serializable) block
    expect(editor.scene.children.filter((child) => child.type === "Mesh")).toHaveLength(4);
  });
});

describe("BlockStore", () => {
  it("never overwrites a block when an id is reused", () => {
    const editor = new HeadlessEditor();
    const first = editor.addBlock();
    const second = editor.blocks.createBlock({ position: new Vector3(), id: first.id });
    expect(second.id).not.toBe(first.id);
    expect(editor.getBlock(first.id)).toBe(first);
  });

  it("restores name and generator config when a mesh is re-registered", () => {
    const editor = new HeadlessEditor();
    const gen = editor.addGenerator(0, 0, { targetCount: 9 });
    editor.blocks.renameBlock(gen.id, "Wave 1");
    const taken = editor.blocks.takeBlock(gen.id)!;
    const again = editor.blocks.registerExistingObject(taken.mesh, { id: gen.id });
    expect(again.name).toBe("Wave 1");
    expect(again.generatorConfig?.targetCount).toBe(9);
  });

  it("does not give groups a child's outline", () => {
    const editor = new HeadlessEditor();
    const a = editor.addBlock(0, 0);
    const b = editor.addBlock(2, 0);
    const group = editor.groupByIds([a.id, b.id])!;
    expect(group.mesh).toBeInstanceOf(Group);
    expect(group.outline).toBeUndefined();
  });
});
