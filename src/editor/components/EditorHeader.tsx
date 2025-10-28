import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";
import { AlertIcon } from "./AlertIcon";
import type { Alert } from "../core/AlertManager";

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
  onMenuClick: (menuId: string) => void;
  closeMenus: () => void;
  alerts: Alert[];
}

export function EditorHeader({
  menuGroups,
  openMenuId,
  activeScenarioName,
  hasUnsavedChanges,
  title,
  menuAnchors,
  onMenuClick,
  closeMenus,
  alerts,
}: EditorHeaderProps): ReactElement {
  return (
    <header className="relative z-50 flex h-12 items-center justify-between border-b border-[#1a1a1a] bg-[#323232] px-4 pointer-events-auto">
      <div className="flex items-center gap-6">
        <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
          <Image
            src="/logo.png"
            alt="Redblock logo"
            width={498}
            height={410}
            className="h-8 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-0.5 text-[11px] text-[#cccccc]">
          {menuGroups.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                ref={(node) => {
                  menuAnchors.current[menu.id] = node;
                }}
                type="button"
                className={`rounded px-3 py-1.5 text-[11px] transition ${
                  openMenuId === menu.id
                    ? "bg-[#4772b3] text-white"
                    : "text-[#cccccc] hover:bg-[#404040]"
                }`}
                onClick={() => {
                  if (openMenuId === menu.id) {
                    closeMenus();
                  } else {
                    onMenuClick(menu.id);
                  }
                }}
              >
                {menu.label}
              </button>
            </div>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <AlertIcon alerts={alerts} />
        <div className="flex flex-col items-end text-right">
          <div className="text-[11px] text-[#999999]">
            Scenario:{" "}
            <span className="text-[11px] text-[#cccccc]">
              {activeScenarioName}
            </span>
            {hasUnsavedChanges ? <span className="ml-1 text-[#cccccc]">*</span> : null}
          </div>
          <div className="text-[12px] font-medium text-[#cccccc]">
            {title}
          </div>
        </div>
      </div>
    </header>
  );
}
