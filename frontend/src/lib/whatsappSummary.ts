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

/**
 * Format dynamic WhatsApp game announcement & payment status summary
 */
export function formatWhatsAppSummary({
  game,
  activeSquad,
  waitingList = [],
  appUrl = 'https://stattracker.local/payments'
}: WhatsAppSummaryParams): string {
  const formattedDate = new Date(game.game_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const activeCount = activeSquad.length;
  const is15Mode = activeCount >= 15 || game.mode === 'WINNER_STAYS';
  const modeTitle = is15Mode ? '3 Teams Winner Stays (1 hr 30 min)' : 'Standard 5v5 (1 Hour)';

  // Stage 1: Pre-Threshold (Under 10 players)
  if (activeCount < 10) {
    const slotsNeeded = 10 - activeCount;
    let text = `*⚽ MATCH ANNOUNCEMENT*\n\n`;
    text += `📅 Date: ${formattedDate}\n`;
    text += `⏰ Time: ${game.start_time}\n`;
    text += `📍 Location: ${game.location}\n`;
    text += `💰 Fee: ₹${game.amount_per_player.toFixed(0)} per player\n\n`;

    text += `*PLAYERS JOINED (${activeCount}/10)*\n`;
    if (activeSquad.length === 0) {
      text += `_No players registered yet_\n`;
    } else {
      activeSquad.forEach((p, idx) => {
        text += `${idx + 1}. ${p.username}\n`;
      });
    }

    text += `\n*Slots Remaining: ${slotsNeeded} player${slotsNeeded > 1 ? 's' : ''} needed to confirm turf!*\n`;
    text += `React IN on StatTracker to claim your slot:\n🔗 ${appUrl}`;

    return text;
  }

  // Stage 2: Threshold Met (10+ Players: 5v5 or 15-player Winner Stays)
  const paidPlayers = activeSquad.filter((p) => p.payment?.status === 'VERIFIED');
  const duePlayers = activeSquad.filter((p) => p.payment?.status !== 'VERIFIED');

  let text = `*⚽ GAME UPDATE*\n\n`;
  text += `📅 Date: ${formattedDate}\n`;
  text += `⏰ Time: ${game.start_time} (${game.duration_minutes} min)\n`;
  text += `📍 Location: ${game.location}\n`;
  text += `⚽ Mode: ${modeTitle}\n`;
  text += `💰 Amount: ₹${game.amount_per_player.toFixed(0)} per player\n\n`;

  // Section 1: PAID PLAYERS
  text += `*PAID (${paidPlayers.length})*\n`;
  if (paidPlayers.length === 0) {
    text += `_None verified yet_\n`;
  } else {
    paidPlayers.forEach((p) => {
      text += `${p.slot_number}. ${p.username} ✅\n`;
    });
  }

  text += `\n`;

  // Section 2: DUE PLAYERS
  text += `*DUE (${duePlayers.length})*\n`;
  if (duePlayers.length === 0) {
    text += `_All squad payments cleared! 🎉_\n`;
  } else {
    duePlayers.forEach((p) => {
      text += `${p.slot_number}. ${p.username} ⏳\n`;
    });
  }

  text += `\n*Total Active: ${activeCount}/${activeCount}*\n`;

  // Optional: Waiting List Section (if any remain on waitlist)
  if (waitingList.length > 0) {
    text += `\n*WAITING LIST (${waitingList.length})*\n`;
    waitingList.forEach((p) => {
      text += `${p.slot_number}. ${p.username} (Waitlist #${p.slot_number - activeCount})\n`;
    });
  }

  text += `\nPayment Status:\n✅ Verified\n⏳ Pending / Unverified\n\n🔗 ${appUrl}`;

  return text;
}

/**
 * Generate direct WhatsApp web or mobile share URI
 */
export function getWhatsAppShareUrl(messageText: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
}
