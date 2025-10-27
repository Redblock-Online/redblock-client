/**
 * Alert severity levels
 */
export type AlertSeverity = "error" | "warning" | "info";

/**
 * Alert definition
 */
export type Alert = {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
};

/**
 * Alert listener callback
 */
export type AlertListener = (alerts: Alert[]) => void;

/**
 * AlertManager - Centralized system for editor warnings and errors
 * 
 * Usage:
 * ```ts
 * // Publish an alert
 * alertManager.publish("spawn-no-floor", "warning", "Spawn point has no floor beneath it");
 * 
 * // Clear an alert
 * alertManager.clear("spawn-no-floor");
 * 
 * // Listen to changes
 * const unsubscribe = alertManager.addListener((alerts) => {
 *   console.log("Active alerts:", alerts);
 * });
 * ```
 */
export class AlertManager {
  private alerts = new Map<string, Alert>();
  private listeners = new Set<AlertListener>();

  /**
   * Publish or update an alert
   */
  public publish(id: string, severity: AlertSeverity, message: string): void {
    const existing = this.alerts.get(id);
    
    // Only notify if alert is new or changed
    if (!existing || existing.message !== message || existing.severity !== severity) {
      this.alerts.set(id, {
        id,
        severity,
        message,
        timestamp: Date.now(),
      });
      this.notifyListeners();
    }
  }

  /**
   * Clear a specific alert
   */
  public clear(id: string): void {
    if (this.alerts.delete(id)) {
      this.notifyListeners();
    }
  }

  /**
   * Clear all alerts
   */
  public clearAll(): void {
    if (this.alerts.size > 0) {
      this.alerts.clear();
      this.notifyListeners();
    }
  }

  /**
   * Get all active alerts
   */
  public getAlerts(): Alert[] {
    return Array.from(this.alerts.values()).sort((a, b) => {
      // Sort by severity (error > warning > info) then by timestamp
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp - a.timestamp;
    });
  }

  /**
   * Check if there are any alerts
   */
  public hasAlerts(): boolean {
    return this.alerts.size > 0;
  }

  /**
   * Get the highest severity level of active alerts
   */
  public getHighestSeverity(): AlertSeverity | null {
    if (this.alerts.size === 0) return null;
    
    for (const alert of this.alerts.values()) {
      if (alert.severity === "error") return "error";
    }
    for (const alert of this.alerts.values()) {
      if (alert.severity === "warning") return "warning";
    }
    return "info";
  }

  /**
   * Subscribe to alert changes
   */
  public addListener(listener: AlertListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getAlerts());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const alerts = this.getAlerts();
    for (const listener of this.listeners) {
      listener(alerts);
    }
  }
}
