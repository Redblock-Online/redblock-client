import {
  useCallback,
  useRef,
  type ChangeEventHandler,
  type DragEventHandler,
  type ReactElement,
} from "react";
import { AUTO_SAVE_SCENARIO_NAME, type StoredScenario } from "../scenarioStore";
import { Portal } from "./Portal";

type ScenarioModalProps = {
  open: boolean;
  scenarios: StoredScenario[];
  onClose: () => void;
  onSelectScenario: (scenario: StoredScenario) => void;
  onDeleteScenario: (id: string) => void;
  onImportFiles: (files: FileList | File[]) => void;
};

export function ScenarioModal({
  open,
  scenarios,
  onClose,
  onSelectScenario,
  onDeleteScenario,
  onImportFiles,
}: ScenarioModalProps): ReactElement | null {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        onImportFiles(files);
        event.target.value = "";
      }
    },
    [onImportFiles],
  );

  const handleDragOver = useCallback<DragEventHandler<HTMLDivElement>>((event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback<DragEventHandler<HTMLDivElement>>(
    (event) => {
      event.preventDefault();
      if (event.dataTransfer?.files?.length) {
        onImportFiles(event.dataTransfer.files);
      }
    },
    [onImportFiles],
  );

  if (!open) {
    return null;
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 px-6 py-12" onClick={onClose}>
        <div
          className="w-full max-w-3xl rounded-lg border border-rb-border bg-white shadow-xl outline outline-4 outline-rb-border"
          onClick={(event) => event.stopPropagation()}
        >
        <header className="flex items-center justify-between border-b border-rb-border px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-rb-muted">Load Scenario</h2>
          <button
            type="button"
            className="h-8 w-8 rounded border border-transparent text-rb-muted transition hover:border-rb-border hover:text-rb-text"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="grid gap-6 px-6 py-6 md:grid-cols-[2fr,1fr]">
          <section className="min-h-[220px] overflow-hidden rounded border border-rb-border">
            <div className="flex items-center justify-between border-b border-rb-border bg-rb-panel px-4 py-3 text-xs uppercase tracking-widest text-rb-muted">
              <span>Saved Scenarios</span>
              <span>{scenarios.length}</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {scenarios.length === 0 ? (
                <div className="flex items-center justify-center px-4 py-12 text-xs text-rb-muted">
                  No scenarios saved yet.
                </div>
              ) : (
                <ul className="divide-y divide-rb-border">
                  {scenarios.map((scenario) => (
                    <li key={scenario.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="flex flex-col">
                        <span className="font-semibold text-rb-text">
                          {scenario.name}
                          {scenario.name === AUTO_SAVE_SCENARIO_NAME ? " (auto)" : ""}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-rb-muted">
                          {new Date(scenario.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-rb-border px-3 py-1 text-xs uppercase tracking-widest text-rb-text transition hover:bg-black hover:text-white"
                          onClick={() => onSelectScenario(scenario)}
                        >
                          Load
                        </button>
                        {scenario.name === AUTO_SAVE_SCENARIO_NAME ? null : (
                          <button
                            type="button"
                            className="rounded border border-transparent px-3 py-1 text-xs uppercase tracking-widest text-rb-muted transition hover:border-rb-border hover:text-rb-text"
                            onClick={() => onDeleteScenario(scenario.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section className="flex flex-col items-center justify-center gap-4 rounded border border-dashed border-rb-border bg-rb-panel/70 px-4 py-6 text-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <p className="text-xs text-rb-muted">
              Drop `.rbonline` files here to import scenarios
            </p>
            <button
              type="button"
              className="rounded border border-rb-border bg-white px-4 py-2 text-xs uppercase tracking-widest text-rb-text transition hover:bg-black hover:text-white"
              onClick={handleBrowseClick}
            >
              Browse Files
            </button>
            <p className="text-[10px] uppercase tracking-[0.3em] text-rb-muted">Multiple files supported</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".rbonline,application/json"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </section>
        </div>
        </div>
      </div>
    </Portal>
  );
}
