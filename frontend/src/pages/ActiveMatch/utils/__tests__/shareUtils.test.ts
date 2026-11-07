import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWhatsAppShareText, executeMatchShare } from '../shareUtils';

describe('shareUtils: WhatsApp Text Builder & Share Dispatcher', () => {
  const teamA = { id: 'team-a', name: 'Alpha Hawks' };
  const teamB = { id: 'team-b', name: 'Bravo Wolves' };

  const playersA = [
    { id: 'p1', username: 'Alex' },
    { id: 'p2', username: 'Sam' },
  ];
  const playersB = [
    { id: 'p3', username: 'Vikram' },
    { id: 'p4', username: 'David' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildWhatsAppShareText - Upcoming Match', () => {
    it('builds a clean lineup message with bold tags and match link', () => {
      const text = buildWhatsAppShareText({
        session: {
          id: 'session-123',
          status: 'SCHEDULED',
          date: '2026-11-06T18:00:00Z',
          location: 'Downtown Turf',
          mode: 'STANDARD',
        },
        teamScores: { [teamA.id]: 0, [teamB.id]: 0 },
        onPitch: [teamA, teamB],
        waiting: [],
        teamPlayers: { [teamA.id]: playersA, [teamB.id]: playersB },
        events: [],
        pollVotes: [],
        bibColors: { [teamA.id]: 'Neon Green' },
        matchUrl: 'https://stattracker.app/matches/session-123',
      });

      expect(text).toContain('⚽ *StatTracker Match Lineup*');
      expect(text).toContain('📍 *Location:* Downtown Turf');
      expect(text).toContain('*Alpha Hawks (Neon Green)*');
      expect(text).toContain('Captain: Alex');
      expect(text).toContain('1. Sam');
      expect(text).toContain('*Bravo Wolves*');
      expect(text).toContain('🔗 *Live Match Center:*');
      expect(text).toContain('https://stattracker.app/matches/session-123');
    });

    it('includes 7v7 Special tags and lists players cleanly without (Starter)/(Sub) in SPECIAL_7V7', () => {
      const tenPlayersA = Array.from({ length: 10 }, (_, i) => ({
        id: `a-${i + 1}`,
        username: `Player_${i + 1}`,
      }));

      const text = buildWhatsAppShareText({
        session: {
          id: 'session-7v7',
          status: 'SCHEDULED',
          date: '2026-11-06T18:00:00Z',
          location: 'Arena Pitch 1',
          mode: 'SPECIAL_7V7',
        },
        teamScores: { [teamA.id]: 0 },
        onPitch: [teamA],
        waiting: [],
        teamPlayers: { [teamA.id]: tenPlayersA },
        events: [],
        pollVotes: [],
        bibColors: {},
        matchUrl: 'https://stattracker.app/matches/session-7v7',
      });

      expect(text).toContain('🎯 *Mode:* 7v7 Special');
      expect(text).toContain('1. Player_1');
      expect(text).toContain('7. Player_7');
      expect(text).toContain('8. Player_8');
      expect(text).not.toContain('(Starter)');
      expect(text).not.toContain('(Sub)');
    });
  });

  describe('buildWhatsAppShareText - Completed Match', () => {
    it('builds post-match tally, winner, individual stats, highlights, and link', () => {
      const events = [
        { id: 'e1', event_type: 'GOAL', player_id: 'p1', assisted_by: 'p2', team_id: teamA.id },
        { id: 'e2', event_type: 'GOAL', player_id: 'p1', assisted_by: null, team_id: teamA.id },
        { id: 'e3', event_type: 'GOAL', player_id: 'p3', assisted_by: null, team_id: teamB.id },
      ];

      const pollVotes = [
        { id: 'v1', award_type: 'BEST_GK', candidate_id: 'p4' },
        { id: 'v2', award_type: 'MOTM', candidate_id: 'p1' },
      ];

      const text = buildWhatsAppShareText({
        session: {
          id: 'session-completed',
          status: 'COMPLETED',
          date: '2026-11-06T18:00:00Z',
          location: 'Stadium Court',
          mode: 'STANDARD',
        },
        teamScores: { [teamA.id]: 2, [teamB.id]: 1 },
        onPitch: [teamA, teamB],
        waiting: [],
        teamPlayers: { [teamA.id]: playersA, [teamB.id]: playersB },
        events,
        pollVotes,
        bibColors: { [teamA.id]: 'Orange' },
        matchUrl: 'https://stattracker.app/matches/session-completed',
      });

      expect(text).toContain('⚽ *StatTracker Match Day Stats*');
      expect(text).toContain('🏆 *FINAL TALLY*');
      expect(text).toContain('*Alpha Hawks:* 2');
      expect(text).toContain('*Bravo Wolves:* 1');
      expect(text).toContain('👑 *WINNER:* Alpha Hawks');
      expect(text).toContain('- Alex: 2 G');
      expect(text).toContain('- Sam: 1 A');
      expect(text).toContain('🔥 *Top Scorer:* Alex (2G)');
      expect(text).toContain('👟 *Top Assister:* Sam (1A)');
      expect(text).toContain('⭐ *Man of the Match:* Alex');
      expect(text).toContain('🧤 *Best GK:* David');
      expect(text).toContain('🔗 *Full Match Scorecard:*');
      expect(text).toContain('https://stattracker.app/matches/session-completed');
    });
  });

  describe('executeMatchShare', () => {
    it('calls navigator.share when available and returns action: "shared"', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share: shareMock });

      const result = await executeMatchShare('Match Text', 'StatTracker Match');
      expect(shareMock).toHaveBeenCalledWith({
        title: 'StatTracker Match',
        text: 'Match Text',
      });
      expect(result).toEqual({ action: 'shared', success: true });
    });

    it('returns cancelled when user aborts navigator.share', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      const shareMock = vi.fn().mockRejectedValue(abortError);
      Object.assign(navigator, { share: shareMock });

      const result = await executeMatchShare('Match Text');
      expect(result).toEqual({ action: 'cancelled', success: false });
    });

    it('falls back to navigator.clipboard.writeText when navigator.share is unavailable', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share: undefined, clipboard: { writeText: writeTextMock } });

      const result = await executeMatchShare('Match Text');
      expect(writeTextMock).toHaveBeenCalledWith('Match Text');
      expect(result).toEqual({ action: 'copied', success: true });
    });
  });
});
