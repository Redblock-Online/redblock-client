import { useCallback, type ReactElement } from "react";
import { Portal } from "./Portal";

export type ComponentDeleteModalProps = {
  open: boolean;
  componentName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ComponentDeleteModal({ open, componentName, onCancel, onConfirm }: ComponentDeleteModalProps): ReactElement | null {
  const handleWrapperClick = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleDialogClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  if (!open) {
    return null;
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-6 py-12" onClick={handleWrapperClick}>
        <div
          className="w-full max-w-md rounded-lg border border-rb-border bg-white shadow-xl outline outline-4 outline-rb-border"
          onClick={handleDialogClick}
        >
          <header className="border-b border-rb-border px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-rb-muted">Eliminar componente</h2>
          </header>
          <div className="px-6 py-5 text-sm text-rb-text">
            <p className="mb-4">
              ¿Seguro que deseas eliminar <span className="font-semibold">{componentName}</span>? Esta acción eliminará todas sus instancias en la escena.
            </p>
            <div className="flex justify-end gap-3 text-xs uppercase tracking-[0.3em]">
              <button
                type="button"
                className="rounded border border-rb-border px-4 py-2 text-rb-muted transition hover:bg-black/5"
                onClick={onCancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded border border-transparent bg-black px-4 py-2 text-white transition hover:bg-rb-border"
                onClick={onConfirm}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
