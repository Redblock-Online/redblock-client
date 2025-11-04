/**
 * Detect monitor refresh rate using the Screen API
 * @returns Detected refresh rate in Hz, defaults to 60 if detection fails
 */
export function detectMonitorRefreshRate(): number {
  if (typeof window !== 'undefined' && window.screen) {
    // @ts-ignore - screen.refreshRate is not in all type definitions
    const screenRefreshRate = window.screen.refreshRate;
    if (screenRefreshRate && screenRefreshRate > 0) {
      return Math.round(screenRefreshRate);
    }
  }
  // Fallback to 60Hz if detection fails
  return 60;
}
