import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
const mockProfile = { id: 'admin-1', role: 'admin', username: 'admin' };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfile,
  }),
}));

// Mock ToastContext
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

// Mock ConfirmContext
const mockConfirm = vi.fn().mockResolvedValue(true);
vi.mock('../../contexts/ConfirmContext', () => ({
  useConfirm: () => mockConfirm,
}));

// Mock NotificationsSetup & AnkitaDashboard
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
  totalGoals = 30,
  totalMatches = 6,
  seasonGoals = 15,
  seasonMatches = 3,
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

describe('Adversarial Stress Harness: Milestone 4 (Matches & Dashboard Display for SPECIAL_7V7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dimension 1: Matches.tsx Status Matrix & Badge Consistency', () => {
    it('renders "7v7 Special" badge across SCHEDULED, IN_PROGRESS, and COMPLETED statuses with distinct status indicators', async () => {
      const mockSessions = [
        {
          id: 's-sched',
          date: '2026-11-07T10:00:00Z',
          location: 'Stadium East',
          mode: 'SPECIAL_7V7',
          status: 'SCHEDULED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: [],
        },
        {
          id: 's-live',
          date: '2026-11-06T18:00:00Z',
          location: 'Stadium West',
          mode: 'SPECIAL_7V7',
          status: 'IN_PROGRESS',
          teams: [
            { id: 't3', name: 'Team A' },
            { id: 't4', name: 'Team B' },
          ],
          events: [{ team_id: 't3', event_type: 'GOAL' }],
        },
        {
          id: 's-done',
          date: '2026-11-05T12:00:00Z',
          location: 'Stadium South',
          mode: 'SPECIAL_7V7',
          status: 'COMPLETED',
          teams: [
            { id: 't5', name: 'Team A' },
            { id: 't6', name: 'Team B' },
          ],
          events: [
            { team_id: 't5', event_type: 'GOAL' },
            { team_id: 't6', event_type: 'GOAL' },
          ],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
        expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      });

      const badges = screen.getAllByText('7v7 Special');
      expect(badges).toHaveLength(3);

      badges.forEach((b) => {
        expect(b).toHaveClass('bg-purple-500/10');
        expect(b).toHaveClass('text-purple-400');
        expect(b).toHaveClass('border-purple-500/20');
        expect(b).toHaveClass('rounded-full');
      });
    });

    it('ensures mode badge is strictly omitted when session.mode is undefined or null', async () => {
      const mockSessions = [
        {
          id: 's-legacy-no-mode',
          date: '2026-11-07T10:00:00Z',
          location: 'Legacy Field',
          mode: undefined,
          status: 'SCHEDULED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: [],
        },
        {
          id: 's-legacy-null-mode',
          date: '2026-11-05T12:00:00Z',
          location: 'Legacy Field 2',
          mode: null,
          status: 'COMPLETED',
          teams: [
            { id: 't3', name: 'Team A' },
            { id: 't4', name: 'Team B' },
          ],
          events: [],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Legacy Field')).toBeInTheDocument();
        expect(screen.getByText('Legacy Field 2')).toBeInTheDocument();
      });

      expect(screen.queryByText('7v7 Special')).not.toBeInTheDocument();
    });
  });

  describe('Dimension 2: Edge Scorelines, Draws, and Event Filtering', () => {
    it('correctly tabulates and displays a 0 - 0 draw in completed SPECIAL_7V7 match on Matches page', async () => {
      const mockSessions = [
        {
          id: 's-draw-00',
          date: '2026-11-05T15:00:00Z',
          location: 'Draw Pitch',
          mode: 'SPECIAL_7V7',
          status: 'COMPLETED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: [], // No goals
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('A vs B')).toBeInTheDocument();
      });

      expect(screen.getByText('0 - 0')).toBeInTheDocument();
    });

    it('correctly tabulates and displays high scores and ignores non-GOAL events or unknown team IDs', async () => {
      const mockSessions = [
        {
          id: 's-high-score',
          date: '2026-11-05T15:00:00Z',
          location: 'Scorefest Pitch',
          mode: 'SPECIAL_7V7',
          status: 'COMPLETED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: [
            // 4 goals for t1
            { team_id: 't1', event_type: 'GOAL' },
            { team_id: 't1', event_type: 'GOAL' },
            { team_id: 't1', event_type: 'GOAL' },
            { team_id: 't1', event_type: 'GOAL' },
            // 2 goals for t2
            { team_id: 't2', event_type: 'GOAL' },
            { team_id: 't2', event_type: 'GOAL' },
            // Non-GOAL events that must NOT increment score
            { team_id: 't1', event_type: 'YELLOW_CARD' },
            { team_id: 't2', event_type: 'SUBSTITUTION' },
            { team_id: 't1', event_type: 'ASSIST' },
            // Unknown team ID event that must be safely ignored
            { team_id: 'unknown-team-99', event_type: 'GOAL' },
          ],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('A vs B')).toBeInTheDocument();
      });

      // Scores must be 4 - 2, NOT 5 - 3 or corrupted
      expect(screen.getByText('4 - 2')).toBeInTheDocument();
    });
  });

  describe('Dimension 3: Single-Team and Degenerate Team Edge Cases', () => {
    it('handles session with empty teams gracefully without throwing', async () => {
      const mockSessions = [
        {
          id: 's-empty-teams',
          date: '2026-11-07T10:00:00Z',
          location: 'Empty Field',
          mode: 'SPECIAL_7V7',
          status: 'SCHEDULED',
          teams: [],
          events: [],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Empty Field')).toBeInTheDocument();
      });

      // Default fallback "A VS B" is rendered when teams is empty
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('handles session with null events gracefully without throwing', async () => {
      const mockSessions = [
        {
          id: 's-null-events',
          date: '2026-11-05T10:00:00Z',
          location: 'Null Events Pitch',
          mode: 'SPECIAL_7V7',
          status: 'COMPLETED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: null,
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('A vs B')).toBeInTheDocument();
      });

      expect(screen.getByText('0 - 0')).toBeInTheDocument();
    });

    it('renders "No location" placeholder when location is null or undefined', async () => {
      const mockSessions = [
        {
          id: 's-no-loc',
          date: '2026-11-07T10:00:00Z',
          location: null,
          mode: 'SPECIAL_7V7',
          status: 'SCHEDULED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: [],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No location')).toBeInTheDocument();
      });
    });
  });

  describe('Dimension 4: Dashboard Upcoming & Completed 7v7 Cards', () => {
    it('renders upcoming SPECIAL_7V7 match with IN_PROGRESS status and active 7v7 badge', async () => {
      const mockLiveUpcoming = {
        id: 'session-7v7-live',
        date: '2026-11-06T18:00:00Z',
        mode: 'SPECIAL_7V7',
        status: 'IN_PROGRESS',
        location: 'Pitch 7',
        teams: [
          { id: 't1', name: 'Team A' },
          { id: 't2', name: 'Team B' },
        ],
        events: [],
      };

      mockDashboardData({ upcomingMatch: mockLiveUpcoming });
      renderDashboardWithQueryClient();

      await waitFor(() => {
        expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      });

      const modeBadge = screen.getByText('7v7 Special');
      expect(modeBadge).toBeInTheDocument();
      expect(modeBadge).toHaveClass('whitespace-nowrap');
      expect(modeBadge).toHaveClass('bg-purple-500/10');
      expect(modeBadge).toHaveClass('text-purple-400');
    });

    it('renders completed SPECIAL_7V7 match with high score and tie score handling', async () => {
      const mockDrawCompleted = {
        id: 'session-7v7-draw',
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
          { team_id: 't1', event_type: 'GOAL' },
          { team_id: 't2', event_type: 'GOAL' },
          { team_id: 't2', event_type: 'GOAL' },
          { team_id: 't2', event_type: 'GOAL' },
        ],
      };

      mockDashboardData({ completedMatch: mockDrawCompleted });
      renderDashboardWithQueryClient();

      await waitFor(() => {
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      });

      const modeBadge = screen.getByText('7v7 Special');
      expect(modeBadge).toBeInTheDocument();
      expect(screen.getByText('A vs B')).toBeInTheDocument();
      expect(screen.getByText('3 - 3')).toBeInTheDocument();
    });

    it('renders fallback placeholders gracefully when both upcoming and completed are null', async () => {
      mockDashboardData({ upcomingMatch: null, completedMatch: null });
      renderDashboardWithQueryClient();

      await waitFor(() => {
        expect(screen.getByText('No upcoming matches.')).toBeInTheDocument();
        expect(screen.getByText('No completed matches yet.')).toBeInTheDocument();
      });

      expect(screen.queryByText('7v7 Special')).not.toBeInTheDocument();
    });
  });

  describe('Dimension 5: Viewport Wrap and shrink-0 CSS Protection', () => {
    it('verifies Matches card header uses flex-wrap on badges and shrink-0 on date', async () => {
      const mockSessions = [
        {
          id: 's-responsive-check',
          date: '2026-11-07T10:00:00Z',
          location: 'Responsive Arena',
          mode: 'SPECIAL_7V7',
          status: 'SCHEDULED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: [],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('7v7 Special')).toBeInTheDocument();
      });

      const modeBadge = screen.getByText('7v7 Special');
      const badgeContainer = modeBadge.parentElement;
      expect(badgeContainer).toHaveClass('flex-wrap');
      expect(badgeContainer).toHaveClass('items-center');
      expect(badgeContainer).toHaveClass('gap-2');

      const datePill = badgeContainer?.nextElementSibling;
      expect(datePill).toHaveClass('shrink-0');
    });

    it('verifies Dashboard upcoming and completed cards use flex-wrap on badges and shrink-0 on date', async () => {
      const mockUpcoming = {
        id: 's-up-wrap',
        date: '2026-11-07T10:00:00Z',
        mode: 'SPECIAL_7V7',
        status: 'SCHEDULED',
        teams: [
          { id: 't1', name: 'Team A' },
          { id: 't2', name: 'Team B' },
        ],
        events: [],
      };

      const mockDone = {
        id: 's-done-wrap',
        date: '2026-11-05T10:00:00Z',
        mode: 'SPECIAL_7V7',
        status: 'COMPLETED',
        teams: [
          { id: 't1', name: 'Team A' },
          { id: 't2', name: 'Team B' },
        ],
        events: [],
      };

      mockDashboardData({ upcomingMatch: mockUpcoming, completedMatch: mockDone });
      renderDashboardWithQueryClient();

      await waitFor(() => {
        expect(screen.getAllByText('7v7 Special')).toHaveLength(2);
      });

      const badges = screen.getAllByText('7v7 Special');
      badges.forEach((b) => {
        expect(b).toHaveClass('whitespace-nowrap');
        const container = b.parentElement;
        expect(container).toHaveClass('flex-wrap');
        expect(container).toHaveClass('items-center');
        expect(container).toHaveClass('gap-2');

        const datePill = container?.nextElementSibling;
        expect(datePill).toHaveClass('shrink-0');
      });
    });
  });

  describe('Dimension 6: Interaction & Navigation Safety', () => {
    it('clicking session card on Matches navigates to /matches/:id', async () => {
      const mockSessions = [
        {
          id: 's-nav-target-123',
          date: '2026-11-07T10:00:00Z',
          location: 'Nav Arena',
          mode: 'SPECIAL_7V7',
          status: 'SCHEDULED',
          teams: [
            { id: 't1', name: 'Team A' },
            { id: 't2', name: 'Team B' },
          ],
          events: [],
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
          }),
        }),
      } as any);

      render(
        <BrowserRouter>
          <Matches />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Nav Arena')).toBeInTheDocument();
      });

      const card = screen.getByText('Nav Arena').closest('.cursor-pointer');
      expect(card).not.toBeNull();
      if (card) {
        fireEvent.click(card);
        expect(mockNavigate).toHaveBeenCalledWith('/matches/s-nav-target-123');
      }
    });
  });
});
