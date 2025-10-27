import { type ReactElement, useState } from "react";
import type { Alert, AlertSeverity } from "../core/AlertManager";

type AlertIconProps = {
  alerts: Alert[];
};

export function AlertIcon({ alerts }: AlertIconProps): ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  
  const hasAlerts = alerts.length > 0;
  const highestSeverity = hasAlerts ? alerts[0].severity : null;

  // Determine icon and color based on severity
  const getIconColor = (): string => {
    if (!hasAlerts) return "#4ade80"; // Green checkmark
    switch (highestSeverity) {
      case "error":
        return "#ef4444"; // Red
      case "warning":
        return "#f59e0b"; // Orange/Yellow
      case "info":
        return "#3b82f6"; // Blue
      default:
        return "#4ade80";
    }
  };

  const getSeverityLabel = (severity: AlertSeverity): string => {
    switch (severity) {
      case "error":
        return "Error";
      case "warning":
        return "Warning";
      case "info":
        return "Info";
    }
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon Button */}
      <button
        className="flex h-7 w-7 items-center justify-center rounded transition hover:bg-[#404040]"
        title={hasAlerts ? `${alerts.length} alert${alerts.length > 1 ? 's' : ''}` : "No issues"}
      >
        {!hasAlerts ? (
          // Green checkmark (all good)
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={getIconColor()}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          // Alert triangle
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={getIconColor()}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        {hasAlerts && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-bold text-white">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>

      {/* Hover Popup */}
      {isHovered && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded border border-[#1a1a1a] bg-[#2b2b2b] shadow-lg">
          <div className="border-b border-[#1a1a1a] px-3 py-2">
            <h3 className="text-[11px] font-semibold text-white">
              {hasAlerts ? "Scene Issues" : "Scene Status"}
            </h3>
          </div>
          
          {!hasAlerts ? (
            <div className="flex items-center gap-2 px-3 py-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4ade80"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-[11px] text-[#999999]">
                No issues detected
              </span>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border-b border-[#1a1a1a] px-3 py-2 last:border-b-0"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex-shrink-0">
                      {alert.severity === "error" ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      ) : alert.severity === "warning" ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="12" x2="12.01" y2="12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: getIconColor() }}>
                        {getSeverityLabel(alert.severity)}
                      </div>
                      <div className="text-[11px] leading-relaxed text-[#cccccc]">
                        {alert.message}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
