import { describe, it, expect } from 'vitest';

/**
 * RawStat interface as defined and used in Seasons.tsx
 */
interface RawStat {
  player_id: string;
  name: string;
  goals: number;
  assists: number;
  best_defender_awards: number;
  best_gk_awards: number;
  motm_awards: number;
}

/**
 * MOTM award calculation and tiebreaking logic as implemented in Seasons.tsx (line 252):
 * Matches Rulebook Rule 2 (Rules.tsx:34-43):
 * 1. Most MOTM awards
 * 2. Tiebreaker: Most Goals in that specific season
 */
function resolveLiveMOTM(liveStats: RawStat[]): RawStat | null {
  return (
    [...liveStats]
      .filter(s => s.motm_awards > 0)
      .sort((a, b) => b.motm_awards - a.motm_awards || b.goals - a.goals)[0] || null
  );
}

/**
 * Best Defender award calculation and tiebreaking logic as implemented in Seasons.tsx (line 250):
 * Matches Rulebook Rule 3 (Rules.tsx:47-57):
 * 1. Most Best Defender awards
 * 2. First Tiebreaker: Most Goals in that specific season
 * 3. Second Tiebreaker: Most Assists in that specific season
 */
function resolveLiveDefender(liveStats: RawStat[]): RawStat | null {
  return (
    [...liveStats]
      .filter(s => s.best_defender_awards > 0)
      .sort(
        (a, b) =>
          b.best_defender_awards - a.best_defender_awards ||
          b.goals - a.goals ||
          b.assists - a.assists
      )[0] || null
  );
}

/**
 * Winner Stays Draw queue rotation logic as implemented in ActiveMatch.tsx (lines 345-372):
 * Matches Rulebook Rule 1 (Rules.tsx:20-29):
 * - If 2+ teams waiting: BOTH playing teams rotate out to the back of queue; next 2 waiting teams step on pitch.
 * - If 1 team waiting: incumbent (currentPitch[0]) stays on pitch; challenger rotates to back of queue.
 */
function resolveWinnerStaysDraw<T extends { id: string; name: string }>(
  currentPitch: [T, T],
  currentWaiting: T[]
): { nextPitch: [T, T]; nextWaiting: T[] } {
  if (currentWaiting.length >= 2) {
    const team1 = currentPitch[0];
    const team2 = currentPitch[1];
    const nextTeam1 = currentWaiting[0];
    const nextTeam2 = currentWaiting[1];

    return {
      nextPitch: [nextTeam1, nextTeam2],
      nextWaiting: [...currentWaiting.slice(2), team1, team2],
    };
  } else if (currentWaiting.length === 1) {
    const incumbent = currentPitch[0];
    const challenger = currentPitch[1];

    return {
      nextPitch: [incumbent, currentWaiting[0]],
      nextWaiting: [...currentWaiting.slice(1), challenger],
    };
  }

  return {
    nextPitch: currentPitch,
    nextWaiting: currentWaiting,
  };
}

/**
 * In-Match Poll Voting calculation as implemented in ActiveMatch.tsx (lines 990-1005):
 * Tallies votes for a specific award and collects all candidate IDs that match maxVotes (> 0).
 */
interface PollVote {
  candidate_id: string;
  voter_id: string;
  award_type: string;
}

function resolvePollVoting(
  pollVotes: PollVote[],
  awardType: string
): { leadingCandidateIds: string[]; maxVotes: number } {
  const votesForAward = pollVotes.filter(v => v.award_type === awardType);
  const voteCounts: Record<string, number> = {};
  votesForAward.forEach(v => {
    voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] || 0) + 1;
  });

  let leadingCandidateIds: string[] = [];
  let maxVotes = 0;
  Object.entries(voteCounts).forEach(([cId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      leadingCandidateIds = [cId];
    } else if (count === maxVotes && maxVotes > 0) {
      leadingCandidateIds.push(cId);
    }
  });

  return { leadingCandidateIds, maxVotes };
}

