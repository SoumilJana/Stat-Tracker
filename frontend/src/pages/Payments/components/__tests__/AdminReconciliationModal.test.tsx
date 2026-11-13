import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminReconciliationModal } from '../AdminReconciliationModal';
import type { Game, PlayerRosterItem, GamePayment } from '../../../../types/gamePayment';

const mockGame: Game = {
  id: 'game-1',
  game_date: '2026-11-15',
  start_time: '19:00',
  location: 'Turf',
  amount_per_player: 80,
  total_turf_cost: 800,
  duration_minutes: 60,
  mode: 'STANDARD',
  min_players: 10,
  max_players: 15,
  status: 'PAYMENT_OPEN',
  created_at: '2026-11-11T09:00:00Z',
  updated_at: '2026-11-11T10:00:00Z'
};

const makeSquad = (count: number, verifiedCount: number): PlayerRosterItem[] => {
  const items: PlayerRosterItem[] = [];
  for (let i = 1; i <= count; i++) {
    const isVer = i <= verifiedCount;
    items.push({
      user_id: `u-${i}`,
      username: `Player ${i}`,
      response: 'IN',
      joined_at: `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`,
      slot_number: i,
      is_waitlist: false,
      payment: {
        id: `pay-${i}`,
        game_id: 'game-1',
        user_id: `u-${i}`,
        amount: 80,
        method: 'UPI',
        status: isVer ? 'VERIFIED' : 'AWAITING_VERIFICATION',
        utr: `UTR${i}000000`,
        created_at: '2026-11-11T10:00:00Z',
        updated_at: '2026-11-11T10:00:00Z'
      }
    });
  }
  return items;
};

describe('Phase 5: AdminReconciliationModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary statistics and active squad', () => {
    const squad = makeSquad(10, 8);
    render(
      <AdminReconciliationModal
        game={mockGame}
        activeSquad={squad}
        allPayments={squad.map((p) => p.payment!).filter(Boolean)}
        onVerifyPayment={vi.fn()}
        onRejectPayment={vi.fn()}
        onRevertPayment={vi.fn()}
        onQuickVerifyPlayer={vi.fn()}
        onConfirmRoster={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('10 / 10')).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText('₹640')).toBeInTheDocument(); // 8 * 80
  });

  it('triggers onVerifyPayment when Verify button is clicked', () => {
    const handleVerify = vi.fn().mockResolvedValue(undefined);
    const squad = makeSquad(2, 1); // 1 verified, 1 awaiting
    render(
      <AdminReconciliationModal
        game={mockGame}
        activeSquad={squad}
        allPayments={squad.map((p) => p.payment!).filter(Boolean)}
        onVerifyPayment={handleVerify}
        onRejectPayment={vi.fn()}
        onRevertPayment={vi.fn()}
        onQuickVerifyPlayer={vi.fn()}
        onConfirmRoster={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const verifyBtn = screen.getByRole('button', { name: /Verify Player 2/i });
    fireEvent.click(verifyBtn);

    expect(handleVerify).toHaveBeenCalledWith('pay-2');
  });

  it('disables Confirm Roster button when fewer than required players are verified', () => {
    const squad = makeSquad(10, 9); // 9 of 10 verified
    render(
      <AdminReconciliationModal
        game={mockGame}
        activeSquad={squad}
        allPayments={squad.map((p) => p.payment!).filter(Boolean)}
        onVerifyPayment={vi.fn()}
        onRejectPayment={vi.fn()}
        onRevertPayment={vi.fn()}
        onQuickVerifyPlayer={vi.fn()}
        onConfirmRoster={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Lock Match Roster/i });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText(/All 10 players must be verified/i)).toBeInTheDocument();
  });

  it('enables Confirm Roster button when all 10 players are verified', () => {
    const squad = makeSquad(10, 10); // 10 of 10 verified
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <AdminReconciliationModal
        game={mockGame}
        activeSquad={squad}
        allPayments={squad.map((p) => p.payment!).filter(Boolean)}
        onVerifyPayment={vi.fn()}
        onRejectPayment={vi.fn()}
        onRevertPayment={vi.fn()}
        onQuickVerifyPlayer={vi.fn()}
        onConfirmRoster={handleConfirm}
        onClose={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Lock Match Roster/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalled();
  });

  it('renders pending refunds notice when players in REFUND_PENDING exist', () => {
    const squad = makeSquad(10, 10);
    const refundPayments: GamePayment[] = [
      {
        id: 'refund-1',
        game_id: 'game-1',
        user_id: 'u-dropped',
        amount: 80,
        method: 'UPI',
        status: 'REFUND_PENDING',
        created_at: '2026-11-11T10:00:00Z',
        updated_at: '2026-11-11T10:00:00Z'
      }
    ];

    render(
      <AdminReconciliationModal
        game={mockGame}
        activeSquad={squad}
        allPayments={[...squad.map((p) => p.payment!), ...refundPayments]}
        onVerifyPayment={vi.fn()}
        onRejectPayment={vi.fn()}
        onRevertPayment={vi.fn()}
        onQuickVerifyPlayer={vi.fn()}
        onConfirmRoster={vi.fn()}
        onSettleRefund={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Refunds to Settle \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/The following players paid earlier but switched to OUT/i)).toBeInTheDocument();
  });

  it('shows cash players as due on game day with a Confirm Cash action', () => {
    const squad = makeSquad(10, 9);
    squad[9].payment = { ...squad[9].payment!, method: 'CASH', status: 'PENDING', utr: null };
    render(
      <AdminReconciliationModal
        game={mockGame}
        activeSquad={squad}
        allPayments={squad.map((p) => p.payment!).filter(Boolean)}
        onVerifyPayment={vi.fn()}
        onRejectPayment={vi.fn()}
        onRevertPayment={vi.fn()}
        onQuickVerifyPlayer={vi.fn()}
        onConfirmRoster={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/due on game day/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark Player 10 cash verified/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Lock Match Roster/i })).toBeDisabled();
  });
});
