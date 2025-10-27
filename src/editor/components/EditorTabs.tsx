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
        <div className="fixed left-0 right-0 top-12 z-40 mx-auto flex h-10 max-w-md items-center justify-center gap-1 rounded border border-[#1a1a1a] bg-[#323232] px-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => onTabChange("scenario")}
            className={`rounded px-4 py-1.5 text-[11px] transition ${
              activeTab === "scenario" ? "bg-[#4772b3] text-white" : "text-[#cccccc] hover:bg-[#404040]"
            }`}
          >
            Scenario
          </button>
          <button
            type="button"
            onClick={() => onTabChange("game")}
            className={`rounded px-4 py-1.5 text-[11px] transition ${
              activeTab === "game" ? "bg-[#4772b3] text-white" : "text-[#cccccc] hover:bg-[#404040]"
            }`}
          >
            Game
          </button>
        </div>
      </Portal>

      {/* Tab Content - with top padding to account for fixed tab bar */}
      <div className="relative flex-1 pt-12">
        {children}
      </div>
    </>
  );
}
