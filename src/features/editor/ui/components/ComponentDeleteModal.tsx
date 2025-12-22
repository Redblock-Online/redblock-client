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
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6 py-12 font-sans" onClick={handleWrapperClick}>
        <div
          className="w-full max-w-md rounded-xl border border-editor-border bg-editor-panel shadow-2xl"
          onClick={handleDialogClick}
        >
          <header className="border-b border-editor-border px-5 py-4">
            <h2 className="text-editor-base font-semibold text-editor-text">Eliminar componente</h2>
          </header>
          <div className="px-5 py-5 text-editor-sm text-editor-text">
            <p className="mb-5 leading-relaxed">
              ¿Seguro que deseas eliminar <span className="font-semibold">{componentName}</span>? Esta acción eliminará todas sus instancias en la escena.
            </p>
            <div className="flex justify-end gap-3 text-editor-sm">
              <button
                type="button"
                className="rounded-md border border-editor-border bg-editor-bg px-4 py-2 font-medium text-editor-text transition-all duration-150 hover:bg-editor-surface"
                onClick={onCancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-md bg-red-500 px-4 py-2 font-medium text-white transition-all duration-150 hover:bg-red-600"
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
