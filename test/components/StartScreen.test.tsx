import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StartScreen from '@/features/menu/components/StartScreen';
import { SCENARIOS } from '@/config/scenarios';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('StartScreen', () => {
  const mockOnStart = vi.fn();
  const mockOnSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage for sensitivity with all required Storage interface methods
    const localStorageMock = {
      getItem: vi.fn((key) => key === 'mouseSensitivity' ? '1.5' : null),
      setItem: vi.fn(),
      length: 0,
      clear: vi.fn(),
      key: vi.fn(),
      removeItem: vi.fn()
    };
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => localStorageMock);
  });

  it('displays all scenario buttons', () => {
    render(<StartScreen scenarios={SCENARIOS} onStart={mockOnStart} onSettings={mockOnSettings} />);

    // Should show all scenario buttons
    SCENARIOS.forEach((scenario) => {
      expect(screen.getByRole('button', { name: scenario.label })).toBeInTheDocument();
    });
  });

  it('calls onStart with correct scenario ID when button clicked', async () => {
    const user = userEvent.setup();
    render(<StartScreen scenarios={SCENARIOS} onStart={mockOnStart} onSettings={mockOnSettings} />);

    const firstButton = screen.getByRole('button', { name: SCENARIOS[0].label });
    await user.click(firstButton);

    expect(mockOnStart).toHaveBeenCalledWith(SCENARIOS[0].id);
  });

  it('displays and updates sensitivity slider', async () => {
    render(<StartScreen scenarios={SCENARIOS} onStart={mockOnStart} onSettings={mockOnSettings} />);

    // Check initial value display
    const sensitivityValue = screen.getByText('1.50');
    expect(sensitivityValue).toBeInTheDocument();

    // Change slider value using fireEvent.change
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.75' } });

    // Should update displayed value (note: may need to wait for state update)
    await waitFor(() => {
      expect(screen.getByText('0.75')).toBeInTheDocument();
    });

    // Should update localStorage
    expect(window.localStorage.setItem).toHaveBeenCalledWith('mouseSensitivity', '0.75');
  });
});
