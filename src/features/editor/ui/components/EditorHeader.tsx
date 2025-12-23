import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";
import { AlertIcon } from "./AlertIcon";
import type { Alert } from "@/features/editor/core";

interface MenuGroup {
  id: string;
  label: string;
  items: Array<{ id: string; label: string; action: () => void; disabled?: boolean }>;
}

interface EditorHeaderProps {
  menuGroups: MenuGroup[];
  openMenuId: string | null;
  activeScenarioName: string;
  hasUnsavedChanges: boolean;
  title: string;
  menuAnchors: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onMenuHover: (menuId: string) => void;
  onMenuLeave: () => void;
  alerts: Alert[];
}

export function EditorHeader({
  menuGroups,
  openMenuId,
  activeScenarioName,
  hasUnsavedChanges,
  title,
  menuAnchors,
  onMenuHover,
  onMenuLeave,
  alerts,
}: EditorHeaderProps): ReactElement {
  return (
    <header className="relative z-50 flex h-14 items-center justify-between border-b border-[#1a1a1a] bg-gradient-to-r from-[#2a2a2a] to-[#323232] px-5 pointer-events-auto shadow-lg">
      <div className="flex items-center gap-8">
        <Link 
          href="/" 
          className="group cursor-pointer transition-all duration-200 hover:scale-105"
          title="Back to Home"
        >
          <Image
            src="/logo.png"
            alt="Redblock logo"
            width={498}
            height={410}
            className="h-9 w-auto drop-shadow-md group-hover:drop-shadow-lg transition-all duration-200"
          />
        </Link>
        <div className="h-6 w-px bg-[#404040]" />
        <nav className="flex items-center gap-1 text-[11px] text-[#cccccc]">
          {menuGroups.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                ref={(node) => {
                  menuAnchors.current[menu.id] = node;
                }}
                type="button"
                className={`
                  relative rounded-md px-3.5 py-2 text-[11px] font-medium
                  transition-all duration-150 ease-out
                  focus:outline-none focus:ring-2 focus:ring-[#4772b3]/50 focus:ring-offset-1 focus:ring-offset-[#323232]
                  ${openMenuId === menu.id
                    ? "bg-[#4772b3] text-white shadow-md shadow-[#4772b3]/25"
                    : "text-[#cccccc] hover:bg-[#404040] hover:text-white"
                  }
                `}
                onMouseEnter={() => onMenuHover(menu.id)}
                onMouseLeave={() => onMenuLeave()}
              >
                {menu.label}
                {openMenuId === menu.id && (
                  <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-white/60" />
                )}
              </button>
            </div>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-5">
        <AlertIcon alerts={alerts} />
        <div className="flex flex-col items-end text-right gap-0.5">
          <div className="flex items-center gap-2 text-[11px] text-[#888888]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>
              <span className="text-[#aaaaaa] font-medium">{activeScenarioName}</span>
              {hasUnsavedChanges && (
                <span className="ml-1.5 inline-flex items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />
                </span>
              )}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-[#e0e0e0] tracking-tight">
            {title}
          </div>
        </div>
      </div>
    </header>
  );
}
