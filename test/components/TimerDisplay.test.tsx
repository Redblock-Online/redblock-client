import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { TimerDisplay, type TimerController } from '@/features/game/ui';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function setup() {
  let ctrl!: TimerController; // will be assigned via bindController before assertions
  render(<TimerDisplay bindController={(c) => { ctrl = c; }} interval={100} />);
  return ctrl;
}

describe('TimerDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('start -> updates elapsed, stop freezes, reset clears (via controller)', () => {
    const ctrl = setup();

    // Initial state
    expect(screen.getByText('0.00s')).toBeInTheDocument();

    // Start the timer
    act(() => {
      ctrl.start();
    });

    // Advance timers by 450ms
    act(() => {
      vi.advanceTimersByTime(450);
    });

    // Check elapsed time after 450ms
    expect(ctrl.getElapsedSeconds()).toBeCloseTo(0.45, 2);

    // Advance to 1 second
    act(() => {
      vi.advanceTimersByTime(550);
    });

    // Stop the timer
    act(() => {
      ctrl.stop();
    });

    // Should be close to 1 second
    expect(ctrl.getElapsedSeconds()).toBeCloseTo(1.0, 1);

    // Reset the timer
    act(() => {
      ctrl.reset();
    });

    // Verify reset
    expect(ctrl.getElapsedSeconds()).toBe(0);
    expect(screen.getByText('0.00s')).toBeInTheDocument();
  });

  it('pause/resume maintains accumulated elapsed (via controller)', () => {
    const ctrl = setup();

    // Start the timer
    act(() => {
      ctrl.start();
    });

    // Advance 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Pause the timer
    act(() => {
      ctrl.pause();
    });

    const pausedTime = ctrl.getElapsedSeconds();
    expect(pausedTime).toBeCloseTo(0.5, 1);

    // Advance time while paused - should not affect elapsed time
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(ctrl.getElapsedSeconds()).toBeCloseTo(pausedTime, 2);

    // Resume the timer
    act(() => {
      ctrl.resume();
    });

    // Advance another 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Total should be around 1 second
    expect(ctrl.getElapsedSeconds()).toBeCloseTo(1.0, 1);

    // Ensure timer is stopped so lingering intervals don't update outside act
    act(() => {
      ctrl.stop();
    });
  });
});
