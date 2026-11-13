import { describe, it, expect } from 'vitest';
import { formatWhatsAppSummary, getWhatsAppShareUrl, formatGameTime, formatDuration } from '../whatsappSummary';
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

const makePlayer = (
  id: string,
  name: string,
  slot: number,
  status: 'VERIFIED' | 'UNREPORTED' | 'PENDING' | 'AWAITING_VERIFICATION' = 'UNREPORTED',
  method: 'UPI' | 'CASH' | 'LATER' = 'UPI'
): PlayerRosterItem => ({
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
    method,
    status,
    created_at: '2026-11-11T10:00:00Z',
    updated_at: '2026-11-11T10:00:00Z'
  }
});

describe('Phase 6: WhatsApp Summary Generator', () => {
  it('under 10 players: lists who is IN and how many more are needed', () => {
    const message = formatWhatsAppSummary({
      game: mockGame,
      activeSquad: [makePlayer('u1', 'Soumil Jana', 1), makePlayer('u2', 'Souvik Roy', 2), makePlayer('u3', 'Spandan Ghosh', 3)],
      waitingList: [],
      appUrl: 'https://app.test/payments'
    });

    expect(message).toBe(
      [
        '*⚽ Football: Sun, 15 Nov · 7:00 PM*',
        '📍 Plaza Turf',
        '💰 ₹80 per player',
        '',
        '*IN SO FAR (3/10)*',
        '1. Soumil Jana',
        '2. Souvik Roy',
        '3. Spandan Ghosh',
        '',
        'Need *7 more* to book the turf.',
        "Tap *I'm IN* to claim your spot 👇",
        'https://app.test/payments'
      ].join('\n')
    );
  });

  it('10+ players: groups the squad by payment and leaves out empty groups', () => {
    const activeSquad = [
      makePlayer('u1', 'Soumil', 1, 'VERIFIED'),
      makePlayer('u2', 'Spandan', 2, 'VERIFIED', 'CASH'),
      makePlayer('u3', 'Ani', 3, 'PENDING', 'CASH'),
      makePlayer('u4', 'Rick', 4, 'AWAITING_VERIFICATION'),
      makePlayer('u5', 'Moti', 5, 'PENDING', 'LATER'),
      makePlayer('u6', 'Tubu', 6),
      ...Array.from({ length: 4 }, (_, i) => makePlayer(`u${i + 7}`, `Player ${i + 7}`, i + 7, 'VERIFIED'))
    ];

    const message = formatWhatsAppSummary({
      game: { ...mockGame, game_date: '2026-11-14', start_time: '07:00', status: 'PAYMENT_OPEN' },
      activeSquad,
      waitingList: [makePlayer('u11', 'Boni', 11)],
      appUrl: 'https://app.test/payments'
    });

    expect(message).toBe(
      [
        '*⚽ Football: Sat, 14 Nov · 7:00 AM*',
        '📍 Plaza Turf',
        '⚽ 5v5 · 1 hr',
        '💰 ₹80 per player',
        '',
        '*SQUAD (10/10)*',
        '',
        '✅ *Paid (6)*',
        '1. Soumil',
        '2. Spandan',
        '7. Player 7',
        '8. Player 8',
        '9. Player 9',
        '10. Player 10',
        '',
        '💵 *Cash, pay at the turf (1)*',
        '3. Ani',
        '',
        '🔎 *UPI sent, admin checking (1)*',
        '4. Rick',
        '',
        '⏳ *Not paid yet (2)*',
        '5. Moti (pay later)',
        '6. Tubu',
        '',
        '*WAITING LIST (1)*',
        '11. Boni',
        '',
        "Can't make it? Tap *I'm OUT* so the next player gets your spot. If you've paid, you'll be refunded.",
        '',
        'Pay or check your status 👇',
        'https://app.test/payments'
      ].join('\n')
    );
  });

  it('15 players: Winner Stays with 90 minutes, and no empty groups when everyone paid', () => {
    const activeSquad = Array.from({ length: 15 }, (_, i) => makePlayer(`u${i + 1}`, `Player ${i + 1}`, i + 1, 'VERIFIED'));

    const message = formatWhatsAppSummary({
      game: { ...mockGame, mode: 'WINNER_STAYS', duration_minutes: 90, status: 'PAYMENT_OPEN' },
      activeSquad,
      waitingList: []
    });

    expect(message).toContain('⚽ 3 Teams Winner Stays · 1 hr 30 min');
    expect(message).toContain('*SQUAD (15/15)*');
    expect(message).toContain('✅ *Paid (15)*');
    expect(message).not.toContain('Not paid yet');
    expect(message).not.toContain('Cash, pay at the turf');
    expect(message).not.toContain('WAITING LIST');
  });

  it('formats times and durations', () => {
    expect(formatGameTime('07:00')).toBe('7:00 AM');
    expect(formatGameTime('12:30')).toBe('12:30 PM');
    expect(formatGameTime('00:15')).toBe('12:15 AM');
    expect(formatGameTime('20:30')).toBe('8:30 PM');
    expect(formatGameTime('TBD')).toBe('TBD');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(90)).toBe('1 hr 30 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('generates a valid WhatsApp URL with encoded message text', () => {
    const url = getWhatsAppShareUrl('*MATCH UPDATE* ⚽');
    expect(url).toBe('https://api.whatsapp.com/send?text=*MATCH%20UPDATE*%20%E2%9A%BD');
  });
});