describe('Tiebreaker and Edge-Case Rules', () => {
  describe('Rule 2: Man of the Season Tie-Breaker (Rules.tsx & Seasons.tsx)', () => {
    it('Scenario 1: awards MOTM directly to the player with the most MOTM awards', () => {
      const stats: RawStat[] = [
        {
          player_id: 'p1',
          name: 'Player 1',
          motm_awards: 4,
          goals: 10,
          assists: 5,
          best_defender_awards: 0,
          best_gk_awards: 0,
        },
        {
          player_id: 'p2',
          name: 'Player 2',
          motm_awards: 2,
          goals: 25, // more goals, but fewer MOTM awards
          assists: 10,
          best_defender_awards: 0,
          best_gk_awards: 0,
        },
      ];

      const winner = resolveLiveMOTM(stats);
      expect(winner?.player_id).toBe('p1');
      expect(winner?.name).toBe('Player 1');
    });

    it('Scenario 2: breaks MOTM tie using Season Goals', () => {
      const stats: RawStat[] = [
        {
          player_id: 'p1',
          name: 'Player 1',
          motm_awards: 3,
          goals: 10,
          assists: 8,
          best_defender_awards: 0,
          best_gk_awards: 0,
        },
        {
          player_id: 'p2',
          name: 'Player 2',
          motm_awards: 3,
          goals: 15, // tied at 3 MOTMs, wins on 15 goals > 10 goals
          assists: 2,
          best_defender_awards: 0,
          best_gk_awards: 0,
        },
      ];

      const winner = resolveLiveMOTM(stats);
      expect(winner?.player_id).toBe('p2');
      expect(winner?.name).toBe('Player 2');
    });
  });

  describe('Rule 3: Best Defender Tie-Breaker (Rules.tsx & Seasons.tsx)', () => {
    it('Scenario 3: awards Best Defender directly to player with most awards', () => {
      const stats: RawStat[] = [
        {
          player_id: 'd1',
          name: 'Defender 1',
          best_defender_awards: 5,
          goals: 1,
          assists: 1,
          best_gk_awards: 0,
          motm_awards: 0,
        },
        {
          player_id: 'd2',
          name: 'Defender 2',
          best_defender_awards: 3,
          goals: 8,
          assists: 6,
          best_gk_awards: 0,
          motm_awards: 0,
        },
      ];

      const winner = resolveLiveDefender(stats);
      expect(winner?.player_id).toBe('d1');
      expect(winner?.name).toBe('Defender 1');
    });

    it('Scenario 4: breaks Best Defender tie using 1st Tiebreaker (Season Goals)', () => {
      const stats: RawStat[] = [
        {
          player_id: 'd1',
          name: 'Defender 1',
          best_defender_awards: 3,
          goals: 4, // 4 goals > 2 goals
          assists: 1,
          best_gk_awards: 0,
          motm_awards: 0,
        },
        {
          player_id: 'd2',
          name: 'Defender 2',
          best_defender_awards: 3,
          goals: 2,
          assists: 8,
          best_gk_awards: 0,
          motm_awards: 0,
        },
      ];

      const winner = resolveLiveDefender(stats);
      expect(winner?.player_id).toBe('d1');
      expect(winner?.name).toBe('Defender 1');
    });

    it('Scenario 5: breaks Best Defender tie using 2nd Tiebreaker (Season Assists when Goals are tied)', () => {
      const stats: RawStat[] = [
        {
          player_id: 'd1',
          name: 'Defender 1',
          best_defender_awards: 3,
          goals: 2,
          assists: 5, // tied awards (3) and goals (2), wins on 5 assists > 2 assists
          best_gk_awards: 0,
          motm_awards: 0,
        },
        {
          player_id: 'd2',
          name: 'Defender 2',
          best_defender_awards: 3,
          goals: 2,
          assists: 2,
          best_gk_awards: 0,
          motm_awards: 0,
        },
      ];

      const winner = resolveLiveDefender(stats);
      expect(winner?.player_id).toBe('d1');
      expect(winner?.name).toBe('Defender 1');
    });

    it('Scenario 6: returns null fallback when no players have awards (> 0)', () => {
      const stats: RawStat[] = [
        {
          player_id: 'p1',
          name: 'Player 1',
          best_defender_awards: 0,
          best_gk_awards: 0,
          motm_awards: 0,
          goals: 12,
          assists: 6,
        },
        {
          player_id: 'p2',
          name: 'Player 2',
          best_defender_awards: 0,
          best_gk_awards: 0,
          motm_awards: 0,
          goals: 8,
          assists: 4,
        },
      ];

      expect(resolveLiveDefender(stats)).toBeNull();
      expect(resolveLiveMOTM(stats)).toBeNull();
    });
  });

  describe('Rule 1: Winner Stays - Draws (Rules.tsx & ActiveMatch.tsx)', () => {
    const teamA = { id: 'team-a', name: 'Team Alpha (Incumbent)' };
    const teamB = { id: 'team-b', name: 'Team Bravo (Challenger)' };
    const teamC = { id: 'team-c', name: 'Team Charlie' };
    const teamD = { id: 'team-d', name: 'Team Delta' };

    it('Scenario 7: rotates BOTH active teams out to queue back when 2 or more teams are waiting', () => {
      const currentPitch: [{ id: string; name: string }, { id: string; name: string }] = [
        teamA,
        teamB,
      ];
      const currentWaiting = [teamC, teamD];

      const { nextPitch, nextWaiting } = resolveWinnerStaysDraw(currentPitch, currentWaiting);

      // Next 2 waiting teams step on pitch
      expect(nextPitch).toEqual([teamC, teamD]);
      // Both playing teams rotate to back of queue
      expect(nextWaiting).toEqual([teamA, teamB]);
    });

    it('rotates both teams to back of queue when more than 2 teams are waiting', () => {
      const teamE = { id: 'team-e', name: 'Team Echo' };
      const currentPitch: [{ id: string; name: string }, { id: string; name: string }] = [
        teamA,
        teamB,
      ];
      const currentWaiting = [teamC, teamD, teamE];

      const { nextPitch, nextWaiting } = resolveWinnerStaysDraw(currentPitch, currentWaiting);

      expect(nextPitch).toEqual([teamC, teamD]);
      // teamE was in queue, then teamA and teamB are appended
      expect(nextWaiting).toEqual([teamE, teamA, teamB]);
    });

    it('Scenario 8: keeps incumbent on pitch and rotates challenger out when exactly 1 team is waiting', () => {
      const currentPitch: [{ id: string; name: string }, { id: string; name: string }] = [
        teamA, // incumbent
        teamB, // challenger
      ];
      const currentWaiting = [teamC]; // only 1 team waiting

      const { nextPitch, nextWaiting } = resolveWinnerStaysDraw(currentPitch, currentWaiting);

      // Incumbent (teamA) stays on pitch; waiting team (teamC) steps on
      expect(nextPitch).toEqual([teamA, teamC]);
      // Challenger (teamB) rotates out to back of waiting queue
      expect(nextWaiting).toEqual([teamB]);
    });

    it('leaves pitch unchanged if 0 teams are waiting', () => {
      const currentPitch: [{ id: string; name: string }, { id: string; name: string }] = [
        teamA,
        teamB,
      ];
      const currentWaiting: Array<{ id: string; name: string }> = [];

      const { nextPitch, nextWaiting } = resolveWinnerStaysDraw(currentPitch, currentWaiting);
      expect(nextPitch).toEqual([teamA, teamB]);
      expect(nextWaiting).toEqual([]);
    });
  });

  describe('In-Match Poll Voting Ties (ActiveMatch.tsx)', () => {
    it('Scenario 9: includes all tied candidates in leadingCandidateIds when votes are equal', () => {
      const votes: PollVote[] = [
        { candidate_id: 'player-A', voter_id: 'v1', award_type: 'MOTM' },
        { candidate_id: 'player-A', voter_id: 'v2', award_type: 'MOTM' },
        { candidate_id: 'player-B', voter_id: 'v3', award_type: 'MOTM' },
        { candidate_id: 'player-B', voter_id: 'v4', award_type: 'MOTM' },
        { candidate_id: 'player-C', voter_id: 'v5', award_type: 'MOTM' },
        // Other award should not interfere
        { candidate_id: 'player-C', voter_id: 'v6', award_type: 'DEFENDER' },
      ];

      const { leadingCandidateIds, maxVotes } = resolvePollVoting(votes, 'MOTM');

      expect(maxVotes).toBe(2);
      expect(leadingCandidateIds).toHaveLength(2);
      expect(leadingCandidateIds).toContain('player-A');
      expect(leadingCandidateIds).toContain('player-B');
      expect(leadingCandidateIds).not.toContain('player-C');
    });

    it('identifies single clear winner when candidate has outright maximum votes', () => {
      const votes: PollVote[] = [
        { candidate_id: 'player-A', voter_id: 'v1', award_type: 'MOTM' },
        { candidate_id: 'player-A', voter_id: 'v2', award_type: 'MOTM' },
        { candidate_id: 'player-A', voter_id: 'v3', award_type: 'MOTM' },
        { candidate_id: 'player-B', voter_id: 'v4', award_type: 'MOTM' },
      ];

      const { leadingCandidateIds, maxVotes } = resolvePollVoting(votes, 'MOTM');
      expect(maxVotes).toBe(3);
      expect(leadingCandidateIds).toEqual(['player-A']);
    });

    it('returns empty list and 0 maxVotes when no votes exist for award', () => {
      const votes: PollVote[] = [
        { candidate_id: 'player-A', voter_id: 'v1', award_type: 'DEFENDER' },
      ];

      const { leadingCandidateIds, maxVotes } = resolvePollVoting(votes, 'MOTM');
      expect(maxVotes).toBe(0);
      expect(leadingCandidateIds).toEqual([]);
    });
  });
});
