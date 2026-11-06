import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { supabase } from '../../lib/supabase';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'admin-1', role: 'admin', username: 'admin' },
  }),
}));

// Mock NotificationsSetup component
vi.mock('../../components/NotificationsSetup', () => ({
  default: () => <div data-testid="notifications-setup" />,
}));

// Mock AnkitaDashboard component
vi.mock('../../components/AnkitaDashboard', () => ({
  default: () => <div data-testid="ankita-dashboard" />,
}));

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function mockDashboardSupabase({
  upcomingMatch = null,
  completedMatch = null,
  totalGoals = 42,
  totalMatches = 10,
  seasonGoals = 12,
  seasonMatches = 4,
}: {
  upcomingMatch?: any;
  completedMatch?: any;
  totalGoals?: number;
  totalMatches?: number;
  seasonGoals?: number;
  seasonMatches?: number;
} = {}) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'events') {
      return {
        select: vi.fn().mockImplementation((_cols: string, _opts?: any) => {
          return {
            eq: vi.fn().mockImplementation((_col: string, _val: string) => {
              return {
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({ count: seasonGoals, error: null }),
                }),
                then: (resolve: any) => Promise.resolve({ count: totalGoals, error: null }).then(resolve),
              };
            }),
          };
        }),
      } as any;
    }
    if (table === 'sessions') {
      return {
        select: vi.fn().mockImplementation((_cols: string, opts?: any) => {
          if (opts?.count === 'exact') {
            return {
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({ count: seasonMatches, error: null }),
                }),
                then: (resolve: any) => Promise.resolve({ count: totalMatches, error: null }).then(resolve),
              }),
            };
          }
          // Match queries
          return {
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: completedMatch ? [completedMatch] : [],
                  error: null,
                }),
              }),
            }),
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: upcomingMatch ? [upcomingMatch] : [],
                  error: null,
                }),
              }),
            }),
          };
        }),
      } as any;
    }
    return {} as any;
  });
}

describe('Dashboard Page - 7v7 Special Mode Display (SPECIAL_7V7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "7v7 Special" mode badge with purple styling for upcoming SPECIAL_7V7 matches', async () => {
    const mockUpcoming = {
      id: 'session-7v7-up',
      date: '2026-11-06T18:00:00Z',
      mode: 'SPECIAL_7V7',
      status: 'SCHEDULED',
      location: 'Pitch 7',
      teams: [
        { id: 't1', name: 'Team A' },
        { id: 't2', name: 'Team B' },
      ],
      events: [],
    };

    mockDashboardSupabase({ upcomingMatch: mockUpcoming });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
    });

    const modeBadge = screen.getByText('7v7 Special');
    expect(modeBadge).toBeInTheDocument();
    expect(modeBadge).toHaveClass('bg-purple-500/10');
    expect(modeBadge).toHaveClass('text-purple-400');
    expect(modeBadge).toHaveClass('border-purple-500/20');
    expect(modeBadge).toHaveClass('rounded-full');
    expect(modeBadge).toHaveClass('uppercase');
  });

  it('renders "7v7 Special" mode badge with purple styling for completed SPECIAL_7V7 matches', async () => {
    const mockCompleted = {
      id: 'session-7v7-done',
      date: '2026-11-05T18:00:00Z',
      mode: 'SPECIAL_7V7',
      status: 'COMPLETED',
      location: 'Pitch 7',
      teams: [
        { id: 't1', name: 'Team A' },
        { id: 't2', name: 'Team B' },
      ],
      events: [
        { team_id: 't1', event_type: 'GOAL' },
        { team_id: 't1', event_type: 'GOAL' },
        { team_id: 't2', event_type: 'GOAL' },
      ],
    };

    mockDashboardSupabase({ completedMatch: mockCompleted });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    const modeBadge = screen.getByText('7v7 Special');
    expect(modeBadge).toBeInTheDocument();
    expect(modeBadge).toHaveClass('bg-purple-500/10');
    expect(modeBadge).toHaveClass('text-purple-400');
    expect(modeBadge).toHaveClass('border-purple-500/20');
    expect(modeBadge).toHaveClass('rounded-full');
    expect(modeBadge).toHaveClass('uppercase');

    // Verify 2-team scores are rendered cleanly
    expect(screen.getByText('2 - 1')).toBeInTheDocument();
    expect(screen.getByText('A vs B')).toBeInTheDocument();
  });

  it('does NOT render "7v7 Special" mode badge when matches are STANDARD or WINNER_STAYS', async () => {
    const mockUpcomingStd = {
      id: 'session-std-up',
      date: '2026-11-06T18:00:00Z',
      mode: 'STANDARD',
      status: 'SCHEDULED',
      location: 'Pitch 1',
      teams: [
        { id: 't1', name: 'Team A' },
        { id: 't2', name: 'Team B' },
      ],
      events: [],
    };

    const mockCompletedWS = {
      id: 'session-ws-done',
      date: '2026-11-05T18:00:00Z',
      mode: 'WINNER_STAYS',
      status: 'COMPLETED',
      location: 'Pitch 2',
      teams: [
        { id: 't1', name: 'Team A' },
        { id: 't2', name: 'Team B' },
      ],
      events: [],
    };

    mockDashboardSupabase({
      upcomingMatch: mockUpcomingStd,
      completedMatch: mockCompletedWS,
    });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    expect(screen.queryByText('7v7 Special')).not.toBeInTheDocument();
  });

  it('correctly calculates and renders season and overall statistics widgets for SPECIAL_7V7 fixtures', async () => {
    mockDashboardSupabase({
      totalGoals: 50,
      totalMatches: 10,
      seasonGoals: 20,
      seasonMatches: 4,
    });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument(); // Total Goals
      expect(screen.getByText('10')).toBeInTheDocument(); // Total Matches
      expect(screen.getByText('20')).toBeInTheDocument(); // Season Goals
      expect(screen.getByText('4')).toBeInTheDocument(); // Season Matches
      expect(screen.getByText('5.0')).toBeInTheDocument(); // Avg Goals per Match (20 / 4)
    });
  });

  it('gracefully renders fallback placeholders when no matches are scheduled or completed', async () => {
    mockDashboardSupabase({
      upcomingMatch: null,
      completedMatch: null,
    });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('No upcoming matches.')).toBeInTheDocument();
      expect(screen.getByText('No completed matches yet.')).toBeInTheDocument();
    });
  });
});
