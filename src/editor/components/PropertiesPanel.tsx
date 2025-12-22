import type { Dispatch, SetStateAction, ReactElement } from "react";
import { useState } from "react";
import type { EditorSelection } from "../types";
import { Group } from "three";
import { AxisInput } from "./AxisInput";
import { GeneratorConfigPanel } from "./GeneratorConfigPanel";
import type { GeneratorConfig } from "../types/generatorConfig";

type VectorState = { x: number; y: number; z: number };

type PropertiesPanelProps = {
  selection: EditorSelection;
  positionState: VectorState;
  scaleState: VectorState;
  rotationState: VectorState;
  onPositionChange: Dispatch<SetStateAction<VectorState>>;
  onScaleChange: Dispatch<SetStateAction<VectorState>>;
  onRotationChange: Dispatch<SetStateAction<VectorState>>;
  onGroupSelection: () => void;
  onUngroupSelection?: () => void;
  onCreateComponent?: () => void;
  onModifyComponent?: () => void;
  componentEditing?: boolean;
  onDeleteSelection?: () => void;
  onRenameSelection?: (id: string, newName: string) => void;
  onGeneratorConfigChange?: (blockId: string, config: GeneratorConfig) => void;
  onRequestGeneratorSelection?: (eventId: string) => void;
  setTyping?: (typing: boolean) => void;
};

