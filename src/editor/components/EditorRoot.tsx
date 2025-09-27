import { useEffect, useMemo, useRef, useState } from "react";
import { Euler, Vector3 } from "three";
import EditorApp, { type EditorBlock } from "../EditorApp";
import type { EditorItem } from "../types";
import { ItemMenu } from "./ItemMenu";
import { PropertiesPanel } from "./PropertiesPanel";

const items: EditorItem[] = [
  { id: "block", label: "Bloque" },
];

export function EditorRoot({ editor }: { editor: EditorApp }): JSX.Element {
  const [activeItem, setActiveItem] = useState<EditorItem | null>(null);
  const [selection, setSelection] = useState<EditorBlock | null>(null);
  const [scaleState, setScaleState] = useState({ x: 1, y: 1, z: 1 });
  const [rotationState, setRotationState] = useState({ x: 0, y: 0, z: 0 });
  const selectedItemRef = useRef<EditorItem | null>(null);

  useEffect(() => {
    selectedItemRef.current = activeItem;
  }, [activeItem]);

  useEffect(() => {
    return editor.addSelectionListener((block) => {
      setSelection(block);
      const transform = editor.getSelectionTransform();
      if (!transform) {
        setScaleState({ x: 1, y: 1, z: 1 });
        setRotationState({ x: 0, y: 0, z: 0 });
        return;
      }
      const { scale, rotation } = transform;
      setScaleState({ x: scale.x, y: scale.y, z: scale.z });
      setRotationState({
        x: (rotation.x * 180) / Math.PI,
        y: (rotation.y * 180) / Math.PI,
        z: (rotation.z * 180) / Math.PI,
      });
    });
  }, [editor]);

  useEffect(() => {
    const canvas = editor.getCanvas();
    const handlePointerDown = (event: PointerEvent) => {
      if (selectedItemRef.current) {
        editor.placeBlockAt(event.clientX, event.clientY);
        return;
      }
      editor.pickBlock(event.clientX, event.clientY);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!selectedItemRef.current) {
        const hasBlock = event.dataTransfer?.types.includes("text/plain");
        if (!hasBlock) {
          return;
        }
      }
      event.preventDefault();
      event.dataTransfer!.dropEffect = "copy";
    };

    const handleDrop = (event: DragEvent) => {
      const data = event.dataTransfer?.getData("text/plain");
      if (data !== "block") {
        return;
      }
      event.preventDefault();
      editor.placeBlockAt(event.clientX, event.clientY);
      setActiveItem(items[0]);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("drop", handleDrop);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("drop", handleDrop);
    };
  }, [editor]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveItem(null);
        editor.clearSelection();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editor]);

  useEffect(() => {
    if (!selection) {
      return;
    }
    editor.updateSelectedBlockScale(new Vector3(scaleState.x, scaleState.y, scaleState.z));
  }, [editor, scaleState, selection]);

  useEffect(() => {
    if (!selection) {
      return;
    }
    editor.updateSelectedBlockRotation(
      new Euler(
        (rotationState.x * Math.PI) / 180,
        (rotationState.y * Math.PI) / 180,
        (rotationState.z * Math.PI) / 180,
      ),
    );
  }, [editor, rotationState, selection]);

  const inspectorVisible = selection !== null;

  const title = useMemo(() => {
    if (selection) {
      return selection.id;
    }
    if (activeItem) {
      return `${activeItem.label} listo para colocar`;
    }
    return "Selecciona o coloca bloques";
  }, [selection, activeItem]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col text-white">
      <header className="pointer-events-auto flex h-14 items-center justify-between border-b border-white/10 bg-[#1e1e1e]/90 px-6">
        <div className="text-xs uppercase tracking-widest text-white/70">World Builder</div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-white/50">Ruta actual: /editor</div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="pointer-events-auto flex w-64 flex-col border-r border-white/10 bg-[#202020]/95 p-4">
          <div className="mb-4 text-xs uppercase text-white/50">Biblioteca</div>
          <ItemMenu
            items={items}
            activeItem={activeItem}
            onItemSelect={setActiveItem}
            onItemDragStart={(itemId) => {
              const item = items.find((entry) => entry.id === itemId) ?? null;
              setActiveItem(item);
            }}
          />
        </aside>
        <main className="relative flex-1">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-6 top-6 rounded bg-black/40 px-3 py-2 text-xs text-white/70">
              Orbita con clic derecho · Panea con shift + clic derecho · Zoom con rueda
            </div>
            {activeItem ? (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded bg-[#2b2b2b]/90 px-4 py-2 text-xs text-white/80">
                Coloca {activeItem.label.toLowerCase()} con clic en el lienzo o arrástralo desde el menú
              </div>
            ) : null}
          </div>
        </main>
        <aside
          className={`pointer-events-auto w-72 border-l border-white/10 bg-[#1c1c1c]/95 p-4 transition-opacity ${
            inspectorVisible ? "opacity-100" : "pointer-events-none opacity-40"
          }`}
        >
          <PropertiesPanel
            selection={selection}
            scaleState={scaleState}
            rotationState={rotationState}
            onScaleChange={setScaleState}
            onRotationChange={setRotationState}
          />
        </aside>
      </div>
    </div>
  );
}
