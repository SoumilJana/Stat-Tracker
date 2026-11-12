import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPlayerRoster,
  registerForGame,
  submitGamePayment,
  adminVerifyPayment,
  adminQuickVerifyPlayer,
  adminConfirmRoster,
  adminSettleRefund,
  adminRegisterPlayer,
  adminRegisterPlayers,
  fetchGamePayments,
  nextScheduledDate
} from '../gamePaymentsApi';
import { supabase } from '../supabase';
import type { GameRegistration, GamePayment } from '../../types/gamePayment';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) }
  }
}));

describe('Phase 1: Game Management & Payment API + Roster Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildPlayerRoster (Slot Ordering, Threshold & Auto-Promotion)', () => {
    const makeReg = (id: string, name: string, time: string, response: 'IN' | 'OUT' = 'IN'): GameRegistration => ({
      id: `reg-${id}`,
      game_id: 'game-1',
      user_id: id,
      response,
      joined_at: time,
      profile: {
        id,
        username: name,
        jersey_number: 10,
        position: 'MID',
        photo_url: null
      }
    });

    it('orders players strictly by joined_at ascending and assigns slots 1 to 10', () => {
      const registrations: GameRegistration[] = [
        makeReg('u2', 'Player 2', '2026-11-11T10:05:00Z'),
        makeReg('u1', 'Player 1', '2026-11-11T10:00:00Z'),
        makeReg('u3', 'Player 3', '2026-11-11T10:10:00Z'),
      ];

      const { activeSquad, waitingList } = buildPlayerRoster(registrations, []);
      expect(activeSquad).toHaveLength(3);
      expect(activeSquad[0].user_id).toBe('u1');
      expect(activeSquad[0].slot_number).toBe(1);
      expect(activeSquad[1].user_id).toBe('u2');
      expect(activeSquad[1].slot_number).toBe(2);
      expect(activeSquad[2].user_id).toBe('u3');
      expect(activeSquad[2].slot_number).toBe(3);
      expect(waitingList).toHaveLength(0);
    });

    it('places players 11 to 14 on Waiting List (Standard 5v5 Mode)', () => {
      const registrations: GameRegistration[] = [];
      for (let i = 1; i <= 13; i++) {
        registrations.push(makeReg(`u${i}`, `Player ${i}`, `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`));
      }

      const { activeSquad, waitingList } = buildPlayerRoster(registrations, []);
      expect(activeSquad).toHaveLength(10);
      expect(activeSquad[9].slot_number).toBe(10);
      expect(activeSquad[9].is_waitlist).toBe(false);

      expect(waitingList).toHaveLength(3);
      expect(waitingList[0].user_id).toBe('u11');
      expect(waitingList[0].slot_number).toBe(11);
      expect(waitingList[0].is_waitlist).toBe(true);
      expect(waitingList[2].user_id).toBe('u13');
      expect(waitingList[2].slot_number).toBe(13);
      expect(waitingList[2].is_waitlist).toBe(true);
    });

    it('automatically promotes players 11 to 15 when 15 players join (3 Teams Winner Stays)', () => {
      const registrations: GameRegistration[] = [];
      for (let i = 1; i <= 15; i++) {
        registrations.push(makeReg(`u${i}`, `Player ${i}`, `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`));
      }

      const { activeSquad, waitingList } = buildPlayerRoster(registrations, []);
      // With 15 players, all 15 are in activeSquad!
      expect(activeSquad).toHaveLength(15);
      expect(activeSquad[14].user_id).toBe('u15');
      expect(activeSquad[14].slot_number).toBe(15);
      expect(activeSquad[14].is_waitlist).toBe(false);
      expect(waitingList).toHaveLength(0);
    });

    it('places player 16 on waiting list even after 15-player promotion', () => {
      const registrations: GameRegistration[] = [];
      for (let i = 1; i <= 16; i++) {
        registrations.push(makeReg(`u${i}`, `Player ${i}`, `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`));
      }

      const { activeSquad, waitingList } = buildPlayerRoster(registrations, []);
      expect(activeSquad).toHaveLength(15);
      expect(waitingList).toHaveLength(1);
      expect(waitingList[0].user_id).toBe('u16');
      expect(waitingList[0].slot_number).toBe(16);
      expect(waitingList[0].is_waitlist).toBe(true);
    });

    it('associates payments with correct players in the roster', () => {
      const registrations = [makeReg('u1', 'Soumil', '2026-11-11T10:00:00Z')];
      const payments: GamePayment[] = [
        {
          id: 'pay-1',
          game_id: 'game-1',
          user_id: 'u1',
          amount: 80,
          method: 'UPI',
          status: 'VERIFIED',
          utr: '123456789012',
          created_at: '2026-11-11T10:15:00Z',
          updated_at: '2026-11-11T10:20:00Z'
        }
      ];

      const { activeSquad } = buildPlayerRoster(registrations, payments);
      expect(activeSquad[0].payment).toBeDefined();
      expect(activeSquad[0].payment?.status).toBe('VERIFIED');
      expect(activeSquad[0].payment?.utr).toBe('123456789012');
    });

    const makePay = (userId: string, status: GamePayment['status']): GamePayment => ({
      id: `pay-${userId}`,
      game_id: 'game-1',
      user_id: userId,
      amount: 80,
      method: 'UPI',
      status
    });
    const joinAt = (i: number) => `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`;

    it('keeps verified payers in the squad over earlier unpaid joiners after a dropout (sticky 15)', () => {
      // 15 joined, then u1 marked OUT -> 14 IN. u12 and u13 had paid & been verified.
      const registrations = Array.from({ length: 15 }, (_, i) =>
        makeReg(`u${i + 1}`, `Player ${i + 1}`, joinAt(i), i === 0 ? 'OUT' : 'IN')
      );
      const payments = [makePay('u12', 'VERIFIED'), makePay('u13', 'VERIFIED')];

      const { activeSquad, waitingList } = buildPlayerRoster(registrations, payments, 15);
      // Capacity stays at 15, so all 14 remain in the squad
      expect(activeSquad).toHaveLength(14);
      expect(waitingList).toHaveLength(0);
      expect(activeSquad.slice(0, 2).map((p) => p.user_id)).toEqual(['u12', 'u13']);
    });

    it('waitlists unpaid players before paid ones when capacity is 10', () => {
      const registrations = Array.from({ length: 12 }, (_, i) => makeReg(`u${i + 1}`, `Player ${i + 1}`, joinAt(i)));
      const payments = [makePay('u11', 'VERIFIED'), makePay('u12', 'AWAITING_VERIFICATION'), makePay('u9', 'PENDING')];

      const { activeSquad, waitingList } = buildPlayerRoster(registrations, payments, 10);
      expect(activeSquad).toHaveLength(10);
      expect(activeSquad[0].user_id).toBe('u11');
      expect(activeSquad[1].user_id).toBe('u12');
      // Unpaid / pay-later players keep join order; the last two by join order are waitlisted
      expect(waitingList.map((p) => p.user_id)).toEqual(['u9', 'u10']);
      expect(waitingList[0].slot_number).toBe(11);
    });

    it('defaults to capacity 10 when the game never reached 15', () => {
      const registrations = Array.from({ length: 14 }, (_, i) => makeReg(`u${i + 1}`, `Player ${i + 1}`, joinAt(i)));
      const { activeSquad, waitingList } = buildPlayerRoster(registrations, [], 10);
      expect(activeSquad).toHaveLength(10);
      expect(waitingList).toHaveLength(4);
    });

    it('correctly tracks OUT players in outList', () => {
      const registrations = [
        makeReg('u1', 'Soumil', '2026-11-11T10:00:00Z', 'IN'),
        makeReg('u2', 'Spandan', '2026-11-11T10:05:00Z', 'OUT')
      ];

      const { activeSquad, outList } = buildPlayerRoster(registrations, []);
      expect(activeSquad).toHaveLength(1);
      expect(outList).toHaveLength(1);
      expect(outList[0].user_id).toBe('u2');
      expect(outList[0].response).toBe('OUT');
    });
  });

  describe('RPC Client Methods', () => {
    it('registerForGame calls supabase.rpc with correct payload', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, active_count: 5, game_status: 'REGISTRATION_OPEN' },
        error: null
      });

      const res = await registerForGame('game-123', 'IN');
      expect(supabase.rpc).toHaveBeenCalledWith('register_for_game', {
        p_game_id: 'game-123',
        p_response: 'IN'
      });
      expect(res.active_count).toBe(5);
    });

    it('submitGamePayment calls submit_game_payment RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, payment_id: 'p-1', status: 'AWAITING_VERIFICATION' },
        error: null
      });

      const res = await submitGamePayment('game-123', 'UPI', 'profile-abc', '123456789012');
      expect(supabase.rpc).toHaveBeenCalledWith('submit_game_payment', {
        p_game_id: 'game-123',
        p_method: 'UPI',
        p_recipient_profile_id: 'profile-abc',
        p_utr: '123456789012'
      });
      expect(res.status).toBe('AWAITING_VERIFICATION');
    });

    it('adminVerifyPayment executes admin_verify_payment RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, payment_id: 'p-1', status: 'VERIFIED' },
        error: null
      });

      const res = await adminVerifyPayment('p-1', 'VERIFY');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_verify_payment', {
        p_payment_id: 'p-1',
        p_action: 'VERIFY',
        p_rejection_reason: null
      });
      expect(res.status).toBe('VERIFIED');
    });

    it('adminQuickVerifyPlayer executes admin_quick_verify_player RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, payment_id: 'p-new', status: 'VERIFIED' },
        error: null
      });

      const res = await adminQuickVerifyPlayer('game-1', 'user-target');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_quick_verify_player', {
        p_game_id: 'game-1',
        p_target_user_id: 'user-target'
      });
      expect(res.status).toBe('VERIFIED');
    });

    it('adminConfirmRoster calls admin_confirm_roster RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, status: 'ROSTER_CONFIRMED', verified_players: 10, mode: 'STANDARD' },
        error: null
      });

      const res = await adminConfirmRoster('game-1');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_confirm_roster', {
        p_game_id: 'game-1'
      });
      expect(res.status).toBe('ROSTER_CONFIRMED');
    });

    it('adminSettleRefund calls admin_settle_refund RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, status: 'REFUNDED' },
        error: null
      });

      const res = await adminSettleRefund('p-1');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_settle_refund', {
        p_payment_id: 'p-1'
      });
      expect(res.status).toBe('REFUNDED');
    });

    it('adminRegisterPlayer calls admin_register_player RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, user_id: 'u-1', active_count: 5, game_status: 'REGISTRATION_OPEN', paid: true },
        error: null
      });

      const res = await adminRegisterPlayer('game-1', 'u-1', true, 'CASH');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_register_player', {
        p_game_id: 'game-1',
        p_user_id: 'u-1',
        p_mark_as_paid: true,
        p_payment_method: 'CASH'
      });
      expect(res.success).toBe(true);
    });

    it('adminRegisterPlayers calls admin_register_players RPC for batch enlistment', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, enlisted_count: 3, active_count: 8, game_status: 'REGISTRATION_OPEN', paid: true },
        error: null
      });

      const res = await adminRegisterPlayers('game-1', ['u-1', 'u-2', 'u-3'], true, 'UPI');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_register_players', {
        p_game_id: 'game-1',
        p_user_ids: ['u-1', 'u-2', 'u-3'],
        p_mark_as_paid: true,
        p_payment_method: 'UPI'
      });
      expect(res.enlisted_count).toBe(3);
    });

    it('throws error when RPC encounters failure', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' }
      });

      await expect(registerForGame('game-1', 'IN')).rejects.toThrow('Database constraint violation');
    });
  });
  describe('Push notifications on admin actions', () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));

    it('sends PAYMENT_VERIFIED after verifying a payment, not after rejecting', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: { success: true, status: 'VERIFIED' }, error: null });
      await adminVerifyPayment('p-1', 'VERIFY');
      await adminVerifyPayment('p-2', 'REJECT', 'no money');
      await flush();
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
        body: { notificationType: 'PAYMENT_VERIFIED', paymentId: 'p-1' }
      });
    });

    it('sends PAYMENT_VERIFIED with the payment id returned by quick verify', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: { success: true, payment_id: 'pay-9', status: 'VERIFIED' }, error: null });
      await adminQuickVerifyPlayer('game-1', 'user-1');
      await flush();
      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
        body: { notificationType: 'PAYMENT_VERIFIED', paymentId: 'pay-9' }
      });
    });

    it('sends ROSTER_CONFIRMED after confirming the roster', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: { success: true, status: 'ROSTER_CONFIRMED' }, error: null });
      await adminConfirmRoster('game-1');
      await flush();
      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
        body: { notificationType: 'ROSTER_CONFIRMED', gameId: 'game-1' }
      });
    });

    it('does not send when the RPC fails', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: null, error: { message: 'nope' } });
      await expect(adminConfirmRoster('game-1')).rejects.toThrow('nope');
      await flush();
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });
  });
  describe('fetchGamePayments privacy merge', () => {
    it('keeps full rows the user can see and fills others from status-only RPC', async () => {
      const own = { id: 'pay-own', game_id: 'g1', user_id: 'me', amount: 80, method: 'UPI', status: 'VERIFIED', utr: '111' };
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [own], error: null })
      });
      (supabase.rpc as any).mockResolvedValue({
        data: [
          { user_id: 'me', status: 'VERIFIED', method: 'UPI', amount: 80 },
          { user_id: 'other', status: 'AWAITING_VERIFICATION', method: 'UPI', amount: '80.00' }
        ],
        error: null
      });

      const result = await fetchGamePayments('g1');
      expect(supabase.rpc).toHaveBeenCalledWith('get_game_payment_statuses', { p_game_id: 'g1' });
      expect(result).toHaveLength(2);
      expect(result.find((p) => p.user_id === 'me')?.utr).toBe('111');
      const other = result.find((p) => p.user_id === 'other');
      expect(other?.status).toBe('AWAITING_VERIFICATION');
      expect(other?.amount).toBe(80);
      expect(other?.utr).toBeUndefined();
    });
  });
  describe('nextScheduledDate (weekly Saturday 07:00)', () => {
    const sat7 = { weekday: 6, start_time: '07:00' };
    it('returns the coming Saturday from a weekday', () => {
      expect(nextScheduledDate(sat7, new Date(2026, 10, 12, 16, 0))).toBe('2026-11-14'); // Thu
    });
    it('returns today on Saturday before kick-off', () => {
      expect(nextScheduledDate(sat7, new Date(2026, 10, 14, 6, 30))).toBe('2026-11-14');
    });
    it('rolls to next week on Saturday after kick-off', () => {
      expect(nextScheduledDate(sat7, new Date(2026, 10, 14, 7, 0))).toBe('2026-11-21');
    });
    it('handles Sunday games', () => {
      expect(nextScheduledDate({ weekday: 0, start_time: '18:00' }, new Date(2026, 10, 14, 9, 0))).toBe('2026-11-15');
    });
  });
});
