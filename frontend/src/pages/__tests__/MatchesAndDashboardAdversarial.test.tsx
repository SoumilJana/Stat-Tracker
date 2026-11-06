import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Matches from '../Matches';
import Dashboard from '../Dashboard';
import { supabase } from '../../lib/supabase';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'admin-1', role: 'admin', username: 'admin' },
  }),
}));

// Mock ToastContext
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock ConfirmContext
vi.mock('../../contexts/ConfirmContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

// Mock child components for Dashboard
vi.mock('../../components/NotificationsSetup', () => ({
  default: () => <div data-testid="notifications-setup" />,
}));

vi.mock('../../components/AnkitaDashboard', () => ({
  default: () => <div data-testid="ankita-dashboard" />,
}));

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function renderDashboardWithQueryClient() {
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

function mockDashboardData({
  upcomingMatch = null,
  completedMatch = null,
  totalGoals = 0,
  totalMatches = 0,
  seasonGoals = 0,
  seasonMatches = 0,
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
        select: vi.fn().mockImplementation((_cols: string, _opts?: any) => ({
          eq: vi.fn().mockImplementation((_col: string, _val: string) => ({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ count: seasonGoals, error: null }),
            }),
            then: (resolve: any) => Promise.resolve({ count: totalGoals, error: null }).then(resolve),
          })),
        })),
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

