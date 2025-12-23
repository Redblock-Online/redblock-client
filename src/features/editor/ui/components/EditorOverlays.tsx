import type { ReactElement } from "react";
import type { EditorItem } from "@/features/editor/types";

interface EditorOverlaysProps {
  activeItem: EditorItem | null;
  editingActive: boolean;
  transformLabel: string | null;
}

export function EditorOverlays({ activeItem, editingActive, transformLabel }: EditorOverlaysProps): ReactElement {
  return (
    <main className="pointer-events-none relative flex-1">
      <div className="pointer-events-none absolute inset-0">
        {/* Controls Help Panel */}
        <div className="absolute left-4 top-4 flex max-w-sm flex-col gap-3 rounded-xl border border-[#2a2a2a] bg-gradient-to-br from-[#323232]/98 to-[#2a2a2a]/98 px-4 py-3.5 text-[11px] text-[#cccccc] shadow-2xl shadow-black/30 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4772b3]">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-[11px] font-semibold text-[#e0e0e0]">Controls</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[9px] text-[#666666]">C to hide</kbd>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#888888]">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v8M8 12h8"/>
                </svg>
              </div>
              <div className="text-[10px] leading-relaxed text-[#aaaaaa]">
                <span className="text-[#e0e0e0]">Orbit</span> with right click · <span className="text-[#e0e0e0]">Pan</span> with Shift + right click · <span className="text-[#e0e0e0]">Zoom</span> with scroll
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#888888]">
                  <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/>
                </svg>
              </div>
              <div className="text-[10px] leading-relaxed text-[#aaaaaa]">
                <span className="text-[#e0e0e0]">Select</span> with left click · 
                <kbd className="mx-1 px-1 py-0.5 rounded bg-[#3a3a3a] text-[#4772b3] text-[9px]">G</kbd>Move · 
                <kbd className="mx-1 px-1 py-0.5 rounded bg-[#3a3a3a] text-[#00ff88] text-[9px]">R</kbd>Rotate · 
                <kbd className="mx-1 px-1 py-0.5 rounded bg-[#3a3a3a] text-[#ffa500] text-[9px]">F</kbd>Scale
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#888888]">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M6 8h.01M10 8h.01M14 8h.01"/>
                </svg>
              </div>
              <div className="text-[10px] leading-relaxed text-[#aaaaaa]">
                Constrain with <kbd className="mx-0.5 px-1 py-0.5 rounded bg-[#3a3a3a] text-[#ef4444] text-[9px]">X</kbd>
                <kbd className="mx-0.5 px-1 py-0.5 rounded bg-[#3a3a3a] text-[#22c55e] text-[9px]">Y</kbd>
                <kbd className="mx-0.5 px-1 py-0.5 rounded bg-[#3a3a3a] text-[#3b82f6] text-[9px]">Z</kbd> · 
                Camera with <kbd className="ml-1 px-1 py-0.5 rounded bg-[#3a3a3a] text-[#888888] text-[9px]">WASD</kbd>
              </div>
            </div>
          </div>
          
          {transformLabel && (
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#4772b3] to-[#5a8fd6] px-3 py-1.5 text-[10px] font-semibold text-white shadow-lg shadow-[#4772b3]/25">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="5 9 2 12 5 15"/>
                  <polyline points="9 5 12 2 15 5"/>
                  <polyline points="15 19 12 22 9 19"/>
                  <polyline points="19 9 22 12 19 15"/>
                </svg>
                {transformLabel}
              </span>
            </div>
          )}
        </div>
        
        {/* Active Item Hint */}
        {activeItem && (
          <div className="absolute bottom-6 left-1/2 w-max -translate-x-1/2 flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-gradient-to-r from-[#323232]/98 to-[#2a2a2a]/98 px-5 py-3 shadow-2xl shadow-black/30 backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg bg-[#4772b3]/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4772b3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <div className="text-[11px] text-[#cccccc]">
              <span className="text-[#888888]">Drag</span> the <span className="font-semibold text-white">{activeItem.label}</span> <span className="text-[#888888]">onto the canvas to place it</span>
            </div>
          </div>
        )}
        
        {/* Editing Mode Indicator */}
        {editingActive && (
          <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-[#4772b3]/30 bg-gradient-to-r from-[#4772b3] to-[#5a8fd6] px-5 py-3 shadow-2xl shadow-[#4772b3]/30">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </div>
            <div className="text-[11px] text-white">
              Press <kbd className="mx-1 px-1.5 py-0.5 rounded bg-white/20 text-white text-[10px] font-semibold">Enter</kbd> to finish editing the component
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
