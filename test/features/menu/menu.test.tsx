import { describe, it, expect } from 'vitest';
import { mountUI, type UIController, SettingsMenu } from '@/features/menu';

describe('Menu modlet', () => {
  it('should export mountUI function', () => {
    expect(mountUI).toBeDefined();
    expect(typeof mountUI).toBe('function');
  });

  it('should export UIController type', () => {
    // Type test - if this compiles, the type is exported correctly
    const mockController: UIController = {
      timer: {
        start: () => {},
        stop: () => {},
        reset: () => {},
        pause: () => {},
        resume: () => {},
        getElapsedSeconds: () => 0,
      },
    };
    
    expect(mockController).toBeDefined();
    expect(mockController.timer).toBeDefined();
  });

  it('should export SettingsMenu component', () => {
    expect(SettingsMenu).toBeDefined();
    expect(typeof SettingsMenu).toBe('function');
  });
});
