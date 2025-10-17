import type { ReactElement, ReactNode } from "react";
import { Portal } from "./Portal";

export type TabId = "scenario" | "game";

interface EditorTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: ReactNode;
}

export function EditorTabs({ activeTab, onTabChange, children }: EditorTabsProps): ReactElement {
  return (
    <>
      {/* Tab Bar in Portal - Always on top */}
      <Portal>
        <div className="fixed left-0 right-0 top-16 z-40 mx-auto flex h-12 max-w-5xl items-center justify-center gap-2 rounded-xl border border-white/60 bg-white px-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] pointer-events-auto">
          <button
            type="button"
            onClick={() => onTabChange("scenario")}
            className={`rounded-lg px-4 py-2 text-[11px] font-display uppercase tracking-[0.3em] transition ${
              activeTab === "scenario" ? "bg-black text-white shadow-[0_10px_20px_rgba(15,23,42,0.25)]" : "text-black/50 hover:text-black hover:bg-black/5"
            }`}
          >
            Scenario
          </button>
          <button
            type="button"
            onClick={() => onTabChange("game")}
            className={`rounded-lg px-4 py-2 text-[11px] font-display uppercase tracking-[0.3em] transition ${
              activeTab === "game" ? "bg-black text-white shadow-[0_10px_20px_rgba(15,23,42,0.25)]" : "text-black/50 hover:text-black hover:bg-black/5"
            }`}
          >
            Game
          </button>
        </div>
      </Portal>

      {/* Tab Content - with top padding to account for fixed tab bar */}
      <div className="relative flex-1 pt-14">
        {children}
      </div>
    </>
  );
}
