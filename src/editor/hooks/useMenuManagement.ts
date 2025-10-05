import { useCallback, useRef, useState } from "react";
import type { MenuPosition } from "../types/editorTypes";

export function useMenuManagement() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>(null);
  const menuAnchors = useRef<Record<string, HTMLButtonElement | null>>({});

  const updateMenuPosition = useCallback((id: string) => {
    const anchor = menuAnchors.current[id];
    if (!anchor) {
      setMenuPosition(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setMenuPosition({ left: rect.left, top: rect.bottom + 4, width: rect.width });
  }, []);

  const closeMenus = useCallback(() => {
    setOpenMenuId(null);
    setMenuPosition(null);
  }, []);

  return {
    openMenuId,
    setOpenMenuId,
    menuPosition,
    menuAnchors,
    updateMenuPosition,
    closeMenus,
  };
}
