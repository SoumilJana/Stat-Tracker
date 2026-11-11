import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminAddPlayerModal } from '../AdminAddPlayerModal';
import * as gamePaymentsApi from '../../../../lib/gamePaymentsApi';

vi.mock('../../../../lib/gamePaymentsApi', () => ({
  fetchAvailableProfilesForGame: vi.fn(),
  adminRegisterPlayers: vi.fn(),
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

    expect(screen.getByText(/Enlist Players to Match/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PlayerOne')).toBeInTheDocument();
      expect(screen.getByText('PlayerTwo')).toBeInTheDocument();
    });
  }, 15000);

  it('allows multi-selecting players and batch submitting with markAsPaid', async () => {
    vi.mocked(gamePaymentsApi.fetchAvailableProfilesForGame).mockResolvedValueOnce([
      { id: 'user-1', username: 'PlayerOne' },
      { id: 'user-2', username: 'PlayerTwo' }
    ]);
    vi.mocked(gamePaymentsApi.adminRegisterPlayers).mockResolvedValueOnce({
      success: true,
      enlisted_count: 2,
      active_count: 6,
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
      expect(screen.getByText('PlayerTwo')).toBeInTheDocument();
    });

    // Select both players
    fireEvent.click(screen.getByText('PlayerOne'));
    fireEvent.click(screen.getByText('PlayerTwo'));

    expect(screen.getByText('2 players chosen')).toBeInTheDocument();

    // Check mark as paid checkbox
    const markAsPaidCheckbox = screen.getByRole('checkbox');
    fireEvent.click(markAsPaidCheckbox);
    expect(markAsPaidCheckbox).toBeChecked();

    // Verify calculated amount preview: ₹80 * 2 = ₹160
    expect(screen.getByText('₹160')).toBeInTheDocument();

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /Enlist 2 Players/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(gamePaymentsApi.adminRegisterPlayers).toHaveBeenCalledWith(
        'test-game-id',
        ['user-1', 'user-2'],
        true,
        'CASH'
      );
      expect(mockOnPlayerAdded).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  }, 15000);

  it('supports Select All and Deselect All toggle', async () => {
    vi.mocked(gamePaymentsApi.fetchAvailableProfilesForGame).mockResolvedValueOnce([
      { id: 'user-1', username: 'PlayerOne' },
      { id: 'user-2', username: 'PlayerTwo' }
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

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument();
    });

    // Click Select All
    fireEvent.click(screen.getByText('Select All'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('Deselect All')).toBeInTheDocument();

    // Click Deselect All
    fireEvent.click(screen.getByText('Deselect All'));
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  }, 15000);
});
