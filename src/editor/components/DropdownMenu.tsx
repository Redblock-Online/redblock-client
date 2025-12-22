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
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function DropdownMenu({ menu, position, onClose, onMouseEnter, onMouseLeave }: DropdownMenuProps): ReactElement | null {
  if (!menu || !position) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[900]" onMouseDown={onClose}>
        <div
          className="absolute min-w-[200px] overflow-hidden rounded-lg border border-[#2a2a2a] bg-gradient-to-b from-[#363636] to-[#323232] shadow-2xl shadow-black/40 backdrop-blur-sm"
          style={{ left: position.left, top: position.top, minWidth: Math.max(position.width, 180) }}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <div className="py-1">
            {menu.items.map((item, index) => {
              const disabled = Boolean(item.disabled);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`
                    group relative block w-full px-4 py-2 text-left text-[11px] font-medium
                    transition-all duration-150
                    disabled:cursor-not-allowed disabled:opacity-40
                    ${disabled
                      ? "text-[#555555]"
                      : "text-[#cccccc] hover:bg-[#4772b3] hover:text-white"
                    }
                    ${index === 0 ? "rounded-t-md" : ""}
                    ${index === menu.items.length - 1 ? "rounded-b-md" : ""}
                  `}
                  onClick={() => {
                    if (disabled) return;
                    item.action();
                    onClose();
                  }}
                  disabled={disabled}
                >
                  <span className="relative z-10">{item.label}</span>
                  {!disabled && (
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-[#4772b3] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
}
