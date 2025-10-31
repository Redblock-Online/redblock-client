import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Crosshair } from '@/features/shared/ui/components';

describe('Shared UI Components modlet', () => {
  it('should export Button component', () => {
    expect(Button).toBeDefined();
    expect(typeof Button).toBe('function');
  });

  it('should render Button component', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('should export Crosshair component', () => {
    expect(Crosshair).toBeDefined();
    expect(typeof Crosshair).toBe('function');
  });

  it('should render Crosshair component', () => {
    const { container } = render(<Crosshair />);
    expect(container.firstChild).toBeDefined();
  });
});
