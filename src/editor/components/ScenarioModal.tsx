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
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-6 py-12" onClick={onClose}>
        <div
          className="w-full max-w-3xl rounded border border-[#1a1a1a] bg-[#383838] shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
        <header className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3">
          <h2 className="text-[14px] font-medium text-[#cccccc]">Load Scenario</h2>
          <button
            type="button"
            className="h-8 w-8 rounded border border-transparent text-[#999999] transition hover:border-[#1a1a1a] hover:text-[#cccccc]"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="grid gap-4 px-4 py-4 md:grid-cols-[2fr,1fr]">
          <section className="min-h-[220px] overflow-hidden rounded border border-[#1a1a1a]">
            <div className="flex items-center justify-between border-b border-[#1a1a1a] bg-[#2b2b2b] px-3 py-2 text-[13px] text-[#999999]">
              <span>Saved Scenarios</span>
              <span>{scenarios.length}</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {scenarios.length === 0 ? (
                <div className="flex items-center justify-center px-4 py-12 text-[13px] text-[#666666]">
                  No scenarios saved yet.
                </div>
              ) : (
                <ul className="divide-y divide-[#1a1a1a]">
                  {scenarios.map((scenario) => (
                    <li key={scenario.id} className="flex items-center justify-between px-3 py-2.5 text-[13px] bg-[#2b2b2b] hover:bg-[#323232] transition">
                      <div className="flex flex-col">
                        <span className="font-medium text-[#cccccc]">
                          {scenario.name}
                          {scenario.name === AUTO_SAVE_SCENARIO_NAME ? " (auto)" : ""}
                        </span>
                        <span className="text-[14px] text-[#999999]">
                          {new Date(scenario.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-[#1a1a1a] bg-[#4772b3] px-3 py-1 text-[13px] text-white transition hover:bg-[#5a8fd6]"
                          onClick={() => onSelectScenario(scenario)}
                        >
                          Load
                        </button>
                        {scenario.name === AUTO_SAVE_SCENARIO_NAME ? null : (
                          <button
                            type="button"
                            className="rounded border border-transparent px-3 py-1 text-[13px] text-[#999999] transition hover:border-[#1a1a1a] hover:text-[#cccccc]"
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
          <section className="flex flex-col items-center justify-center gap-3 rounded border border-dashed border-[#1a1a1a] bg-[#2b2b2b] px-4 py-6 text-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <p className="text-[13px] text-[#999999]">
              Drop `.rbonline` files here to import scenarios
            </p>
            <button
              type="button"
              className="rounded border border-[#1a1a1a] bg-[#4772b3] px-4 py-2 text-[13px] text-white transition hover:bg-[#5a8fd6]"
              onClick={handleBrowseClick}
            >
              Browse Files
            </button>
            <p className="text-[14px] text-[#666666]">Multiple files supported</p>
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
