import { type ReactElement, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export type ComponentCategory = "primitive" | "target" | "gameLogic" | "myComponents";

export type CategoryOption = {
  id: ComponentCategory;
  label: string;
  color: string;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "primitive", label: "Primitivo", color: "#4772b3" },
  { id: "target", label: "Target", color: "#ff4dff" },
  { id: "gameLogic", label: "Game Logic", color: "#ffa500" },
  { id: "myComponents", label: "My Components", color: "#9b5cff" },
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
          flex items-center gap-1.5 px-2 py-1 rounded text-[10px]
          bg-[#2b2b2b] border border-[#3a3a3a]
          text-[#cccccc] hover:text-white hover:border-[#4a4a4a]
          transition-all duration-150
        "
      >
        <svg
          width="10"
          height="10"
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
          width="8"
          height="8"
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
              fixed z-[9999]
              bg-[#2b2b2b] border border-[#3a3a3a] rounded shadow-lg
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
                    w-full flex items-center gap-2 px-3 py-2 text-[11px]
                    text-[#cccccc] hover:bg-[#353535] hover:text-white
                    transition-colors duration-150
                    border-b border-[#1a1a1a] last:border-b-0
                  "
                >
                  {/* Checkbox */}
                  <div
                    className={`
                      w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0
                      transition-all duration-150
                      ${isSelected ? "border-current" : "border-[#555555]"}
                    `}
                    style={{
                      backgroundColor: isSelected ? option.color : "transparent",
                      borderColor: isSelected ? option.color : undefined,
                    }}
                  >
                    {isSelected && (
                      <svg
                        width="8"
                        height="8"
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
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="flex-1 text-left">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
