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
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-6 py-12" onClick={handleWrapperClick}>
        <div
          className="w-full max-w-md rounded border border-[#1a1a1a] bg-[#383838] shadow-2xl"
          onClick={handleDialogClick}
        >
          <header className="border-b border-[#1a1a1a] px-4 py-3">
            <h2 className="text-[12px] font-medium text-[#cccccc]">Delete Component</h2>
          </header>
          <div className="px-4 py-4 text-[11px] text-[#cccccc]">
            <p className="mb-4">
              Are you sure you want to delete <span className="font-semibold">{componentName}</span>? This action will remove all its instances from the scene.
            </p>
            <div className="flex justify-end gap-2 text-[11px]">
              <button
                type="button"
                className="rounded border border-[#1a1a1a] bg-[#2b2b2b] px-3 py-1.5 text-[#cccccc] transition hover:bg-[#404040]"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border border-transparent bg-[#ef4444] px-3 py-1.5 text-white transition hover:bg-[#dc2626]"
                onClick={onConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
