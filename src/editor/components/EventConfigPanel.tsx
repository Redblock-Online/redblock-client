import { type ReactElement, useState } from "react";
import type { EventCollection, GameEvent, StartGeneratorEvent } from "../types/eventConfig";
import { createEvent } from "../types/eventConfig";

type EventConfigPanelProps = {
  events: EventCollection;
  onChange: (events: EventCollection) => void;
  onRequestGeneratorSelection?: (eventId: string) => void; // Request to select a generator in the editor
  setTyping?: (typing: boolean) => void;
};

export function EventConfigPanel({ 
  events, 
  onChange, 
  onRequestGeneratorSelection,
  setTyping 
}: EventConfigPanelProps): ReactElement {
  const [expandedSection, setExpandedSection] = useState<"onComplete" | null>("onComplete");
  
  const inputClass = "w-full rounded border border-[#3a3a3a] bg-[#2b2b2b] px-2 py-1 text-[11px] text-white outline-none focus:border-[#4772b3]";
  const labelClass = "text-[10px] text-[#999999] mb-1";
  const buttonClass = "px-2 py-1 rounded bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white text-[10px] cursor-pointer transition";
  const dangerButtonClass = "px-2 py-1 rounded bg-[#8b3a3a] hover:bg-[#a04a4a] text-white text-[10px] cursor-pointer transition";
  const successButtonClass = "px-2 py-1 rounded bg-[#3a8b3a] hover:bg-[#4aa04a] text-white text-[10px] cursor-pointer transition";

  const addEvent = (eventType: "startGenerator") => {
    const newEvent = createEvent(eventType);
    onChange({
      ...events,
      onComplete: [...events.onComplete, newEvent],
    });
  };

  const removeEvent = (eventId: string) => {
    onChange({
      ...events,
      onComplete: events.onComplete.filter(e => e.id !== eventId),
    });
  };

  const updateEvent = <T extends GameEvent>(eventId: string, updates: Partial<T>) => {
    onChange({
      ...events,
      onComplete: events.onComplete.map(e => 
        e.id === eventId ? { ...e, ...updates } as GameEvent : e
      ),
    });
  };

  const renderStartGeneratorEvent = (event: StartGeneratorEvent) => {
    return (
      <div className="flex flex-col gap-2 p-2 bg-[#1a1a1a] rounded">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#cccccc] font-medium">Start Generator</span>
          <button
            type="button"
            onClick={() => removeEvent(event.id)}
            className={dangerButtonClass}
          >
            ✕
          </button>
        </div>

        <div>
          <label className={labelClass}>Target Generator ID</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={event.targetGeneratorId}
              onChange={(e) => updateEvent(event.id, { targetGeneratorId: e.target.value })}
              onFocus={() => setTyping?.(true)}
              onBlur={() => setTyping?.(false)}
              placeholder="block-123"
              className={`flex-1 ${inputClass}`}
            />
            {onRequestGeneratorSelection && (
              <button
                type="button"
                onClick={() => {
                  console.log('[EventConfigPanel] 🎯 button clicked, eventId:', event.id);
                  console.log('[EventConfigPanel] Callback exists:', !!onRequestGeneratorSelection);
                  onRequestGeneratorSelection(event.id);
                }}
                className={buttonClass}
                title="Click then select a generator in the editor"
              >
                🎯
              </button>
            )}
          </div>
          <p className="text-[9px] text-[#666666] mt-1">
            Click 🎯 then click a generator in the editor to link it
          </p>
        </div>
      </div>
    );
  };

  const renderEvent = (event: GameEvent) => {
    switch (event.type) {
      case "startGenerator":
        return renderStartGeneratorEvent(event);
      default:
        return (
          <div className="p-2 bg-[#1a1a1a] rounded text-[10px] text-[#666666]">
            Unknown event type: {event.type}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[#1a1a1a] pt-3 mt-3">
      <div className="text-[10px] text-[#999999] uppercase tracking-wider font-medium">
        Events
      </div>

      {/* On Complete Section */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setExpandedSection(expandedSection === "onComplete" ? null : "onComplete")}
          className="flex items-center justify-between p-2 rounded bg-[#2b2b2b] hover:bg-[#3a3a3a] transition cursor-pointer"
        >
          <span className="text-[11px] text-[#cccccc] font-medium">
            On Complete ({events.onComplete.length})
          </span>
          <span className="text-[10px] text-[#999999]">
            {expandedSection === "onComplete" ? "▼" : "▶"}
          </span>
        </button>

        {expandedSection === "onComplete" && (
          <div className="flex flex-col gap-2 pl-2">
            {events.onComplete.length === 0 ? (
              <p className="text-[10px] text-[#666666] italic py-2">
                No events configured. Add an event below.
              </p>
            ) : (
              events.onComplete.map(event => (
                <div key={event.id}>
                  {renderEvent(event)}
                </div>
              ))
            )}

            {/* Add Event Buttons */}
            <div className="flex flex-col gap-1 mt-2">
              <span className="text-[9px] text-[#999999] uppercase tracking-wider">Add Event</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => addEvent("startGenerator")}
                  className={buttonClass}
                >
                  + Start Generator
                </button>
                {/* Future event types will be added here */}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-[9px] text-[#666666] leading-relaxed">
        Events are triggered when all targets from this generator are destroyed.
      </div>
    </div>
  );
}
