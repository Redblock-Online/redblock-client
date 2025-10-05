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
    <header className="relative z-50 flex h-14 items-center justify-between border-b border-rb-border bg-white px-6 outline outline-3 outline-rb-border pointer-events-auto">
      <div className="flex items-center gap-6">
        <div className="text-xs uppercase tracking-widest text-rb-muted">World Builder</div>
        <nav className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-rb-muted">
          {menuGroups.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                ref={(node) => {
                  menuAnchors.current[menu.id] = node;
                }}
                type="button"
                className={`rounded px-3 py-1 transition ${
                  openMenuId === menu.id ? "bg-black text-white" : "text-rb-muted hover:text-rb-text"
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
        <div className="text-xs text-rb-muted">
          Scenario: <span className="font-semibold text-rb-text">{activeScenarioName}</span>
          {hasUnsavedChanges ? <span className="ml-1 text-rb-text">*</span> : null}
        </div>
        <div className="text-sm font-semibold text-rb-text">{title}</div>
      </div>
    </header>
  );
}