describe('Empirical Adversarial Tests: Milestone 4 Matches & Dashboard Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Matches.tsx — Backward Compatibility & Mode Tag Stress-Testing', () => {
    it('STRESS-TEST: STANDARD mode sessions (SCHEDULED, IN_PROGRESS, COMPLETED) never display "7v7 Special"', async () => {
      const mockSessions = [
        {
          id: 'std-sched',
          date: '2026-11-06T18:00:00Z',
          mode: 'STANDARD',
          status: 'SCHEDULED',
          location: 'Field Standard 1',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
        {
          id: 'std-live',
          date: '2026-11-06T19:00:00Z',
          mode: 'STANDARD',
          status: 'IN_PROGRESS',
          location: 'Field Standard 2',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
        {
          id: 'std-done',
          date: '2026-11-05T18:00:00Z',
          mode: 'STANDARD',
          status: 'COMPLETED',
          location: 'Field Standard 3',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [{ team_id: 't1', event_type: 'GOAL' }],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Field Standard 1')).toBeInTheDocument();
      });

      expect(screen.queryByText(/7v7 Special/i)).not.toBeInTheDocument();
    });

    it('STRESS-TEST: WINNER_STAYS mode sessions (SCHEDULED, IN_PROGRESS, COMPLETED) never display "7v7 Special"', async () => {
      const mockSessions = [
        {
          id: 'ws-sched',
          date: '2026-11-06T18:00:00Z',
          mode: 'WINNER_STAYS',
          status: 'SCHEDULED',
          location: 'Field WS 1',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }, { id: 't3', name: 'Team C' }],
          events: [],
        },
        {
          id: 'ws-live',
          date: '2026-11-06T19:00:00Z',
          mode: 'WINNER_STAYS',
          status: 'IN_PROGRESS',
          location: 'Field WS 2',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }, { id: 't3', name: 'Team C' }],
          events: [],
        },
        {
          id: 'ws-done',
          date: '2026-11-05T18:00:00Z',
          mode: 'WINNER_STAYS',
          status: 'COMPLETED',
          location: 'Field WS 3',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }, { id: 't3', name: 'Team C' }],
          events: [],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Field WS 1')).toBeInTheDocument();
      });

      expect(screen.queryByText(/7v7 Special/i)).not.toBeInTheDocument();
    });

    it('STRESS-TEST: Unknown, undefined, or malformed mode values never render "7v7 Special"', async () => {
      const mockSessions = [
        {
          id: 's-undef',
          date: '2026-11-06T18:00:00Z',
          mode: undefined,
          status: 'SCHEDULED',
          location: 'Field Undef',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
        {
          id: 's-null',
          date: '2026-11-06T18:00:00Z',
          mode: null,
          status: 'SCHEDULED',
          location: 'Field Null',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
        {
          id: 's-partial',
          date: '2026-11-06T18:00:00Z',
          mode: '7V7',
          status: 'SCHEDULED',
          location: 'Field Partial',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Field Undef')).toBeInTheDocument();
      });

      expect(screen.queryByText(/7v7 Special/i)).not.toBeInTheDocument();
    });

    it('STRESS-TEST: In a mixed list of sessions, only SPECIAL_7V7 sessions render the badge', async () => {
      const mockSessions = [
        {
          id: 's-std',
          date: '2026-11-06T18:00:00Z',
          mode: 'STANDARD',
          status: 'SCHEDULED',
          location: 'Std Arena',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
        {
          id: 's-7v7',
          date: '2026-11-06T19:00:00Z',
          mode: 'SPECIAL_7V7',
          status: 'SCHEDULED',
          location: 'Special Arena',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
        {
          id: 's-ws',
          date: '2026-11-06T20:00:00Z',
          mode: 'WINNER_STAYS',
          status: 'SCHEDULED',
          location: 'WS Arena',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }, { id: 't3', name: 'Team C' }],
          events: [],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Special Arena')).toBeInTheDocument();
      });

      const badges = screen.getAllByText('7v7 Special');
      expect(badges).toHaveLength(1);
    });
  });

  describe('2. Dashboard.tsx — Mode Badges, Stats Calculations & Fallback Handling', () => {
    it('STRESS-TEST: Backward compatibility: STANDARD & WINNER_STAYS never render "7v7 Special" in Dashboard', async () => {
      mockDashboardData({
        upcomingMatch: {
          id: 'dash-up-std',
          date: '2026-11-06T18:00:00Z',
          mode: 'STANDARD',
          status: 'SCHEDULED',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
        completedMatch: {
          id: 'dash-done-ws',
          date: '2026-11-05T18:00:00Z',
          mode: 'WINNER_STAYS',
          status: 'COMPLETED',
          teams: [{ id: 't1', name: 'Team A' }, { id: 't2', name: 'Team B' }],
          events: [],
        },
      });

      renderDashboardWithQueryClient();

      await waitFor(() => {
        expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      });

      expect(screen.queryByText(/7v7 Special/i)).not.toBeInTheDocument();
    });

    it('STRESS-TEST: Fallback handling when 0 matches and 0 goals exist', async () => {
      mockDashboardData({
        upcomingMatch: null,
        completedMatch: null,
        totalGoals: 0,
        totalMatches: 0,
        seasonGoals: 0,
        seasonMatches: 0,
      });

      renderDashboardWithQueryClient();

      await waitFor(() => {
        expect(screen.getByText('No upcoming matches.')).toBeInTheDocument();
        expect(screen.getByText('No completed matches yet.')).toBeInTheDocument();
      });

      // Verify Avg Goals per Match safely displays '0.0' and NOT 'NaN'
      expect(screen.getByText('0.0')).toBeInTheDocument();
      expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
    });

    it('STRESS-TEST: Dashboard statistics division and rounding logic', async () => {
      mockDashboardData({
        totalGoals: 125,
        totalMatches: 30,
        seasonGoals: 25,
        seasonMatches: 7,
      });

      renderDashboardWithQueryClient();

      await waitFor(() => {
        // 25 / 7 = 3.5714... rounded to 1 decimal place -> 3.6
        expect(screen.getByText('3.6')).toBeInTheDocument();
        expect(screen.getByText('125')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
      });
    });

    it('STRESS-TEST: Fallback team names when upcomingMatch has empty teams array', async () => {
      mockDashboardData({
        upcomingMatch: {
          id: 'up-empty-teams',
          date: '2026-11-06T18:00:00Z',
          mode: 'SPECIAL_7V7',
          status: 'SCHEDULED',
          teams: [],
          events: [],
        },
      });

      renderDashboardWithQueryClient();

      await waitFor(() => {
        expect(screen.getByText('7v7 Special')).toBeInTheDocument();
      });

      // Fallback in Dashboard: A VS B
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('VS')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('STRESS-TEST: Completed SPECIAL_7V7 match with 0-0 draw and events handling', async () => {
      mockDashboardData({
        completedMatch: {
          id: 'done-0-0',
          date: '2026-11-05T18:00:00Z',
          mode: 'SPECIAL_7V7',
          status: 'COMPLETED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: [
            { team_id: 't1', event_type: 'YELLOW_CARD' }, // non-goal event
          ],
        },
      });

      renderDashboardWithQueryClient();

      await waitFor(() => {
        expect(screen.getByText('7v7 Special')).toBeInTheDocument();
      });

      // Score should cleanly be 0 - 0
      expect(screen.getByText('0 - 0')).toBeInTheDocument();
      expect(screen.getByText('A vs B')).toBeInTheDocument();
    });
  });
});
