import { type ReactElement, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export type ComponentCategory = "primitive" | "target" | "gameLogic" | "myComponents";

export type CategoryOption = {
  id: ComponentCategory;
  label: string;
  color: string;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "primitive", label: "Primitive", color: "#228be6" },
  { id: "target", label: "Target", color: "#e64980" },
  { id: "gameLogic", label: "Game Logic", color: "#fd7e14" },
  { id: "myComponents", label: "My Components", color: "#9333ea" },
];

type CategoryFilterProps = {
  selectedCategories: Set<ComponentCategory>;
  onToggleCategory: (category: ComponentCategory) => void;
};

export function CategoryFilter({ selectedCategories, onToggleCategory }: CategoryFilterProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: 192, // w-48 = 12rem = 192px
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedCount = selectedCategories.size;
  const allSelected = selectedCount === CATEGORY_OPTIONS.length;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-1.5 rounded-md text-editor-xs
          bg-white border border-editor-border
          text-editor-text hover:text-editor-accent hover:border-editor-accent/50
          transition-all duration-150
        "
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        <span className="font-medium">
          {allSelected ? "All" : selectedCount === 0 ? "None" : `${selectedCount} selected`}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="
              fixed z-[9999] font-sans
              bg-white border border-editor-border rounded-lg shadow-xl
              overflow-hidden
            "
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            {CATEGORY_OPTIONS.map((option) => {
              const isSelected = selectedCategories.has(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onToggleCategory(option.id);
                  }}
                  className="
                    w-full flex items-center gap-2.5 px-4 py-2.5 text-editor-sm
                    text-editor-text hover:bg-editor-surface
                    transition-all duration-150
                    border-b border-editor-border last:border-b-0
                  "
                >
                  {/* Checkbox */}
                  <div
                    className={`
                      w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      transition-all duration-150
                      ${isSelected ? "border-current" : "border-editor-muted"}
                    `}
                    style={{
                      backgroundColor: isSelected ? option.color : "transparent",
                      borderColor: isSelected ? option.color : undefined,
                    }}
                  >
                    {isSelected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  {/* Color indicator */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="flex-1 text-left font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}