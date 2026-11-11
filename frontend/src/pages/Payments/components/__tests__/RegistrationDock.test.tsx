import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegistrationDock } from '../RegistrationDock';

describe('Phase 3: RegistrationDock Component', () => {
  it('triggers onSelectResponse when I am IN is clicked', () => {
    const handleSelect = vi.fn();
    render(<RegistrationDock onSelectResponse={handleSelect} />);

    const inBtn = screen.getByRole('button', { name: /I'm IN/i });
    fireEvent.click(inBtn);

    expect(handleSelect).toHaveBeenCalledWith('IN');
  });

  it('triggers onSelectResponse when I am OUT is clicked', () => {
    const handleSelect = vi.fn();
    render(<RegistrationDock onSelectResponse={handleSelect} />);

    const outBtn = screen.getByRole('button', { name: /I'm OUT/i });
    fireEvent.click(outBtn);

    expect(handleSelect).toHaveBeenCalledWith('OUT');
  });

  it('shows badge when current user response is set', () => {
    render(<RegistrationDock currentResponse="IN" onSelectResponse={vi.fn()} />);

    expect(screen.getByText('You are IN')).toBeInTheDocument();
  });

  it('disables buttons and displays reason when registration is locked', () => {
    render(
      <RegistrationDock
        disabled={true}
        disabledReason="Registration has been closed by admin"
        onSelectResponse={vi.fn()}
      />
    );

    expect(screen.getByText('Registration has been closed by admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I'm IN/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /I'm OUT/i })).toBeDisabled();
  });
});
