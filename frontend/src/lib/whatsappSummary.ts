/**
 * StatTracker - WhatsApp Match Summary Generator
 * Module: frontend/src/lib/whatsappSummary.ts
 *
 * Dynamically formats game information, ordered player rosters,
 * and payment statuses into WhatsApp-friendly text with 1-click sharing.
 */

import type { Game, PlayerRosterItem } from '../types/gamePayment';

export interface WhatsAppSummaryParams {
  game: Game;
  activeSquad: PlayerRosterItem[];
  waitingList?: PlayerRosterItem[];
  appUrl?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-15" -> "Sun, 15 Nov" (same on every device, unlike toLocaleDateString) */
export function formatGameDate(gameDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(gameDate || '');
  if (!m) return gameDate;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "07:00" -> "7:00 AM"; anything unparseable is returned as-is */
export function formatGameTime(startTime: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(startTime || '');
  if (!m) return startTime;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 90 -> "1 hr 30 min", 60 -> "1 hr", 45 -> "45 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * Format the WhatsApp game message.
 * Under 10 IN: who's in and how many more are needed.
 * 10+ IN: the squad grouped by payment (Paid / Cash at the turf / UPI being
 * checked / Not paid yet), the waiting list, and the dropout note.
 */
export function formatWhatsAppSummary({
  game,
  activeSquad,
  waitingList = [],
  appUrl = 'https://stattracker.local/payments'
}: WhatsAppSummaryParams): string {
  const formattedDate = formatGameDate(game.game_date);
  const header =
    `*⚽ Football: ${formattedDate} · ${formatGameTime(game.start_time)}*\n` +
    `📍 ${game.location}\n`;
  const fee = `💰 ₹${Number(game.amount_per_player).toFixed(0)} per player\n`;

  const activeCount = activeSquad.length;
  const lines: string[] = [];

  // Stage 1: under 10 players
  if (activeCount < 10) {
    const needed = 10 - activeCount;
    lines.push(header + fee);
    lines.push(`*IN SO FAR (${activeCount}/10)*`);
    if (activeCount === 0) {
      lines.push('_No one yet_');
    } else {
      activeSquad.forEach((p, idx) => lines.push(`${idx + 1}. ${p.username}`));
    }
    lines.push('');
    lines.push(`Need *${needed} more* to book the turf.`);
    lines.push(`Tap *I'm IN* to claim your spot 👇`);
    lines.push(appUrl);
    return lines.join('\n');
  }

  // Stage 2: 10+ players
  const is15Mode = activeCount >= 15 || (game.squad_capacity ?? 10) >= 15 || game.mode === 'WINNER_STAYS';
  const capacity = activeCount >= 15 || (game.squad_capacity ?? 10) >= 15 ? 15 : 10;
  const modeText = is15Mode ? '3 Teams Winner Stays' : '5v5';

  lines.push(header + `⚽ ${modeText} · ${formatDuration(game.duration_minutes)}\n` + fee);
  lines.push(`*SQUAD (${activeCount}/${capacity})*`);

  const paid = activeSquad.filter((p) => p.payment?.status === 'VERIFIED');
  const cash = activeSquad.filter((p) => p.payment?.status === 'PENDING' && p.payment.method === 'CASH');
  const reviewing = activeSquad.filter((p) => p.payment?.status === 'AWAITING_VERIFICATION');
  const grouped = new Set([...paid, ...cash, ...reviewing]);
  const notPaid = activeSquad.filter((p) => !grouped.has(p));

  const section = (title: string, players: PlayerRosterItem[], note?: (p: PlayerRosterItem) => string) => {
    if (players.length === 0) return;
    lines.push('');
    lines.push(`${title} (${players.length})*`);
    players.forEach((p) => lines.push(`${p.slot_number}. ${p.username}${note ? note(p) : ''}`));
  };

  section('✅ *Paid', paid);
  section('💵 *Cash, pay at the turf', cash);
  section('🔎 *UPI sent, admin checking', reviewing);
  section('⏳ *Not paid yet', notPaid, (p) =>
    p.payment?.status === 'PENDING' && p.payment.method === 'LATER' ? ' (pay later)' : ''
  );

  if (waitingList.length > 0) {
    lines.push('');
    lines.push(`*WAITING LIST (${waitingList.length})*`);
    waitingList.forEach((p) => lines.push(`${p.slot_number}. ${p.username}`));
  }

  lines.push('');
  lines.push("Can't make it? Tap *I'm OUT* so the next player gets your spot. If you've paid, you'll be refunded.");
  lines.push('');
  lines.push('Pay or check your status 👇');
  lines.push(appUrl);
  return lines.join('\n');
}

/**
 * Generate direct WhatsApp web or mobile share URI
 */
export function getWhatsAppShareUrl(messageText: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
}
