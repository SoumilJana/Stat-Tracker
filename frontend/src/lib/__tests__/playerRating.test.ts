import { describe, it, expect } from 'vitest';
import {
  calculatePlayerRating,
  enrichPlayersWithRatings,
  formatRating,
  BASE_OVR,
  MAX_OVR,
  POSITIONS_CONFIG,
  type PlayerStats,
} from '../playerRating';

describe('playerRating logic', () => {
  describe('calculatePlayerRating', () => {
    it('Scenario 1: returns baseline rating (70) for 0 matches played', () => {
      const player: PlayerStats = {
        username: 'Newbie',
        games_played: 0,
        total_goals: 0,
        total_assists: 0,
      };

      const result = calculatePlayerRating(player);
      expect(result.rating).toBe(BASE_OVR);
      expect(result.rating).toBe(70);
    });

    it('Scenario 2: returns baseline rating (70) defensively for negative matches played', () => {
      const player: PlayerStats = {
        username: 'CorruptCounter',
        games_played: -2,
        total_goals: 5,
        total_assists: 2,
      };

      const result = calculatePlayerRating(player);
      expect(result.rating).toBe(BASE_OVR);
      expect(result.rating).toBe(70);
    });

    it('Scenario 3: clamps rating to ceiling (99) for maximum performance', () => {
      const superstar: PlayerStats = {
        username: 'Superstar',
        position: 'FWD',
        games_played: 15,
        total_goals: 100, // gpg ~ 6.67 >> benchmark 4.0
        total_assists: 30, // apg = 2.0 >> benchmark 1.0
        total_mini_matches: 20,
        total_goals_conceded: 0, // GAA = 0 -> score 1.0
        motm_awards: 10,
        best_defender_awards: 5,
        best_gk_awards: 0,
      };

      const result = calculatePlayerRating(superstar);
      expect(result.rating).toBe(MAX_OVR);
      expect(result.rating).toBe(99);
    });

    it('Scenario 4: clamps rating at floor (>= 70) for zero-stat active player', () => {
      const strugglingPlayer: PlayerStats = {
        username: 'Struggling',
        position: 'FWD',
        games_played: 1,
        total_goals: 0,
        total_assists: 0,
        total_mini_matches: 5,
        total_goals_conceded: 50, // very high GAA
        best_defender_awards: 0,
        best_gk_awards: 0,
        motm_awards: 0,
      };

      const result = calculatePlayerRating(strugglingPlayer);
      expect(result.rating).toBeGreaterThanOrEqual(BASE_OVR);
      expect(result.rating).toBeLessThanOrEqual(MAX_OVR);
      expect(Number.isInteger(result.rating)).toBe(true);
    });

    it('Scenario 5: applies FWD positional weights favoring goals over defensive contributions', () => {
      const fwdStats: PlayerStats = {
        username: 'Striker',
        position: 'FWD',
        games_played: 5,
        total_goals: 20, // 4.0 gpg (100% of benchmark)
        total_assists: 2,
        total_mini_matches: 5,
        total_goals_conceded: 10,
        motm_awards: 0,
        best_defender_awards: 0,
        best_gk_awards: 0,
      };

      const defWithSameStats: PlayerStats = {
        ...fwdStats,
        username: 'DefWithGoals',
        position: 'DEF',
      };

      const fwdRating = calculatePlayerRating(fwdStats).rating;
      const defRating = calculatePlayerRating(defWithSameStats).rating;

      // FWD has 40% weight on goals vs DEF 15% weight, so FWD rating should be higher
      expect(fwdRating).toBeGreaterThan(defRating);
      expect(POSITIONS_CONFIG.FWD.weights.GOAL).toBe(0.40);
      expect(POSITIONS_CONFIG.DEF.weights.GOAL).toBe(0.15);
    });

    it('Scenario 6: applies DEF and GK positional weights favoring defensive resilience (GAA and Awards)', () => {
      const defensiveWall: PlayerStats = {
        username: 'Wall',
        position: 'DEF',
        games_played: 6,
        total_goals: 1,
        total_assists: 1,
        total_mini_matches: 10,
        total_goals_conceded: 2, // low GAA = 0.2
        best_defender_awards: 4, // high awards
        best_gk_awards: 0,
        motm_awards: 1,
      };

      const fwdWithDefensiveStats: PlayerStats = {
        ...defensiveWall,
        position: 'FWD',
      };

      const defRating = calculatePlayerRating(defensiveWall).rating;
      const fwdRating = calculatePlayerRating(fwdWithDefensiveStats).rating;

      // DEF has 40% GAA + 20% Award weight (60% total) vs FWD (20% GAA + 15% Award = 35%)
      expect(defRating).toBeGreaterThan(fwdRating);
    });

    it('Scenario 7: handles missing, null, or undefined attributes safely without NaN', () => {
      const incompletePlayer = {
        username: 'Incomplete',
        games_played: 3,
        total_goals: undefined,
        total_assists: undefined,
        total_mini_matches: undefined,
        total_goals_conceded: undefined,
        best_defender_awards: undefined,
        best_gk_awards: undefined,
        motm_awards: undefined,
        position: undefined,
      } as unknown as PlayerStats;

      const result = calculatePlayerRating(incompletePlayer);
      expect(Number.isNaN(result.rating)).toBe(false);
      expect(result.rating).toBeGreaterThanOrEqual(BASE_OVR);
      expect(result.rating).toBeLessThanOrEqual(MAX_OVR);
    });

    it('Scenario 8: defaults to FWD configuration when position is undefined or omitted', () => {
      const statsWithoutPos: PlayerStats = {
        username: 'NoPos',
        games_played: 4,
        total_goals: 8,
        total_assists: 2,
        total_mini_matches: 4,
        total_goals_conceded: 3,
      };

      const statsWithFwd: PlayerStats = {
        ...statsWithoutPos,
        position: 'FWD',
      };

      const ratingDefault = calculatePlayerRating(statsWithoutPos).rating;
      const ratingFwd = calculatePlayerRating(statsWithFwd).rating;

      expect(ratingDefault).toBe(ratingFwd);
    });
  });

  describe('enrichPlayersWithRatings & Leaderboard Sorting', () => {
    it('Scenario 9: sorts players using multi-tier tiebreaking rule (Goals -> Assists -> Games -> Awards -> Alphabetical)', () => {
      const players: PlayerStats[] = [
        {
          id: 'p5',
          username: 'Bravo',
          games_played: 5,
          total_goals: 10,
          total_assists: 4,
          best_defender_awards: 1,
          best_gk_awards: 0,
          motm_awards: 1,
        },
        {
          id: 'p4',
          username: 'Alpha',
          games_played: 5,
          total_goals: 10,
          total_assists: 4,
          best_defender_awards: 1,
          best_gk_awards: 0,
          motm_awards: 1,
        },
        {
          id: 'p3',
          username: 'Charlie',
          games_played: 5,
          total_goals: 10,
          total_assists: 4,
          best_defender_awards: 2, // 3 total awards vs 2 for Alpha/Bravo
          best_gk_awards: 0,
          motm_awards: 1,
        },
        {
          id: 'p2',
          username: 'Delta',
          games_played: 7, // 7 games vs 5 for others
          total_goals: 10,
          total_assists: 4,
          best_defender_awards: 2,
          best_gk_awards: 0,
          motm_awards: 1,
        },
        {
          id: 'p1',
          username: 'Echo',
          games_played: 3,
          total_goals: 10,
          total_assists: 8, // 8 assists vs 4 for others
          best_defender_awards: 0,
          best_gk_awards: 0,
          motm_awards: 0,
        },
        {
          id: 'p0',
          username: 'Foxtrot',
          games_played: 2,
          total_goals: 15, // 15 goals (highest)
          total_assists: 0,
          best_defender_awards: 0,
          best_gk_awards: 0,
          motm_awards: 0,
        },
      ];

      const enriched = enrichPlayersWithRatings(players);

      // Expected Order:
      // 1. Foxtrot: 15 goals
      // 2. Echo: 10 goals, 8 assists
      // 3. Delta: 10 goals, 4 assists, 7 games
      // 4. Charlie: 10 goals, 4 assists, 5 games, 3 awards
      // 5. Alpha: 10 goals, 4 assists, 5 games, 2 awards, alphabetical 'Alpha' < 'Bravo'
      // 6. Bravo: 10 goals, 4 assists, 5 games, 2 awards, alphabetical 'Bravo'
      expect(enriched.map(p => p.username)).toEqual([
        'Foxtrot',
        'Echo',
        'Delta',
        'Charlie',
        'Alpha',
        'Bravo',
      ]);

      // Verify sequential ranks
      expect(enriched.map(p => p.leaderboardRank)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('Scenario 10: identifies and assigns isTopAssister badge to tied top assisters when assists > 0', () => {
      const players: PlayerStats[] = [
        { id: 'p1', username: 'Playmaker1', games_played: 3, total_goals: 2, total_assists: 7 },
        { id: 'p2', username: 'Playmaker2', games_played: 4, total_goals: 1, total_assists: 7 },
        { id: 'p3', username: 'Goalscorer', games_played: 3, total_goals: 10, total_assists: 2 },
      ];

      const enriched = enrichPlayersWithRatings(players);

      const p1 = enriched.find(p => p.id === 'p1');
      const p2 = enriched.find(p => p.id === 'p2');
      const p3 = enriched.find(p => p.id === 'p3');

      expect(p1?.isTopAssister).toBe(true);
      expect(p2?.isTopAssister).toBe(true);
      expect(p3?.isTopAssister).toBeUndefined();
    });

    it('Scenario 11: does not assign isTopAssister badge to any player when all have 0 assists', () => {
      const players: PlayerStats[] = [
        { id: 'p1', username: 'Solo1', games_played: 2, total_goals: 3, total_assists: 0 },
        { id: 'p2', username: 'Solo2', games_played: 2, total_goals: 1, total_assists: 0 },
      ];

      const enriched = enrichPlayersWithRatings(players);
      expect(enriched.every(p => !p.isTopAssister)).toBe(true);
    });

    it('correctly enriches players with onFire flag from set', () => {
      const onFireSet = new Set(['fire-player-1']);
      const players: PlayerStats[] = [
        { id: 'fire-player-1', username: 'Hot', games_played: 2, total_goals: 6, total_assists: 1 },
        { id: 'cold-player-2', username: 'Cold', games_played: 2, total_goals: 1, total_assists: 0 },
      ];

      const enriched = enrichPlayersWithRatings(players, onFireSet);
      expect(enriched.find(p => p.id === 'fire-player-1')?.onFire).toBe(true);
      expect(enriched.find(p => p.id === 'cold-player-2')?.onFire).toBe(false);
    });

    it('formats ratings cleanly to integer string', () => {
      expect(formatRating(85)).toBe('85');
      expect(formatRating(85.4)).toBe('85');
      expect(formatRating(85.6)).toBe('86');
    });
  });
});
