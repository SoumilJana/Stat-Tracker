import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOnFirePlayers } from '../streaks';
import { supabase } from '../supabase';

// Mock supabase client
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function createQueryBuilder<T>(response: { data: T | null; error: any }) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    then(onFulfilled: (res: typeof response) => any, onRejected?: (err: any) => any) {
      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('streaks logic — getOnFirePlayers', () => {
  let sessionsBuilder: any;
  let eventsBuilder: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMocks(
    sessionsResponse: { data: Array<{ id: string }> | null; error: any },
    eventsResponse: { data: Array<{ player_id: string; session_id: string }> | null; error: any }
  ) {
    sessionsBuilder = createQueryBuilder(sessionsResponse);
    eventsBuilder = createQueryBuilder(eventsResponse);

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'sessions') return sessionsBuilder;
      if (table === 'events') return eventsBuilder;
      return createQueryBuilder({ data: null, error: null });
    });
  }

  it('Scenario 1: returns on-fire player who scored >=3 goals in each of the last 2 completed sessions', async () => {
    setupMocks(
      { data: [{ id: 'session-1' }, { id: 'session-2' }], error: null },
      {
        data: [
          // Session 1: 3 goals for p1
          { player_id: 'p1', session_id: 'session-1' },
          { player_id: 'p1', session_id: 'session-1' },
          { player_id: 'p1', session_id: 'session-1' },
          // Session 2: 4 goals for p1
          { player_id: 'p1', session_id: 'session-2' },
          { player_id: 'p1', session_id: 'session-2' },
          { player_id: 'p1', session_id: 'session-2' },
          { player_id: 'p1', session_id: 'session-2' },
        ],
        error: null,
      }
    );

    const onFire = await getOnFirePlayers();

    expect(onFire).toBeInstanceOf(Set);
    expect(onFire.has('p1')).toBe(true);
    expect(onFire.size).toBe(1);
  });

  it('Scenario 2: qualifies player on exact boundary condition (exactly 3 goals in both sessions)', async () => {
    setupMocks(
      { data: [{ id: 'sess-A' }, { id: 'sess-B' }], error: null },
      {
        data: [
          // sess-A: exactly 3 goals
          { player_id: 'boundary-p', session_id: 'sess-A' },
          { player_id: 'boundary-p', session_id: 'sess-A' },
          { player_id: 'boundary-p', session_id: 'sess-A' },
          // sess-B: exactly 3 goals
          { player_id: 'boundary-p', session_id: 'sess-B' },
          { player_id: 'boundary-p', session_id: 'sess-B' },
          { player_id: 'boundary-p', session_id: 'sess-B' },
        ],
        error: null,
      }
    );

    const onFire = await getOnFirePlayers();
    expect(onFire.has('boundary-p')).toBe(true);
    expect(onFire.size).toBe(1);
  });

  it('Scenario 3: breaks streak when player scores fewer than 3 goals in the most recent session', async () => {
    setupMocks(
      { data: [{ id: 'sess-recent' }, { id: 'sess-older' }], error: null },
      {
        data: [
          // sess-older: 5 goals
          { player_id: 'p1', session_id: 'sess-older' },
          { player_id: 'p1', session_id: 'sess-older' },
          { player_id: 'p1', session_id: 'sess-older' },
          { player_id: 'p1', session_id: 'sess-older' },
          { player_id: 'p1', session_id: 'sess-older' },
          // sess-recent: only 2 goals (disqualified)
          { player_id: 'p1', session_id: 'sess-recent' },
          { player_id: 'p1', session_id: 'sess-recent' },
        ],
        error: null,
      }
    );

    const onFire = await getOnFirePlayers();
    expect(onFire.has('p1')).toBe(false);
    expect(onFire.size).toBe(0);
  });

  it('Scenario 4: breaks streak when player misses a session (0 goals recorded)', async () => {
    setupMocks(
      { data: [{ id: 'sess-1' }, { id: 'sess-2' }], error: null },
      {
        data: [
          // Only sess-1 goals, missed sess-2 completely
          { player_id: 'p1', session_id: 'sess-1' },
          { player_id: 'p1', session_id: 'sess-1' },
          { player_id: 'p1', session_id: 'sess-1' },
          { player_id: 'p1', session_id: 'sess-1' },
        ],
        error: null,
      }
    );

    const onFire = await getOnFirePlayers();
    expect(onFire.has('p1')).toBe(false);
    expect(onFire.size).toBe(0);
  });

  it('Scenario 5: returns empty set when fewer than 2 completed sessions exist globally', async () => {
    setupMocks(
      { data: [{ id: 'sess-only-one' }], error: null },
      { data: [], error: null }
    );

    const onFire = await getOnFirePlayers();
    expect(onFire.size).toBe(0);
    // Should short-circuit and not query events
    expect(eventsBuilder.select).not.toHaveBeenCalled();
  });

  it('Scenario 6: filters for COMPLETED sessions only and returns empty set if none qualify', async () => {
    setupMocks(
      { data: [], error: null },
      { data: [], error: null }
    );

    const onFire = await getOnFirePlayers();

    expect(sessionsBuilder.eq).toHaveBeenCalledWith('status', 'COMPLETED');
    expect(sessionsBuilder.limit).toHaveBeenCalledWith(2);
    expect(sessionsBuilder.order).toHaveBeenCalledWith('date', { ascending: false });
    expect(onFire.size).toBe(0);
  });

  it('Scenario 7: filters events by GOAL type and evaluates target sessions correctly', async () => {
    setupMocks(
      { data: [{ id: 's1' }, { id: 's2' }], error: null },
      {
        data: [
          // p1 has 3 goals in s1, 3 in s2
          { player_id: 'p1', session_id: 's1' },
          { player_id: 'p1', session_id: 's1' },
          { player_id: 'p1', session_id: 's1' },
          { player_id: 'p1', session_id: 's2' },
          { player_id: 'p1', session_id: 's2' },
          { player_id: 'p1', session_id: 's2' },
        ],
        error: null,
      }
    );

    await getOnFirePlayers();

    expect(eventsBuilder.eq).toHaveBeenCalledWith('event_type', 'GOAL');
    expect(eventsBuilder.in).toHaveBeenCalledWith('session_id', ['s1', 's2']);
  });

  it('Scenario 8: correctly evaluates multiple players simultaneously', async () => {
    setupMocks(
      { data: [{ id: 's1' }, { id: 's2' }], error: null },
      {
        data: [
          // p1: 3 in s1, 3 in s2 -> ON FIRE
          { player_id: 'p1', session_id: 's1' },
          { player_id: 'p1', session_id: 's1' },
          { player_id: 'p1', session_id: 's1' },
          { player_id: 'p1', session_id: 's2' },
          { player_id: 'p1', session_id: 's2' },
          { player_id: 'p1', session_id: 's2' },

          // p2: 4 in s1, 5 in s2 -> ON FIRE
          { player_id: 'p2', session_id: 's1' },
          { player_id: 'p2', session_id: 's1' },
          { player_id: 'p2', session_id: 's1' },
          { player_id: 'p2', session_id: 's1' },
          { player_id: 'p2', session_id: 's2' },
          { player_id: 'p2', session_id: 's2' },
          { player_id: 'p2', session_id: 's2' },
          { player_id: 'p2', session_id: 's2' },
          { player_id: 'p2', session_id: 's2' },

          // p3: 2 in s1 (failed), 5 in s2 -> NOT ON FIRE
          { player_id: 'p3', session_id: 's1' },
          { player_id: 'p3', session_id: 's1' },
          { player_id: 'p3', session_id: 's2' },
          { player_id: 'p3', session_id: 's2' },
          { player_id: 'p3', session_id: 's2' },
          { player_id: 'p3', session_id: 's2' },
          { player_id: 'p3', session_id: 's2' },
        ],
        error: null,
      }
    );

    const onFire = await getOnFirePlayers();
    expect(onFire.has('p1')).toBe(true);
    expect(onFire.has('p2')).toBe(true);
    expect(onFire.has('p3')).toBe(false);
    expect(onFire.size).toBe(2);
  });

  it('Scenario 9: gracefully handles database or network errors without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 9a: sessions query error
    setupMocks(
      { data: null, error: { message: 'Database connection failed' } },
      { data: null, error: null }
    );
    let onFire = await getOnFirePlayers();
    expect(onFire.size).toBe(0);

    // 9b: events query error
    setupMocks(
      { data: [{ id: 's1' }, { id: 's2' }], error: null },
      { data: null, error: { message: 'PostgREST query error' } }
    );
    onFire = await getOnFirePlayers();
    expect(onFire.size).toBe(0);

    // 9c: unexpected runtime exception in query
    vi.mocked(supabase.from).mockImplementationOnce(() => {
      throw new Error('Fatal socket failure');
    });
    onFire = await getOnFirePlayers();
    expect(onFire.size).toBe(0);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
