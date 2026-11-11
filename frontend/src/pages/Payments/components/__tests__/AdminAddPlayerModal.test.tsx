import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminAddPlayerModal } from '../AdminAddPlayerModal';
import * as gamePaymentsApi from '../../../../lib/gamePaymentsApi';

vi.mock('../../../../lib/gamePaymentsApi', () => ({
  fetchAvailableProfilesForGame: vi.fn(),
  adminRegisterPlayer: vi.fn()
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn()
};

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => mockToast
}));

describe('AdminAddPlayerModal', () => {
  const mockOnClose = vi.fn();
  const mockOnPlayerAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open and lists available profiles', async () => {
    vi.mocked(gamePaymentsApi.fetchAvailableProfilesForGame).mockResolvedValueOnce([
      { id: 'user-1', username: 'PlayerOne', jersey_number: 7 },
      { id: 'user-2', username: 'PlayerTwo', jersey_number: 10 }
    ]);

    render(
      <AdminAddPlayerModal
        isOpen={true}
        onClose={mockOnClose}
        gameId="test-game-id"
        alreadyInUserIds={[]}
        amountPerPlayer={80}
        onPlayerAdded={mockOnPlayerAdded}
      />
    );

    expect(screen.getByText(/Enlist Player to Match/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PlayerOne')).toBeInTheDocument();
      expect(screen.getByText('PlayerTwo')).toBeInTheDocument();
    });
  });

  it('allows selecting a player and submitting with markAsPaid', async () => {
    vi.mocked(gamePaymentsApi.fetchAvailableProfilesForGame).mockResolvedValueOnce([
      { id: 'user-1', username: 'PlayerOne' }
    ]);
    vi.mocked(gamePaymentsApi.adminRegisterPlayer).mockResolvedValueOnce({
      success: true,
      active_count: 5,
      game_status: 'REGISTRATION_OPEN',
      paid: true
    });

    render(
      <AdminAddPlayerModal
        isOpen={true}
        onClose={mockOnClose}
        gameId="test-game-id"
        alreadyInUserIds={[]}
        amountPerPlayer={80}
        onPlayerAdded={mockOnPlayerAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('PlayerOne')).toBeInTheDocument();
    });

    // Check mark as paid checkbox
    const markAsPaidCheckbox = screen.getByRole('checkbox');
    fireEvent.click(markAsPaidCheckbox);
    expect(markAsPaidCheckbox).toBeChecked();

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /Add to Roster/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(gamePaymentsApi.adminRegisterPlayer).toHaveBeenCalledWith(
        'test-game-id',
        'user-1',
        true,
        'CASH'
      );
      expect(mockOnPlayerAdded).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
