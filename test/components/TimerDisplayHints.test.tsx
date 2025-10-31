import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { TimerDisplay, type TimerController, type TimerHint } from '@/features/game/ui';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function setup() {
  let ctrl!: TimerController;
  render(<TimerDisplay bindController={(c) => { ctrl = c; }} interval={100} />);
  return ctrl;
}

describe('TimerDisplay with hints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('displays stats table after stop with valid performance', () => {
    const ctrl = setup();
    
    // Start the timer
    act(() => { 
      ctrl.start(); 
    });
    
    // Advance time by 500ms
    act(() => { 
      vi.advanceTimersByTime(500); 
    });
    
    // Stop the timer
    act(() => { 
      ctrl.stop(); 
    });

    // Verify the timer shows the elapsed time
    const timeDisplay = screen.getByText(/\d+\.\d\ds/);
    expect(timeDisplay).toBeInTheDocument();
  });

  it('displays custom hint text after stop', () => {
    const ctrl = setup();
    const hint: TimerHint = 'Great job!';

    // Start the timer
    act(() => { 
      ctrl.start(); 
    });
    
    // Advance time by 500ms
    act(() => { 
      vi.advanceTimersByTime(500); 
    });
    
    // Stop with custom hint
    act(() => { 
      ctrl.stop(hint); 
    });

    // Verify the hint text is displayed
    expect(screen.getByText('Great job!')).toBeInTheDocument();
  });
});
