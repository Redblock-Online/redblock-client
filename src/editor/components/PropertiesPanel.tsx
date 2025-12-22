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
  const actionButtonClass = `
    h-8 rounded-md border border-[#4772b3]/30 
    bg-gradient-to-r from-[#4772b3] to-[#5a8fd6] 
    text-[11px] font-medium text-white 
    transition-all duration-200 
    hover:from-[#5a8fd6] hover:to-[#6ba0e7] hover:shadow-md hover:shadow-[#4772b3]/25
    active:scale-[0.98]
    flex items-center justify-center gap-1.5
  `;
  const subtleButtonClass = `
    h-8 rounded-md border border-[#3a3a3a] 
    bg-[#2d2d2d] 
    text-[11px] font-medium text-[#cccccc] 
    transition-all duration-200 
    hover:bg-[#404040] hover:border-[#4a4a4a] hover:text-white
    active:scale-[0.98]
    flex items-center justify-center gap-1.5
  `;

  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-[#3a3a3a] bg-gradient-to-b from-[#2d2d2d] to-[#282828] p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#3a3a3a] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#666666]">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <div className="space-y-1">
          <span className="block text-[13px] font-semibold text-[#aaaaaa]">Inspector</span>
          <p className="max-w-[200px] text-[11px] leading-relaxed text-[#666666]">
            Select an existing block or place a new one to adjust its properties.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#555555]">
          <kbd className="px-1.5 py-0.5 rounded bg-[#3a3a3a] text-[#888888]">Click</kbd>
          <span>to select</span>
        </div>
      </div>
    );
  }

  // Multi selection UI
  if (Array.isArray(selection)) {
    return (
      <div className="flex h-full flex-col gap-4 text-[11px] text-[#cccccc]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4772b3]/20 to-[#4772b3]/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4772b3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div>
            <div className="text-[10px] text-[#888888] uppercase tracking-wider">Selection</div>
            <div className="text-[14px] font-semibold text-white">
              {selection.length} Objects
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-[#4a4a4a] to-transparent" />
        <div className="flex flex-col gap-2">
          <button className={actionButtonClass} onClick={onGroupSelection}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Group Selection
          </button>
          {onDeleteSelection && (
            <button className={subtleButtonClass} onClick={onDeleteSelection}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete All
            </button>
          )}
          {onModifyComponent && componentEditing && (
            <button className={actionButtonClass} onClick={onModifyComponent}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Finish Editing
            </button>
          )}
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
    <div className="flex h-full flex-col gap-4 text-[11px] text-[#cccccc]">
      <div className="flex items-center gap-3">
        {/* Icon badge */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isComponent 
            ? "bg-gradient-to-br from-[#ff4dff]/20 to-[#ff4dff]/10" 
            : isGroup 
              ? "bg-gradient-to-br from-[#ffa500]/20 to-[#ffa500]/10"
              : isGenerator
                ? "bg-gradient-to-br from-[#00ff88]/20 to-[#00ff88]/10"
                : "bg-gradient-to-br from-[#4772b3]/20 to-[#4772b3]/10"
        }`}>
          {isComponent ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          ) : isGroup ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          ) : isGenerator ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4772b3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-[#888888] uppercase tracking-wider mb-0.5">
            {isComponent ? "Component" : isGroup ? "Group" : isGenerator ? "Generator" : "Block"}
          </div>
          
          {/* Editable name */}
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onFocus={() => setTyping?.(true)}
              onBlur={() => {
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
              className="w-full rounded-md border border-[#4772b3] bg-[#2a2a2a] px-2 py-1 text-[12px] font-medium text-white outline-none focus:ring-2 focus:ring-[#4772b3]/30"
            />
          ) : (
            <div 
              className="group flex items-center gap-1.5 cursor-pointer" 
              onClick={() => {
                if (onRenameSelection) {
                  setEditedName(displayName);
                  setIsEditingName(true);
                }
              }}
            >
              <span className="text-[13px] font-semibold text-white truncate">{displayName}</span>
              {onRenameSelection && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[#666666]">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Actions */}
      {selection.mesh instanceof Group ? (
        <div className="flex flex-col gap-2">
          {selection.mesh.userData?.componentId ? (
            <>
              {onModifyComponent && (
                <button className={componentEditing ? actionButtonClass : subtleButtonClass} onClick={onModifyComponent}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {componentEditing ? (
                      <polyline points="20 6 9 17 4 12"/>
                    ) : (
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                    )}
                  </svg>
                  {componentEditing ? "Finish Editing" : "Edit Component"}
                </button>
              )}
              {onDeleteSelection && (
                <button className={subtleButtonClass} onClick={onDeleteSelection}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              )}
            </>
          ) : (
            <>
              <button className={subtleButtonClass} onClick={onUngroupSelection}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                Ungroup
              </button>
              <button className={actionButtonClass} onClick={onCreateComponent}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
                Create Component
              </button>
              {onDeleteSelection && (
                <button className={subtleButtonClass} onClick={onDeleteSelection}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {onDeleteSelection && (
            <button className={subtleButtonClass} onClick={onDeleteSelection}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          )}
        </div>
      )}

      {/* Transform Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4772b3]">
            <polyline points="5 9 2 12 5 15"/>
            <polyline points="9 5 12 2 15 5"/>
            <polyline points="15 19 12 22 9 19"/>
            <polyline points="19 9 22 12 19 15"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
          <h3 className="text-[11px] font-semibold text-[#aaaaaa] uppercase tracking-wider">Position</h3>
          <span className="text-[9px] text-[#555555] ml-auto">G to move</span>
        </div>
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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#ffa500]">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <h3 className="text-[11px] font-semibold text-[#aaaaaa] uppercase tracking-wider">Scale</h3>
          <span className="text-[9px] text-[#555555] ml-auto">F to scale</span>
        </div>
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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00ff88]">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          <h3 className="text-[11px] font-semibold text-[#aaaaaa] uppercase tracking-wider">Rotation</h3>
          <span className="text-[9px] text-[#555555] ml-auto">R to rotate</span>
        </div>
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
