import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPlayerRoster,
  registerForGame,
  submitGamePayment,
  adminVerifyPayment,
  adminQuickVerifyPlayer,
  adminConfirmRoster,
  adminSettleRefund
} from '../gamePaymentsApi';
import { supabase } from '../supabase';
import type { GameRegistration, GamePayment } from '../../types/gamePayment';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
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

    it('throws error when RPC encounters failure', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' }
      });

      await expect(registerForGame('game-1', 'IN')).rejects.toThrow('Database constraint violation');
    });
  });
});
