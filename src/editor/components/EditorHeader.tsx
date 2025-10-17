import Image from "next/image";
import type { ReactElement } from "react";

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
}: EditorHeaderProps): ReactElement {
  return (
    <header className="relative z-50 flex h-16 items-center justify-between border-b border-white/60 bg-white/80 px-8 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl pointer-events-auto">
      <div className="flex items-center gap-6">
        <Image
          src="/logo.png"
          alt="Redblock logo"
          width={498}
          height={410}
          className="h-8 w-auto"
        />
        <nav className="flex items-center gap-1 text-[11px] font-display uppercase tracking-[0.3em] text-black/40">
          {menuGroups.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                ref={(node) => {
                  menuAnchors.current[menu.id] = node;
                }}
                type="button"
                className={`rounded-lg px-4 py-2 transition ${
                  openMenuId === menu.id
                    ? "bg-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.2)]"
                    : "text-black/50 hover:text-black hover:bg-black/5"
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
      <div className="flex flex-col items-end text-right">
        <div className="text-[11px] uppercase tracking-[0.24em] text-black/40">
          Scenario:{" "}
          <span className="font-display text-sm uppercase tracking-[0.3em] text-black/80">
            {activeScenarioName}
          </span>
          {hasUnsavedChanges ? <span className="ml-1 text-black">*</span> : null}
        </div>
        <div className="font-display text-base uppercase tracking-[0.22em] text-black">
          {title}
        </div>
      </div>
    </header>
  );
}
