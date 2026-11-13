import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegistrationDock } from '../RegistrationDock';
import { AdminReconciliationModal } from '../AdminReconciliationModal';
import { PaymentSection } from '../PaymentSection';
import { registerForGame, adminRemovePlayer, gameKickoff } from '../../../../lib/gamePaymentsApi';
import { supabase } from '../../../../lib/supabase';
import type { Game, PlayerRosterItem } from '../../../../types/gamePayment';

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) }
  }
}));

const game: Game = {
  id: 'game-1',
  game_date: '2026-11-15',
  start_time: '07:00',
  location: 'Turf',
  amount_per_player: 80,
  total_turf_cost: 800,
  duration_minutes: 60,
  mode: 'STANDARD',
  min_players: 10,
  max_players: 15,
  status: 'ROSTER_CONFIRMED'
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Late dropouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('after the lock, only I\'m OUT can be tapped', () => {
    const onSelect = vi.fn();
    render(
      <RegistrationDock
        currentResponse="IN"
        onSelectResponse={onSelect}
        inDisabled
        disabledReason="Roster is locked. You can still drop out until kickoff."
      />
    );

    expect(screen.getByRole('button', { name: /I'm IN/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /I'm OUT/i }));
    expect(onSelect).toHaveBeenCalledWith('OUT');
    expect(screen.getByText(/You can still drop out until kickoff/i)).toBeInTheDocument();
  });

  it('after kickoff, I\'m OUT is blocked', () => {
    render(<RegistrationDock currentResponse="IN" onSelectResponse={vi.fn()} outDisabled disabledReason="The game has started." />);
    expect(screen.getByRole('button', { name: /I'm OUT/i })).toBeDisabled();
  });

  it('a player who dropped out after paying sees their refund is pending', () => {
    render(
      <PaymentSection
        game={game}
        userPayment={{ id: 'p', game_id: 'game-1', user_id: 'u', amount: 80, method: 'UPI', status: 'REFUND_PENDING' }}
        paymentProfiles={[]}
        isUserInSquad={false}
        isUserWaitlisted={false}
        isPaymentUnlocked={true}
        onSubmitPayment={vi.fn()}
      />
    );
    expect(screen.getByText('Refund pending')).toBeInTheDocument();
    expect(screen.getByText(/admin will return your ₹80/i)).toBeInTheDocument();
  });

  it('admin can remove a squad player from the Admin Center', () => {
    const onRemove = vi.fn();
    const squad: PlayerRosterItem[] = [
      { user_id: 'u1', username: 'Amit', response: 'IN', joined_at: '2026-11-11T10:00:00Z', slot_number: 1, is_waitlist: false, payment: null }
    ];
    render(
      <AdminReconciliationModal
        game={game}
        activeSquad={squad}
        allPayments={[]}
        onVerifyPayment={vi.fn()}
        onRejectPayment={vi.fn()}
        onRevertPayment={vi.fn()}
        onQuickVerifyPlayer={vi.fn()}
        onConfirmRoster={vi.fn()}
        onClose={vi.fn()}
        onRemovePlayer={onRemove}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Remove Amit/i }));
    expect(onRemove).toHaveBeenCalledWith('u1', 'Amit');
  });

  it('tapping OUT from the squad sends the PLAYER_DROPPED push', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: { success: true, dropped_out: true, promoted_user_ids: ['u11'] },
      error: null
    });
    await registerForGame('game-1', 'OUT', 'u1');
    await flush();

    expect(supabase.rpc).toHaveBeenCalledWith('register_for_game', { p_game_id: 'game-1', p_response: 'OUT' });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
      body: { notificationType: 'PLAYER_DROPPED', gameId: 'game-1', droppedUserId: 'u1', promotedUserIds: ['u11'] }
    });
  });

  it('tapping OUT when not in the game sends no push', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: { success: true, dropped_out: false, promoted_user_ids: [] }, error: null });
    await registerForGame('game-1', 'OUT', 'u1');
    await flush();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('admin remove calls the RPC and sends the push', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: { success: true, promoted_user_ids: [] }, error: null });
    await adminRemovePlayer('game-1', 'u2');
    await flush();

    expect(supabase.rpc).toHaveBeenCalledWith('admin_remove_player', { p_game_id: 'game-1', p_user_id: 'u2' });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
      body: { notificationType: 'PLAYER_DROPPED', gameId: 'game-1', droppedUserId: 'u2', promotedUserIds: [] }
    });
  });

  it('works out kickoff from the game date and start time', () => {
    expect(gameKickoff({ game_date: '2026-11-15', start_time: '07:30' })).toEqual(new Date(2026, 10, 15, 7, 30));
    expect(gameKickoff({ game_date: '2026-11-15', start_time: 'TBD' })).toBeNull();
  });
});
