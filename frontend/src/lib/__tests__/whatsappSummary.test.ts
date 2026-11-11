import { describe, it, expect } from 'vitest';
import { formatWhatsAppSummary, getWhatsAppShareUrl } from '../whatsappSummary';
import type { Game, PlayerRosterItem } from '../../types/gamePayment';

const mockGame: Game = {
  id: 'game-1',
  game_date: '2026-11-15',
  start_time: '19:00',
  location: 'Plaza Turf',
  amount_per_player: 80,
  total_turf_cost: 800,
  duration_minutes: 60,
  mode: 'STANDARD',
  min_players: 10,
  max_players: 15,
  status: 'REGISTRATION_OPEN',
  created_at: '2026-11-11T10:00:00Z',
  updated_at: '2026-11-11T10:00:00Z'
};

const makePlayer = (id: string, name: string, slot: number, status: 'VERIFIED' | 'UNREPORTED' = 'UNREPORTED'): PlayerRosterItem => ({
  user_id: id,
  username: name,
  response: 'IN',
  joined_at: '2026-11-11T10:00:00Z',
  slot_number: slot,
  is_waitlist: slot > 10,
  payment: {
    id: `pay-${id}`,
    game_id: 'game-1',
    user_id: id,
    amount: 80,
    method: 'UPI',
    status,
    created_at: '2026-11-11T10:00:00Z',
    updated_at: '2026-11-11T10:00:00Z'
  }
});

describe('Phase 6: WhatsApp Summary Generator', () => {
  it('formats pre-threshold announcement message when fewer than 10 players have joined', () => {
    const activeSquad = [
      makePlayer('u1', 'Soumil Jana', 1),
      makePlayer('u2', 'Souvik Roy', 2),
      makePlayer('u3', 'Spandan Ghosh', 3),
    ];

    const message = formatWhatsAppSummary({
      game: mockGame,
      activeSquad,
      waitingList: []
    });

    expect(message).toContain('*⚽ MATCH ANNOUNCEMENT*');
    expect(message).toContain('Plaza Turf');
    expect(message).toContain('₹80 per player');
    expect(message).toContain('*PLAYERS JOINED (3/10)*');
    expect(message).toContain('1. Soumil Jana');
    expect(message).toContain('2. Souvik Roy');
    expect(message).toContain('3. Spandan Ghosh');
    expect(message).toContain('*Slots Remaining: 7 players needed to confirm turf!*');
    expect(message).toContain('React IN on StatTracker to claim your slot:');
  });

  it('formats post-threshold message with separate PAID and DUE sections', () => {
    const activeSquad = [
      makePlayer('u1', 'Soumil Jana', 1, 'VERIFIED'),
      makePlayer('u2', 'Souvik Roy', 2, 'VERIFIED'),
      makePlayer('u3', 'Asmit Das', 3, 'UNREPORTED'),
      makePlayer('u4', 'Spandan Ghosh', 4, 'VERIFIED'),
      makePlayer('u5', 'Shibam Mondal', 5, 'UNREPORTED'),
      makePlayer('u6', 'Player 6', 6, 'UNREPORTED'),
      makePlayer('u7', 'Player 7', 7, 'UNREPORTED'),
      makePlayer('u8', 'Player 8', 8, 'UNREPORTED'),
      makePlayer('u9', 'Player 9', 9, 'UNREPORTED'),
      makePlayer('u10', 'Player 10', 10, 'UNREPORTED'),
    ];

    const message = formatWhatsAppSummary({
      game: { ...mockGame, status: 'PAYMENT_OPEN' },
      activeSquad,
      waitingList: []
    });

    expect(message).toContain('*⚽ GAME UPDATE*');
    expect(message).toContain('Standard 5v5 (1 Hour)');
    expect(message).toContain('*PAID (3)*');
    expect(message).toContain('1. Soumil Jana ✅');
    expect(message).toContain('2. Souvik Roy ✅');
    expect(message).toContain('4. Spandan Ghosh ✅');

    expect(message).toContain('*DUE (7)*');
    expect(message).toContain('3. Asmit Das ⏳');
    expect(message).toContain('5. Shibam Mondal ⏳');
    expect(message).toContain('*Total Active: 10/10*');
  });

  it('formats 15-player Winner Stays summary with 90 min duration', () => {
    const activeSquad = Array.from({ length: 15 }, (_, i) =>
      makePlayer(`u${i + 1}`, `Player ${i + 1}`, i + 1, i < 12 ? 'VERIFIED' : 'UNREPORTED')
    );

    const message = formatWhatsAppSummary({
      game: { ...mockGame, mode: 'WINNER_STAYS', duration_minutes: 90, status: 'PAYMENT_OPEN' },
      activeSquad,
      waitingList: []
    });

    expect(message).toContain('3 Teams Winner Stays (1 hr 30 min)');
    expect(message).toContain('*PAID (12)*');
    expect(message).toContain('*DUE (3)*');
    expect(message).toContain('*Total Active: 15/15*');
  });

  it('generates a valid WhatsApp URL with encoded message text', () => {
    const url = getWhatsAppShareUrl('*MATCH UPDATE* ⚽');
    expect(url).toBe('https://api.whatsapp.com/send?text=*MATCH%20UPDATE*%20%E2%9A%BD');
  });
});
