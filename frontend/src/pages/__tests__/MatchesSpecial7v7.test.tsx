import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Matches from '../Matches';
import { supabase } from '../../lib/supabase';
import { BrowserRouter } from 'react-router-dom';

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

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Matches Page - 7v7 Special Mode Display (SPECIAL_7V7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "7v7 Special" mode badge with purple styling for scheduled and completed SPECIAL_7V7 sessions', async () => {
    const mockSessions = [
      {
        id: 's-7v7-scheduled',
        date: '2026-11-06T18:00:00Z',
        location: 'Field 1',
        mode: 'SPECIAL_7V7',
        status: 'SCHEDULED',
        teams: [
          { id: 't1', name: 'Team A' },
          { id: 't2', name: 'Team B' },
        ],
        events: [],
      },
      {
        id: 's-7v7-completed',
        date: '2026-11-05T18:00:00Z',
        location: 'Field 1',
        mode: 'SPECIAL_7V7',
        status: 'COMPLETED',
        teams: [
          { id: 't3', name: 'Team A' },
          { id: 't4', name: 'Team B' },
        ],
        events: [
          { team_id: 't3', event_type: 'GOAL' },
          { team_id: 't3', event_type: 'GOAL' },
          { team_id: 't4', event_type: 'GOAL' },
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
      expect(screen.queryByText('Manage your tournament sessions')).toBeInTheDocument();
    });

    const specialBadges = screen.getAllByText('7v7 Special');
    expect(specialBadges).toHaveLength(2); // One in upcoming, one in completed

    specialBadges.forEach((badge) => {
      expect(badge).toHaveClass('bg-purple-500/10');
      expect(badge).toHaveClass('text-purple-400');
      expect(badge).toHaveClass('border-purple-500/20');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('uppercase');
    });
  });

  it('does NOT render "7v7 Special" mode badge for STANDARD or WINNER_STAYS sessions', async () => {
    const mockSessions = [
      {
        id: 's-std-scheduled',
        date: '2026-11-06T19:00:00Z',
        location: 'Standard Field',
        mode: 'STANDARD',
        status: 'SCHEDULED',
        teams: [
          { id: 't1', name: 'Team A' },
          { id: 't2', name: 'Team B' },
        ],
        events: [],
      },
      {
        id: 's-ws-completed',
        date: '2026-11-05T19:00:00Z',
        location: 'Winner Stays Field',
        mode: 'WINNER_STAYS',
        status: 'COMPLETED',
        teams: [
          { id: 't3', name: 'Team A' },
          { id: 't4', name: 'Team B' },
          { id: 't5', name: 'Team C' },
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
      expect(screen.queryByText('Manage your tournament sessions')).toBeInTheDocument();
    });

    expect(screen.getByText('Standard Field')).toBeInTheDocument();
    expect(screen.getByText('Winner Stays Field')).toBeInTheDocument();
    expect(screen.queryByText('7v7 Special')).not.toBeInTheDocument();
  });

  it('renders "7v7 Special" badge for IN_PROGRESS SPECIAL_7V7 session', async () => {
    const mockSessions = [
      {
        id: 's-7v7-live',
        date: '2026-11-06T20:00:00Z',
        location: 'Live Arena',
        mode: 'SPECIAL_7V7',
        status: 'IN_PROGRESS',
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
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    });

    const badge = screen.getByText('7v7 Special');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-purple-500/10');
    expect(badge).toHaveClass('text-purple-400');
  });
});
