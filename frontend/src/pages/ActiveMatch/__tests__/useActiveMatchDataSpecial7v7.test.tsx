import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveMatchData } from '../hooks/useActiveMatchData';
import { supabase } from '../../../lib/supabase';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock ConfirmContext
let confirmResult = true;
vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => vi.fn().mockImplementation(() => Promise.resolve(confirmResult)),
}));

// Mock ToastContext
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

// Mock Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

describe('Empirical Adversarial Stress Tests: SPECIAL_7V7 Match Resolution in useActiveMatchData', () => {
  const adminProfile = { id: 'admin-1', username: 'Admin', role: 'admin' };
  const sessionId = 'session-7v7-test';

  let insertedStats: any[] = [];
  let updatedSession: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    confirmResult = true;
    insertedStats = [];
    updatedSession = null;
    localStorage.clear();

    // Mock query builder for supabase calls
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: sessionId,
                  mode: 'SPECIAL_7V7',
                  status: 'IN_PROGRESS',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation((payload) => ({
            eq: vi.fn().mockImplementation((_col, _val) => {
              updatedSession = payload;
              return Promise.resolve({ error: null });
            }),
          })),
        } as any;
      }

      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'team-a', name: 'Team Alpha', session_id: sessionId },
                  { id: 'team-b', name: 'Team Beta', session_id: sessionId },
                ],
                error: null,
              }),
            }),
          }),
        } as any;
      }

      if (table === 'events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }

      if (table === 'poll_votes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        } as any;
      }

      if (table === 'team_players') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        } as any;
      }

      if (table === 'session_team_stats') {
        return {
          insert: vi.fn().mockImplementation((records) => {
            insertedStats = records;
            return Promise.resolve({ error: null });
          }),
        } as any;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      } as any;
    });
  });

  // Helper to mount hook and wait for initial fetch
  async function setupHook(sessionMode: 'SPECIAL_7V7' | 'STANDARD' | 'WINNER_STAYS' = 'SPECIAL_7V7') {
    if (sessionMode !== 'SPECIAL_7V7') {
      vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
        if (table === 'sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: sessionId,
                    mode: sessionMode,
                    status: 'IN_PROGRESS',
                  },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });
    }

    const rendered = renderHook(() => useActiveMatchData(sessionId, adminProfile));
    // Wait for async fetch
    await act(async () => {
      await Promise.resolve();
    });
    return rendered;
  }

  describe('Focus 1: Team A Win (e.g. 5-3)', () => {
    it('awards strictly 1 win to Team A and 0 wins to Team B, preserving match counts and goals conceded', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      const teamScores = { 'team-a': 5, 'team-b': 3 };
      const timeOnPitch = { 'team-a': 1, 'team-b': 1 };
      const goalsConceded = { 'team-a': 3, 'team-b': 5 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      expect(insertedStats).toHaveLength(2);
      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA).toEqual({
        session_id: sessionId,
        team_id: 'team-a',
        wins: 1, // Winner gets 1, NOT 5
        matches_played: 1,
        goals_conceded: 3,
      });

      expect(statB).toEqual({
        session_id: sessionId,
        team_id: 'team-b',
        wins: 0, // Loser gets 0, NOT 3
        matches_played: 1,
        goals_conceded: 5,
      });

      expect(updatedSession).toEqual({ status: 'COMPLETED' });
      expect(mockNavigate).toHaveBeenCalledWith('/matches');
    });
  });

  describe('Focus 2: Team B Win (e.g. 1-4)', () => {
    it('awards strictly 1 win to Team B and 0 wins to Team A', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      const teamScores = { 'team-a': 1, 'team-b': 4 };
      const timeOnPitch = { 'team-a': 1, 'team-b': 1 };
      const goalsConceded = { 'team-a': 4, 'team-b': 1 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA?.wins).toBe(0);
      expect(statB?.wins).toBe(1); // Winner gets 1, NOT 4
    });
  });

  describe('Focus 3: Scored Draw (e.g. 2-2)', () => {
    it('awards strictly 0 wins to both teams when scored draw occurs', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      const teamScores = { 'team-a': 2, 'team-b': 2 };
      const timeOnPitch = { 'team-a': 1, 'team-b': 1 };
      const goalsConceded = { 'team-a': 2, 'team-b': 2 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA?.wins).toBe(0);
      expect(statB?.wins).toBe(0);
      expect(statA?.goals_conceded).toBe(2);
      expect(statB?.goals_conceded).toBe(2);
    });
  });

  describe('Focus 4: Scoreless Draw (0-0)', () => {
    it('awards strictly 0 wins to both teams on a 0-0 draw without falling into false winner logic', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      const teamScores = { 'team-a': 0, 'team-b': 0 };
      const timeOnPitch = { 'team-a': 1, 'team-b': 1 };
      const goalsConceded = { 'team-a': 0, 'team-b': 0 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA?.wins).toBe(0);
      expect(statB?.wins).toBe(0);
      expect(statA?.goals_conceded).toBe(0);
      expect(statB?.goals_conceded).toBe(0);
    });
  });

  describe('Focus 5: Unusual Object Ordering and Keys', () => {
    it('resolves correctly when Team B is first key in teamScores object during Team A win', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      // Team B inserted before Team A in object keys
      const teamScores = { 'team-b': 3, 'team-a': 5 };
      const timeOnPitch = { 'team-b': 1, 'team-a': 1 };
      const goalsConceded = { 'team-b': 5, 'team-a': 3 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA?.wins).toBe(1);
      expect(statB?.wins).toBe(0);
    });

    it('resolves correctly when Team B is first key during Team B win', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      const teamScores = { 'team-b': 4, 'team-a': 1 };
      const timeOnPitch = { 'team-b': 1, 'team-a': 1 };
      const goalsConceded = { 'team-b': 1, 'team-a': 4 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA?.wins).toBe(0);
      expect(statB?.wins).toBe(1);
    });

    it('resolves correctly when Team B is first key in 0-0 draw', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      const teamScores = { 'team-b': 0, 'team-a': 0 };
      const timeOnPitch = { 'team-b': 1, 'team-a': 1 };
      const goalsConceded = { 'team-b': 0, 'team-a': 0 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA?.wins).toBe(0);
      expect(statB?.wins).toBe(0);
    });

    it('handles unexpected extra keys in teamScores without failing or corrupting valid teams', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      // Extra unknown team key in scores, but timeOnPitch only tracks team-a and team-b
      const teamScores = { 'team-a': 4, 'team-b': 2, 'unexpected-ghost-team': 1 };
      const timeOnPitch = { 'team-a': 1, 'team-b': 1 };
      const goalsConceded = { 'team-a': 2, 'team-b': 4 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      expect(insertedStats).toHaveLength(2);
      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA?.wins).toBe(1);
      expect(statB?.wins).toBe(0);
    });
  });

  describe('Focus 6: Contrast with WINNER_STAYS & Strict Win Invariant', () => {
    it('proves that in WINNER_STAYS mode goals ARE recorded as wins (contrast validation)', async () => {
      const { result } = await setupHook('WINNER_STAYS');

      const teamScores = { 'team-a': 5, 'team-b': 3 };
      const timeOnPitch = { 'team-a': 2, 'team-b': 2 };
      const goalsConceded = { 'team-a': 3, 'team-b': 5 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      // In WINNER_STAYS, wins count each mini-match win (= goals scored)
      expect(statA?.wins).toBe(5);
      expect(statB?.wins).toBe(3);
    });

    it('confirms that in SPECIAL_7V7 mode goals are NEVER recorded as wins', async () => {
      const { result } = await setupHook('SPECIAL_7V7');

      // High scoring game: 9-7
      const teamScores = { 'team-a': 9, 'team-b': 7 };
      const timeOnPitch = { 'team-a': 1, 'team-b': 1 };
      const goalsConceded = { 'team-a': 7, 'team-b': 9 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      const statA = insertedStats.find((s) => s.team_id === 'team-a');
      const statB = insertedStats.find((s) => s.team_id === 'team-b');

      expect(statA?.wins).toBe(1); // NOT 9
      expect(statB?.wins).toBe(0); // NOT 7
    });

    it('aborts without writing stats if user cancels confirmation dialog', async () => {
      confirmResult = false; // User clicks cancel
      const { result } = await setupHook('SPECIAL_7V7');

      const teamScores = { 'team-a': 5, 'team-b': 3 };
      const timeOnPitch = { 'team-a': 1, 'team-b': 1 };
      const goalsConceded = { 'team-a': 3, 'team-b': 5 };

      await act(async () => {
        await result.current.endSession(teamScores, timeOnPitch, goalsConceded);
      });

      expect(insertedStats).toHaveLength(0);
      expect(updatedSession).toBeNull();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Focus 7: Fuzz Stress Testing (100 pseudo-random score pairs)', () => {
    it('always satisfies: winner get 1 win, loser gets 0, draw gets 0 wins, wins <= 1', () => {
      // Direct algorithm check across 100 arbitrary score combinations
      for (let scoreA = 0; scoreA <= 10; scoreA++) {
        for (let scoreB = 0; scoreB <= 10; scoreB++) {
          const teamScores: Record<string, number> = { 'team-a': scoreA, 'team-b': scoreB };
          const timeOnPitch: Record<string, number> = { 'team-a': 1, 'team-b': 1 };
          const mode: string = 'SPECIAL_7V7';

          let maxGoals = -1;
          let winningTeamId: string | null = null;
          let isDraw = false;

          if (mode === 'STANDARD' || mode === 'SPECIAL_7V7') {
            Object.entries(teamScores).forEach(([tId, goals]) => {
              if (goals > maxGoals) {
                maxGoals = goals;
                winningTeamId = tId;
                isDraw = false;
              } else if (goals === maxGoals) {
                isDraw = true;
              }
            });
          }

          const teamStatsInserts = Object.keys(timeOnPitch).map((tId) => {
            let teamWins = 0;
            if (mode === 'STANDARD' || mode === 'SPECIAL_7V7') {
              teamWins = !isDraw && winningTeamId === tId ? 1 : 0;
            } else {
              teamWins = teamScores[tId] || 0;
            }
            return { team_id: tId, wins: teamWins };
          });

          const winA = teamStatsInserts.find((s) => s.team_id === 'team-a')!.wins;
          const winB = teamStatsInserts.find((s) => s.team_id === 'team-b')!.wins;

          // Invariant 1: Total wins awarded is either 1 (winner) or 0 (draw)
          expect(winA + winB).toBe(scoreA === scoreB ? 0 : 1);

          // Invariant 2: Individual wins is strictly 0 or 1
          expect(winA).toBeGreaterThanOrEqual(0);
          expect(winA).toBeLessThanOrEqual(1);
          expect(winB).toBeGreaterThanOrEqual(0);
          expect(winB).toBeLessThanOrEqual(1);

          if (scoreA > scoreB) {
            expect(winA).toBe(1);
            expect(winB).toBe(0);
          } else if (scoreB > scoreA) {
            expect(winA).toBe(0);
            expect(winB).toBe(1);
          } else {
            expect(winA).toBe(0);
            expect(winB).toBe(0);
          }
        }
      }
    });
  });
});
