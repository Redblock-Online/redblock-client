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

  it('displays main action buttons', () => {
    render(<StartScreen scenarios={SCENARIOS} onStart={mockOnStart} onSettings={mockOnSettings} />);

    // Should show main buttons
    expect(screen.getByRole('button', { name: /Quick Warmup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load Scenarios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SETTINGS/i })).toBeInTheDocument();
  });

  it('calls onStart when Quick Warmup button clicked', async () => {
    const user = userEvent.setup();
    render(<StartScreen scenarios={SCENARIOS} onStart={mockOnStart} onSettings={mockOnSettings} />);

    const quickWarmupButton = screen.getByRole('button', { name: /Quick Warmup/i });
    await user.click(quickWarmupButton);

    // Quick Warmup uses the first scenario's ID
    expect(mockOnStart).toHaveBeenCalledWith(SCENARIOS[0].id);
  });

  it('calls onSettings when settings button clicked', async () => {
    const user = userEvent.setup();
    render(<StartScreen scenarios={SCENARIOS} onStart={mockOnStart} onSettings={mockOnSettings} />);

    const settingsButton = screen.getByRole('button', { name: /SETTINGS/i });
    await user.click(settingsButton);

    expect(mockOnSettings).toHaveBeenCalled();
  });
});
