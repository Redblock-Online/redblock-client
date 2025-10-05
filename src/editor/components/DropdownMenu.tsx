import type { ReactElement } from "react";
import { Portal } from "./Portal";
import type { MenuPosition } from "../types/editorTypes";

interface MenuItem {
  id: string;
  label: string;
  action: () => void;
  disabled?: boolean;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

interface DropdownMenuProps {
  menu: MenuGroup | null;
  position: MenuPosition;
  onClose: () => void;
}

export function DropdownMenu({ menu, position, onClose }: DropdownMenuProps): ReactElement | null {
  if (!menu || !position) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[900]" onMouseDown={onClose}>
        <div
          className="absolute min-w-[160px] rounded border border-rb-border bg-white shadow-lg"
          style={{ left: position.left, top: position.top, minWidth: Math.max(position.width, 160) }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {menu.items.map((item) => {
            const disabled = Boolean(item.disabled);
            return (
              <button
                key={item.id}
                type="button"
                className={`block w-full px-4 py-2 text-left text-[11px] uppercase tracking-[0.3em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  disabled ? "text-rb-muted" : "text-rb-muted hover:bg-black hover:text-white"
                }`}
                onClick={() => {
                  if (disabled) return;
                  item.action();
                  onClose();
                }}
                disabled={disabled}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </Portal>
  );
}
