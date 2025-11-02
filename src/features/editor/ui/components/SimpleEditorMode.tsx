import { type ReactElement, useEffect } from "react";
import { EditorApp } from "@/features/editor/core";
import type { EditorBlock } from "@/features/editor/types";
import type { HistoryAction } from "../hooks/useHistoryStack";

interface SimpleEditorModeProps {
  showControls: boolean;
  activeItem: { label: string } | null;
  editingActive: boolean;
  editor: EditorApp;
  pushHistory: (action: HistoryAction) => void;
  autoSaveScenario: () => void;
}

/**
 * Simple Editor Mode Component
 * 
 * A simplified editor interface that focuses on basic block placement.
 * This mode hides the sidebar and inspector panels, showing only essential controls.
 * Supports clicking on the canvas to place blocks directly.
 * 
 * @example
 * ```tsx
 * <SimpleEditorMode
 *   showControls={true}
 *   activeItem={selectedItem}
 *   editingActive={false}
 *   editor={editorApp}
 *   pushHistory={pushHistory}
 *   autoSaveScenario={autoSaveScenario}
 * />
 * ```
 */
export function SimpleEditorMode({
  showControls,
  activeItem,
  editingActive,
  editor,
  pushHistory,
  autoSaveScenario,
}: SimpleEditorModeProps): ReactElement {
  // Handle click to place blocks - Minecraft-style: always place on left click
  useEffect(() => {
    const canvas = editor.getCanvas();
    let isPlacing = false;

    const handlePointerDown = (event: PointerEvent) => {
      // Only handle left clicks
      if (event.button !== 0) return;
      
      // Only handle clicks that are on the canvas
      const target = event.target as Node;
      if (target !== canvas && !canvas.contains(target)) {
        return;
      }

      // Don't place blocks if editing a component
      if (editingActive) return;

      // Prevent default to stop other handlers
      event.preventDefault();
      event.stopImmediatePropagation();

      // Prevent dragging by setting flag
      isPlacing = true;

      // In Minecraft-style simple mode, always place a block where you click
      // This happens immediately on pointerdown
      const placed: EditorBlock | null = editor.placeBlockAt(event.clientX, event.clientY);
      
      if (placed) {
        // Get the transform for history
        const transform = editor.getSelectionTransform();
        if (transform) {
          pushHistory({ 
            type: "add", 
            id: placed.id, 
            transform 
          });
        }
        // Auto-save the scenario
        autoSaveScenario();
      }

      // Reset flag after a short delay
      setTimeout(() => {
        isPlacing = false;
      }, 100);
    };

    const handlePointerMove = (event: PointerEvent) => {
      // Prevent dragging while placing
      if (isPlacing) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (isPlacing && event.button === 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        isPlacing = false;
      }
    };

    // Use capture phase at document level with highest priority
    // This ensures we catch events before EditorPointerController
    const options = { capture: true, passive: false };
    document.addEventListener("pointerdown", handlePointerDown, options);
    document.addEventListener("pointermove", handlePointerMove, options);
    document.addEventListener("pointerup", handlePointerUp, options);
    
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, options);
      document.removeEventListener("pointermove", handlePointerMove, options);
      document.removeEventListener("pointerup", handlePointerUp, options);
    };
  }, [editor, editingActive, pushHistory, autoSaveScenario]);

  return (
    <>
      {/* Editor Content */}
      <div className="relative flex flex-1 gap-2 overflow-hidden px-2 pb-2 pt-2">
        <main className="pointer-events-none relative flex-1">
          <div className="pointer-events-none absolute inset-0">
            {showControls && (
              <div className="absolute left-4 top-4 flex max-w-md flex-col gap-1.5 rounded border border-[#1a1a1a] bg-[#323232]/95 text-[#cccccc] px-4 py-2.5">
                <span className="text-[11px] leading-relaxed">
                  Click to place block
                </span>
              </div>
            )}
            {activeItem ? (
              <div className="absolute bottom-4 left-1/2 w-max -translate-x-1/2 rounded border border-[#1a1a1a] bg-[#323232]/95 px-4 py-2 text-[11px] text-[#cccccc]">
                Drag the {activeItem.label.toLowerCase()} from the components panel onto the canvas to place it
              </div>
            ) : null}
            {editingActive ? (
              <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded border border-[#1a1a1a] bg-[#4772b3] px-4 py-2 text-[11px] text-white">
                Press Enter to finish editing the component
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </>
  );
}

