import { useCallback, useEffect, useState } from "react";
import { loadComponents, removeComponent, type SavedComponent } from "../componentsStore";

export function useComponentRegistry(): {
  components: SavedComponent[];
  refresh: () => void;
  remove: (id: string) => void;
} {
  const [components, setComponents] = useState<SavedComponent[]>([]);

  const refresh = useCallback(() => {
    setComponents(loadComponents());
  }, []);

  const remove = useCallback((id: string) => {
    removeComponent(id);
    refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { components, refresh, remove };
}
