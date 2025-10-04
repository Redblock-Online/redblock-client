import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Ensure JSDOM has required globals/mocks used by the app
beforeAll(() => {
  // Mock pointer lock APIs used in UI/App
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    get: () => null,
  });
  // Canvas element requestPointerLock mock
  if (!HTMLCanvasElement.prototype.requestPointerLock) {
    // @ts-expect-error jsdom lacks this
    HTMLCanvasElement.prototype.requestPointerLock = vi.fn(() => {});
  }

  // Stable performance.now mock controller for timer tests (can be overridden per test)
  const perfNow = performance.now.bind(performance);
  vi.spyOn(performance, 'now').mockImplementation(() => perfNow());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
