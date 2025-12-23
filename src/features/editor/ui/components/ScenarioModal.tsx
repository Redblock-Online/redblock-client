import {
  useCallback,
  useRef,
  type ChangeEventHandler,
  type DragEventHandler,
  type ReactElement,
} from "react";
import { AUTO_SAVE_SCENARIO_NAME, type StoredScenario } from "src/features/editor/scenarios/scenarioStore";
import { Portal } from "./Portal";

type ScenarioModalProps = {
  open: boolean;
  scenarios: StoredScenario[];
  onClose: () => void;
  onSelectScenario: (scenario: StoredScenario) => void;
  onDeleteScenario: (id: string) => void;
  onDownloadScenario: (scenario: StoredScenario) => void;
  onImportFiles: (files: FileList | File[]) => void;
};

export function ScenarioModal({
  open,
  scenarios,
  onClose,
  onSelectScenario,
  onDeleteScenario,
  onDownloadScenario,
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
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/30 backdrop-blur-sm px-6 py-12 font-sans" onClick={onClose}>
        <div
          className="w-full max-w-3xl rounded-xl border border-editor-border bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
        <header className="flex items-center justify-between border-b border-editor-border px-5 py-4">
          <h2 className="text-editor-base font-semibold text-editor-text">Load Scenario</h2>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-transparent text-editor-muted transition-all duration-150 hover:border-editor-border hover:text-editor-text hover:bg-editor-surface"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="grid gap-5 px-5 py-5 md:grid-cols-[2fr,1fr]">
          <section className="min-h-[240px] overflow-hidden rounded-lg border border-editor-border">
            <div className="flex items-center justify-between border-b border-editor-border bg-editor-surface px-4 py-3 text-editor-sm text-editor-muted">
              <span className="font-medium">Saved Scenarios</span>
              <span>{scenarios.length}</span>
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              {scenarios.length === 0 ? (
                <div className="flex items-center justify-center px-5 py-14 text-editor-sm text-editor-muted">
                  No scenarios saved yet.
                </div>
              ) : (
                <ul className="divide-y divide-editor-border">
                  {scenarios.map((scenario) => (
                    <li key={scenario.id} className="flex items-center justify-between px-4 py-3 text-editor-sm bg-white hover:bg-editor-surface transition-all duration-150">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-editor-text">
                          {scenario.name}
                          {scenario.name === AUTO_SAVE_SCENARIO_NAME ? " (auto)" : ""}
                        </span>
                        <span className="text-editor-xs text-editor-muted">
                          {new Date(scenario.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          className="rounded-md bg-editor-accent px-4 py-1.5 text-editor-sm font-medium text-white transition-all duration-150 hover:bg-editor-accentHover shadow-sm"
                          onClick={() => onSelectScenario(scenario)}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-editor-border bg-white px-2.5 py-1.5 text-editor-sm text-editor-text transition-all duration-150 hover:bg-editor-surface"
                          onClick={() => onDownloadScenario(scenario)}
                          title="Download scenario"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                        {scenario.name === AUTO_SAVE_SCENARIO_NAME ? null : (
                          <button
                            type="button"
                            className="rounded-md border border-transparent px-4 py-1.5 text-editor-sm text-editor-muted transition-all duration-150 hover:border-editor-border hover:text-editor-text"
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
          <section className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-editor-border bg-editor-surface px-5 py-8 text-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <p className="text-editor-sm text-editor-muted">
              Drop `.rbonline` files here to import scenarios
            </p>
            <button
              type="button"
              className="rounded-md bg-editor-accent px-5 py-2.5 text-editor-sm font-medium text-white transition-all duration-150 hover:bg-editor-accentHover shadow-sm"
              onClick={handleBrowseClick}
            >
              Browse Files
            </button>
            <p className="text-editor-xs text-editor-muted">Multiple files supported</p>
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