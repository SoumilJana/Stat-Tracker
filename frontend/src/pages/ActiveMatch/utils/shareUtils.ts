/**
 * StatTracker - WhatsApp & Text Sharing Utility
 * Module: frontend/src/pages/ActiveMatch/utils/shareUtils.ts
 *
 * Formats match stats, lineups, and scorecards for WhatsApp / native text sharing
 * with WhatsApp markdown (*bold*), emojis, and deep links.
 */

export interface BuildShareTextParams {
  session: any;
  teamScores: Record<string, number>;
  onPitch: any[];
  waiting: any[];
  teamPlayers: Record<string, any[]>;
  events: any[];
  pollVotes: any[];
  bibColors: Record<string, string>;
  matchUrl?: string;
}

/**
 * Builds a WhatsApp-optimized text summary of the match.
 * Formatted with asterisks for WhatsApp bolding, emojis, clean indentation,
 * and direct URL link to the match scorecard.
 */
export function buildWhatsAppShareText({
  session,
  teamScores,
  onPitch,
  waiting,
  teamPlayers,
  events,
  pollVotes,
  bibColors,
  matchUrl,
}: BuildShareTextParams): string {
  if (!session) return '';

  const url = matchUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const sessionDate = new Date(session.date);
  const dateStr = sessionDate.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = sessionDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 1. UPCOMING OR IN-PROGRESS MATCH (Lineups & Invite)
  if (session.status !== 'COMPLETED') {
    let text = `⚽ *StatTracker Match Lineup*\n`;
    text += `📅 *Date:* ${dateStr} • ${timeStr}\n`;
    if (session.location) text += `📍 *Location:* ${session.location}\n`;
    if (session.mode === 'SPECIAL_7V7') text += `🎯 *Mode:* 7v7 Special\n`;

    text += `\n👥 *TEAMS*\n`;

    const allTeams = [...Object.values(onPitch), ...waiting];
    allTeams
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(team => {
        const players = teamPlayers[team.id];
        if (!players || players.length === 0) return;

        const bibColor = bibColors[team.id] ? ` (${bibColors[team.id]})` : '';
        text += `\n*${team.name}${bibColor}*\n`;

        if (session.mode === 'SPECIAL_7V7') {
          players.forEach((p, index) => {
            text += `${index + 1}. ${p.username} ${index < 7 ? '(Starter)' : '(Sub)'}\n`;
          });
        } else {
          text += `Captain: ${players[0].username}\n`;
          if (players.length > 1) {
            players.slice(1).forEach((p, index) => {
              text += `${index + 1}. ${p.username}\n`;
            });
          }
        }
      });

    if (url) {
      text += `\n🔗 *Live Match Center:*\n${url}`;
    }

    return text;
  }

  // 2. COMPLETED MATCH (Full Post-Match Stats & Recap)
  let text = `⚽ *StatTracker Match Day Stats*\n`;
  text += `📅 *Date:* ${dateStr}\n`;
  if (session.location) text += `📍 *Location:* ${session.location}\n`;
  if (session.mode === 'SPECIAL_7V7') text += `🎯 *Mode:* 7v7 Special\n`;

  text += `\n🏆 *FINAL TALLY*\n`;

  let matchWinner: any = null;
  let maxScore = -1;
  Object.entries(teamScores).forEach(([tId, score]) => {
    if (score > maxScore) {
      maxScore = score;
      matchWinner = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
    }
  });

  Object.entries(teamScores).forEach(([tId, score]) => {
    const t = Object.values(onPitch).concat(waiting).find(item => item.id === tId);
    if (t) {
      text += `*${t.name.replace('Team ', '')}:* ${score}\n`;
    }
  });

  if (matchWinner) {
    text += `\n👑 *WINNER:* ${matchWinner.name}\n`;
  }

  text += `\n📊 *PLAYER STATS*\n`;
  const teams = Object.keys(teamPlayers)
    .map(tId => Object.values(onPitch).concat(waiting).find(t => t.id === tId))
    .filter(Boolean);

  teams.sort((a, b) => {
    if (matchWinner && a?.id === matchWinner.id) return -1;
    if (matchWinner && b?.id === matchWinner.id) return 1;
    return 0;
  });

  teams.forEach(team => {
    if (!team) return;
    const players = teamPlayers[team.id];
    if (!players) return;

    const isWinner = matchWinner && team.id === matchWinner.id;
    let hasStats = false;
    const bibColor = bibColors[team.id] ? ` (${bibColors[team.id]})` : '';
    let teamText = isWinner ? `\n🏆 *${team.name}${bibColor} (Winner)*\n` : `\n*${team.name}${bibColor}:*\n`;

    players.forEach((player, pIdx) => {
      const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
      const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;

      if (pGoals > 0 || pAssists > 0 || isWinner) {
        hasStats = true;
        const roleTag = session?.mode === 'SPECIAL_7V7' ? (pIdx < 7 ? ' (Starter)' : ' (Sub)') : '';
        teamText += `- ${player.username}${roleTag}`;
        const stats = [];
        if (pGoals > 0) stats.push(`${pGoals} G`);
        if (pAssists > 0) stats.push(`${pAssists} A`);
        if (stats.length > 0) {
          teamText += `: ${stats.join(', ')}`;
        }
        teamText += '\n';
      }
    });

    if (hasStats) {
      text += teamText;
    }
  });

  let topScorerName = 'N/A';
  let topScorerGoals = 0;
  let topScorerAssists = 0;

  let topAssisterName = 'N/A';
  let topAssisterAssists = 0;
  let topAssisterGoals = 0;

  Object.values(teamPlayers)
    .flat()
    .forEach(player => {
      const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
      const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;

      if (pGoals > topScorerGoals || (pGoals === topScorerGoals && pGoals > 0 && pAssists > topScorerAssists)) {
        topScorerGoals = pGoals;
        topScorerAssists = pAssists;
        topScorerName = player.username;
      }

      if (pAssists > topAssisterAssists || (pAssists === topAssisterAssists && pAssists > 0 && pGoals > topAssisterGoals)) {
        topAssisterAssists = pAssists;
        topAssisterGoals = pGoals;
        topAssisterName = player.username;
      }
    });

  const getAwardWinner = (awardType: string) => {
    const votes = pollVotes.filter(v => v.award_type === awardType);
    const counts: Record<string, number> = {};
    votes.forEach(v => (counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1));
    let maxId: string | null = null;
    let maxVotes = 0;
    Object.entries(counts).forEach(([id, c]) => {
      if (c > maxVotes) {
        maxVotes = c;
        maxId = id;
      }
    });
    if (!maxId) return null;
    return Object.values(teamPlayers).flat().find(p => p.id === maxId)?.username;
  };

  const bestGk = getAwardWinner('BEST_GK');
  const bestDef = getAwardWinner('BEST_DEFENDER');

  const hasHighlights = topScorerGoals > 0 || topAssisterAssists > 0 || bestGk || bestDef;
  if (hasHighlights) {
    text += `\n🌟 *HIGHLIGHTS*\n`;
    if (topScorerGoals > 0) text += `🔥 *Top Scorer:* ${topScorerName} (${topScorerGoals}G)\n`;
    if (topAssisterAssists > 0) text += `👟 *Top Assister:* ${topAssisterName} (${topAssisterAssists}A)\n`;
    if (bestGk) text += `🧤 *Best GK:* ${bestGk}\n`;
    if (bestDef) text += `🛡️ *Best Defender:* ${bestDef}\n`;
  }

  if (url) {
    text += `\n🔗 *Full Match Scorecard:*\n${url}`;
  }

  return text;
}

export interface ShareExecutionResult {
  action: 'shared' | 'copied' | 'cancelled';
  success: boolean;
}

/**
 * Executes native sharing or falls back to clipboard.
 */
export async function executeMatchShare(
  shareText: string,
  title?: string
): Promise<ShareExecutionResult> {
  // 1. Try Native Web Share API (Primary for mobile devices)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: title || 'StatTracker Match',
        text: shareText,
      });
      return { action: 'shared', success: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled the native share picker
        return { action: 'cancelled', success: false };
      }
      // If error, fall through to clipboard
    }
  }

  // 2. Clipboard fallback (Primary for desktop)
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareText);
      return { action: 'copied', success: true };
    } catch (err) {
      console.warn('[shareUtils] Clipboard write failed:', err);
      return { action: 'copied', success: false };
    }
  }

  return { action: 'copied', success: false };
}
