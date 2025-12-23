import { useCallback, useRef, useState, useEffect } from "react";
import type { MenuPosition } from "@/features/editor/types";

export function useMenuManagement() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>(null);
  const menuAnchors = useRef<Record<string, HTMLButtonElement | null>>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateMenuPosition = useCallback((id: string) => {
    const anchor = menuAnchors.current[id];
    if (!anchor) {
      setMenuPosition(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setMenuPosition({ left: rect.left, top: rect.bottom + 4, width: rect.width });
  }, []);

  const openMenu = useCallback((id: string) => {
    // Cancel any pending close timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    setOpenMenuId(id);
    updateMenuPosition(id);
  }, [updateMenuPosition]);

  const closeMenus = useCallback(() => {
    setOpenMenuId(null);
    setMenuPosition(null);
  }, []);

  const scheduleCloseMenus = useCallback((delay: number = 300) => {
    // Cancel any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Schedule new close timeout
    hoverTimeoutRef.current = setTimeout(() => {
      closeMenus();
      hoverTimeoutRef.current = null;
    }, delay);
  }, [closeMenus]);

  const handleMenuHover = useCallback((menuId: string) => {
    openMenu(menuId);
  }, [openMenu]);

  const handleMenuLeave = useCallback(() => {
    scheduleCloseMenus();
  }, [scheduleCloseMenus]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return {
    openMenuId,
    setOpenMenuId,
    menuPosition,
    menuAnchors,
    updateMenuPosition,
    closeMenus,
    handleMenuHover,
    handleMenuLeave,
    scheduleCloseMenus,
  };
}
