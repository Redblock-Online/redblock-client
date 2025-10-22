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
          className="absolute min-w-[180px] overflow-hidden rounded border border-[#1a1a1a] bg-[#323232] shadow-lg"
          style={{ left: position.left, top: position.top, minWidth: Math.max(position.width, 160) }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {menu.items.map((item) => {
            const disabled = Boolean(item.disabled);
            return (
              <button
                key={item.id}
                type="button"
                className={`block w-full px-3 py-1.5 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  disabled
                    ? "text-[#666666]"
                    : "text-[#cccccc] hover:bg-[#4772b3] hover:text-white"
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
