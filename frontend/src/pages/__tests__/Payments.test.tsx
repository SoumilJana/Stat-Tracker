import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Payments from '../Payments';
import * as gameApi from '../../lib/gamePaymentsApi';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-admin', email: 'admin@stattracker.local' },
    profile: { id: 'user-admin', username: 'AdminUser', role: 'admin' },
    loading: false
  })
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null })
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}));

describe('Phase 7: Payments Master Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state with Schedule Match Day button when no game is active', async () => {
    vi.spyOn(gameApi, 'fetchLatestGame').mockResolvedValue(null);

    render(
      <MemoryRouter>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Active Match Scheduled')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Schedule Match Day/i })).toBeInTheDocument();
  });

  it('renders active game header, progress bar, attendance dock, and squad when game exists', async () => {
    const mockGame = {
      id: 'g-1',
      game_date: '2026-11-20',
      start_time: '19:00',
      location: 'Plaza Turf',
      amount_per_player: 80,
      total_turf_cost: 800,
      duration_minutes: 60,
      mode: 'STANDARD' as const,
      min_players: 10,
      max_players: 15,
      status: 'REGISTRATION_OPEN' as const,
      created_at: '2026-11-11T10:00:00Z',
      updated_at: '2026-11-11T10:00:00Z'
    };

    const mockRegistrations = [
      {
        id: 'reg-1',
        game_id: 'g-1',
        user_id: 'user-admin',
        response: 'IN' as const,
        joined_at: '2026-11-11T10:00:00Z',
        profile: { id: 'user-admin', username: 'AdminUser' }
      }
    ];

    vi.spyOn(gameApi, 'fetchLatestGame').mockResolvedValue(mockGame);
    vi.spyOn(gameApi, 'fetchGameRegistrations').mockResolvedValue(mockRegistrations);
    vi.spyOn(gameApi, 'fetchGamePayments').mockResolvedValue([]);
    vi.spyOn(gameApi, 'fetchPaymentProfiles').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Match Day')).toBeInTheDocument();
    });

    expect(screen.getByText('Plaza Turf')).toBeInTheDocument();
    expect(screen.getByText('1 / 10 Players')).toBeInTheDocument();
    expect(screen.getByText(/Your Match Attendance/i)).toBeInTheDocument();
    expect(screen.getByText('Admin Center')).toBeInTheDocument();
  });

  it('opens WhatsApp summary modal when WhatsApp Summary button is clicked', async () => {
    const mockGame = {
      id: 'g-1',
      game_date: '2026-11-20',
      start_time: '19:00',
      location: 'Plaza Turf',
      amount_per_player: 80,
      total_turf_cost: 800,
      duration_minutes: 60,
      mode: 'STANDARD' as const,
      min_players: 10,
      max_players: 15,
      status: 'REGISTRATION_OPEN' as const,
      created_at: '2026-11-11T10:00:00Z',
      updated_at: '2026-11-11T10:00:00Z'
    };

    vi.spyOn(gameApi, 'fetchLatestGame').mockResolvedValue(mockGame);
    vi.spyOn(gameApi, 'fetchGameRegistrations').mockResolvedValue([]);
    vi.spyOn(gameApi, 'fetchGamePayments').mockResolvedValue([]);
    vi.spyOn(gameApi, 'fetchPaymentProfiles').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Match Day')).toBeInTheDocument();
    });

    const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp Summary/i });
    fireEvent.click(whatsAppBtn);

    await waitFor(() => {
      expect(screen.getByText('WhatsApp Game Summary')).toBeInTheDocument();
    });
  });
});