export function PropertiesPanel({
  selection,
  positionState,
  scaleState,
  rotationState,
  onPositionChange,
  onScaleChange,
  onRotationChange,
  onGroupSelection,
  onUngroupSelection,
  onCreateComponent,
  onModifyComponent,
  componentEditing,
  onDeleteSelection,
  onRenameSelection,
  onGeneratorConfigChange,
  onRequestGeneratorSelection,
  setTyping,
}: PropertiesPanelProps): ReactElement {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  
  // Display name is the custom name if set, otherwise the ID
  const displayName = selection && !Array.isArray(selection) ? (selection.name || selection.id) : "";
  const actionButtonClass =
    "h-9 rounded-md bg-editor-accent text-editor-sm font-medium text-white transition-all duration-150 hover:bg-editor-accentHover";
  const subtleButtonClass =
    "h-9 rounded-md border border-editor-border bg-editor-bg text-editor-sm font-medium text-editor-text transition-all duration-150 hover:bg-editor-surface";

  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-editor-border bg-editor-bg p-5 text-center text-editor-sm text-editor-muted">
        <span className="text-editor-base font-medium text-editor-text">Inspector</span>
        <p className="max-w-[240px] text-editor-sm leading-relaxed">
          Select an existing block or place a new one to adjust its properties.
        </p>
      </div>
    );
  }

  // Multi selection UI
  if (Array.isArray(selection)) {
    return (
      <div className="flex h-full flex-col gap-4 text-editor-sm text-editor-text">
        <div>
          <div className="text-editor-xs text-editor-muted font-medium">Selection</div>
          <div className="mt-1 text-editor-base font-semibold text-editor-text">
            Multiple Objects
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            className={actionButtonClass}
            onClick={onGroupSelection}
          >
            Group
          </button>
          {onDeleteSelection ? (
            <button
              className={subtleButtonClass}
              onClick={onDeleteSelection}
            >
              Delete
            </button>
          ) : null}
          {onModifyComponent && componentEditing ? (
            <button
              className={actionButtonClass}
              onClick={onModifyComponent}
            >
              Finish Editing
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // Single selection UI
  // Determine if selection is a component, group, or generator
  const isComponent = selection.mesh instanceof Group && selection.mesh.userData?.componentId;
  const isGroup = selection.mesh instanceof Group && !selection.mesh.userData?.componentId;
  const isGenerator = selection.mesh.userData?.isGenerator === true;
  const generatorConfig = selection.generatorConfig;

  return (
    <div className="flex h-full flex-col gap-4 text-editor-sm text-editor-text">
      <div>
        <div className="text-editor-xs text-editor-muted font-medium">Selection</div>
        <div className="mt-1 flex items-center gap-2 text-editor-base font-semibold text-editor-text">
          {/* Icon for component or group */}
          {isComponent && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          )}
          {isGroup && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-editor-muted flex-shrink-0">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          )}
          
          {/* Editable name */}
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onFocus={() => {
                // Disable keyboard shortcuts when typing
                setTyping?.(true);
              }}
              onBlur={() => {
                // Re-enable keyboard shortcuts
                setTyping?.(false);
                
                if (editedName.trim() && editedName !== displayName && onRenameSelection) {
                  onRenameSelection(selection.id, editedName.trim());
                }
                setIsEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setTyping?.(false);
                  setIsEditingName(false);
                }
              }}
              autoFocus
              className="flex-1 rounded-md border border-editor-accent bg-editor-bg px-2.5 py-1.5 text-editor-sm text-white outline-none"
            />
          ) : (
            <div className="group flex flex-1 items-center gap-1.5 cursor-pointer hover:text-white transition-all duration-150" onClick={() => {
              if (onRenameSelection) {
                setEditedName(displayName);
                setIsEditingName(true);
              }
            }}>
              <span className="flex-1 truncate">{displayName}</span>
              {onRenameSelection && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150 text-editor-muted">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              )}
            </div>
          )}
        </div>
      </div>
      {selection.mesh instanceof Group ? (
        <div className="flex flex-col gap-2.5">
          {/* Check if this is a component instance */}
          {selection.mesh.userData?.componentId ? (
            // Component instance - show only component-specific actions
            <>
              {onModifyComponent ? (
                <button
                  className={componentEditing ? actionButtonClass : subtleButtonClass}
                  onClick={onModifyComponent}
                >
                  {componentEditing ? "Finish Editing" : "Edit Component"}
                </button>
              ) : null}
              {onDeleteSelection ? (
                <button
                  className={subtleButtonClass}
                  onClick={onDeleteSelection}
                >
                  Delete
                </button>
              ) : null}
            </>
          ) : (
            // Regular group - show group actions
            <>
              <button
                className={subtleButtonClass}
                onClick={onUngroupSelection}
              >
                Ungroup
              </button>
              <button
                className={actionButtonClass}
                onClick={onCreateComponent}
              >
                Create Component
              </button>
              {onDeleteSelection ? (
                <button
                  className={subtleButtonClass}
                  onClick={onDeleteSelection}
                >
                  Delete
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {onDeleteSelection ? (
            <button
              className={subtleButtonClass}
              onClick={onDeleteSelection}
            >
              Delete
            </button>
          ) : null}
        </div>
      )}

      <section>
        <h3 className="text-editor-xs text-editor-muted font-medium mb-2">Position</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <AxisInput
              key={axis}
              label={axis}
              value={positionState[axis]}
              step={0.1}
              precision={2}
              onChange={(next) => onPositionChange((prev) => ({ ...prev, [axis]: next }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-editor-xs text-editor-muted font-medium mb-2">Scale</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <AxisInput
              key={axis}
              label={axis}
              value={scaleState[axis]}
              step={0.1}
              min={0.1}
              precision={2}
              onChange={(next) => onScaleChange((prev) => ({ ...prev, [axis]: next }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-editor-xs text-editor-muted font-medium mb-2">Rotation (°)</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis) => (
            <AxisInput
              key={axis}
              label={axis}
              value={rotationState[axis]}
              step={1}
              precision={1}
              onChange={(next) => onRotationChange((prev) => ({ ...prev, [axis]: next }))}
            />
          ))}
        </div>
      </section>

      {/* Generator Configuration Panel */}
      {isGenerator && generatorConfig && onGeneratorConfigChange && (
        <GeneratorConfigPanel
          key={`${selection.id}-${generatorConfig.targetCount}-${generatorConfig.targetScale}-${generatorConfig.enabled}-${generatorConfig.visible}`}
          config={generatorConfig}
          onChange={(newConfig) => onGeneratorConfigChange(selection.id, newConfig)}
          onRequestGeneratorSelection={onRequestGeneratorSelection}
          setTyping={setTyping}
        />
      )}
    </div>
  );
}
