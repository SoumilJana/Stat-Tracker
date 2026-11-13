import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewMatch from '../NewMatch';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null })
  }
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  })
}));

describe('Phase 5: NewMatch Payments Bridge Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-populates match details and restricts roster when game_id is passed in query', async () => {
    const mockGame = {
      id: 'game-100',
      game_date: '2026-11-20',
      start_time: '20:30',
      location: 'Galaxy Turf Arena',
      mode: 'STANDARD',
      amount_per_player: 80
    };

    // 10 active players
    const mockRegistrations = Array.from({ length: 10 }, (_, i) => ({
      user_id: `user-${i + 1}`,
      response: 'IN',
      joined_at: `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`,
      profile: {
        id: `user-${i + 1}`,
        username: `Player ${i + 1}`,
        role: 'player',
        jersey_number: i + 1,
        position: 'MID'
      }
    }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'games') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockGame, error: null })
        };
      }
      if (table === 'game_registrations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockRegistrations, error: null })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });

    delete (window as any).location;
    window.location = new URL('http://localhost/matches/new?game_id=game-100') as any;

    render(
      <MemoryRouter initialEntries={['/matches/new?game_id=game-100']}>
        <NewMatch />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Game Day Squad Loaded \(10 Players\)/i)).toBeInTheDocument();
    });

    // Check prefilled inputs
    const locationInput = screen.getByDisplayValue('Galaxy Turf Arena');
    expect(locationInput).toBeInTheDocument();

    const dateInput = screen.getByDisplayValue('2026-11-20');
    expect(dateInput).toBeInTheDocument();

    const timeInput = screen.getByDisplayValue('20:30');
    expect(timeInput).toBeInTheDocument();
  });

  it('enforces Case 2: strictly limits roster to 10 players when 12 players joined, ignoring players 11-12', async () => {
    const mockGame = {
      id: 'game-101',
      game_date: '2026-11-20',
      start_time: '19:00',
      location: 'Turf A',
      mode: 'STANDARD'
    };

    // 12 registered players (short of 15)
    const mockRegistrations = Array.from({ length: 12 }, (_, i) => ({
      user_id: `user-${i + 1}`,
      response: 'IN',
      joined_at: `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`,
      profile: {
        id: `user-${i + 1}`,
        username: `Player ${i + 1}`,
        role: 'player'
      }
    }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'games') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockGame, error: null })
        };
      }
      if (table === 'game_registrations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockRegistrations, error: null })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });

    delete (window as any).location;
    window.location = new URL('http://localhost/matches/new?game_id=game-101') as any;

    render(
      <MemoryRouter initialEntries={['/matches/new?game_id=game-101']}>
        <NewMatch />
      </MemoryRouter>
    );

    // Confirms ONLY 10 players are loaded (players 11-12 ignored per Case 2)
    await waitFor(() => {
      expect(screen.getByText(/Game Day Squad Loaded \(10 Players\)/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText('Player 10').length).toBeGreaterThan(0);
    expect(screen.queryByText('Player 11')).not.toBeInTheDocument();
    expect(screen.queryByText('Player 12')).not.toBeInTheDocument();
  });

  it('loads all 15 players and sets WINNER_STAYS mode when 15 players confirmed', async () => {
    const mockGame = {
      id: 'game-102',
      game_date: '2026-11-20',
      start_time: '19:00',
      location: 'Turf A',
      mode: 'WINNER_STAYS'
    };

    const mockRegistrations = Array.from({ length: 15 }, (_, i) => ({
      user_id: `user-${i + 1}`,
      response: 'IN',
      joined_at: `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`,
      profile: {
        id: `user-${i + 1}`,
        username: `Player ${i + 1}`,
        role: 'player'
      }
    }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'games') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockGame, error: null })
        };
      }
      if (table === 'game_registrations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockRegistrations, error: null })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });

    delete (window as any).location;
    window.location = new URL('http://localhost/matches/new?game_id=game-102') as any;

    render(
      <MemoryRouter initialEntries={['/matches/new?game_id=game-102']}>
        <NewMatch />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Game Day Squad Loaded \(15 Players\)/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText('Player 15').length).toBeGreaterThan(0);
  });

  it('uses 2 teams for a 10-player squad, and Show all players adds people outside the squad', async () => {
    // Game was promoted to Winner Stays earlier, but only 10 are IN now
    const mockGame = { id: 'game-102', game_date: '2026-11-20', start_time: '19:00', location: 'Turf', mode: 'WINNER_STAYS' };
    const regs = Array.from({ length: 10 }, (_, i) => ({
      user_id: `user-${i + 1}`,
      response: 'IN',
      joined_at: `2026-11-11T10:${i.toString().padStart(2, '0')}:00Z`,
      profile: { id: `user-${i + 1}`, username: `Player ${i + 1}`, role: 'player' }
    }));
    const everyone = [...regs.map((r) => r.profile), { id: 'walk-in', username: 'Walk In Wally', role: 'player' }];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'games') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockGame, error: null }) };
      }
      if (table === 'game_registrations') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: regs, error: null }) };
      }
      return { select: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: everyone, error: null }) };
    });

    delete (window as any).location;
    window.location = new URL('http://localhost/matches/new?game_id=game-102') as any;

    render(
      <MemoryRouter initialEntries={['/matches/new?game_id=game-102']}>
        <NewMatch />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/Game Day Squad Loaded \(10 Players\)/i)).toBeInTheDocument());
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('STANDARD');
    expect(screen.queryByText('Team C')).not.toBeInTheDocument();
    expect(screen.queryByText('Walk In Wally')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Show all players/i }));
    await waitFor(() => expect(screen.getAllByText('Walk In Wally').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Not in squad/i).length).toBeGreaterThan(0);
  });
});
