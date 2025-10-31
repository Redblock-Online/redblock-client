import { describe, it, expect } from 'vitest';
import { FPSCounter, TimerDisplay, PingDisplay, PauseMenu } from '@/features/game/ui';

describe('Game UI modlet', () => {
  it('should export FPSCounter component', () => {
    expect(FPSCounter).toBeDefined();
    expect(typeof FPSCounter).toBe('function');
  });

  it('should export TimerDisplay component', () => {
    expect(TimerDisplay).toBeDefined();
    expect(typeof TimerDisplay).toBe('function');
  });

  it('should export PingDisplay component', () => {
    expect(PingDisplay).toBeDefined();
    expect(typeof PingDisplay).toBe('function');
  });

  it('should export PauseMenu component', () => {
    expect(PauseMenu).toBeDefined();
    expect(typeof PauseMenu).toBe('function');
  });
});
