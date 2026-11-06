import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewMatch, { getTeamBadgeText } from '../NewMatch';
import { supabase } from '../../lib/supabase';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock ToastContext
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  dismiss: vi.fn(),
  clearAll: vi.fn(),
};

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

// Mock Supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

const mockPlayers = Array.from({ length: 30 }, (_, i) => ({
  id: `player-${String(i + 1).padStart(2, '0')}`,
  username: `User_${String(i + 1).padStart(2, '0')}`,
  role: 'player',
}));

function setupSupabaseMocks(options?: { sessionError?: Error }) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue({
          then: (cb: (res: { data: typeof mockPlayers; error: null }) => void) =>
            Promise.resolve(cb({ data: mockPlayers, error: null })),
        }),
      } as any;
    }

    if (table === 'sessions') {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              if (options?.sessionError) {
                return Promise.resolve({ data: null, error: options.sessionError });
              }
              return Promise.resolve({
                data: { id: 'session-7v7-test', mode: 'SPECIAL_7V7', status: 'SCHEDULED' },
                error: null,
              });
            }),
          }),
        }),
      } as any;
    }

    if (table === 'teams') {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [
              { id: 'team-a-id', name: 'Team A' },
              { id: 'team-b-id', name: 'Team B' },
            ],
            error: null,
          }),
        }),
      } as any;
    }

    if (table === 'team_players') {
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any;
    }

    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
    } as any;
  });
}

describe('NewMatch: 7v7 Special Mode (SPECIAL_7V7) Unit Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMocks();

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  describe('1. Dynamic Badge Helper (getTeamBadgeText)', () => {
    it('returns correct starter and sub progression for SPECIAL_7V7', () => {
      // Less than 7 starters
      expect(getTeamBadgeText('SPECIAL_7V7', 0)).toBe('0/7 Starters');
      expect(getTeamBadgeText('SPECIAL_7V7', 1)).toBe('1/7 Starters');
      expect(getTeamBadgeText('SPECIAL_7V7', 6)).toBe('6/7 Starters');

      // Exactly 7 starters
      expect(getTeamBadgeText('SPECIAL_7V7', 7)).toBe('7 Starters');

      // More than 7 starters: singular 'Sub' vs plural 'Subs'
      expect(getTeamBadgeText('SPECIAL_7V7', 8)).toBe('7 Starters + 1 Sub');
      expect(getTeamBadgeText('SPECIAL_7V7', 9)).toBe('7 Starters + 2 Subs');
      expect(getTeamBadgeText('SPECIAL_7V7', 10)).toBe('7 Starters + 3 Subs');
    });

    it('falls back to generic player count for other modes', () => {
      expect(getTeamBadgeText('STANDARD', 0)).toBe('0 Players');
      expect(getTeamBadgeText('STANDARD', 5)).toBe('5 Players');
      expect(getTeamBadgeText('WINNER_STAYS', 7)).toBe('7 Players');
    });
  });

  describe('2. Mode Selection & Two-Team Direct Layout', () => {
    it('renders the 7v7 Special Mode option in the mode dropdown and updates state on selection', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox') as HTMLSelectElement;
      const specialOption = screen.getByRole('option', { name: '7v7 Special Mode' }) as HTMLOptionElement;

      expect(specialOption).toBeInTheDocument();
      expect(specialOption.value).toBe('SPECIAL_7V7');

      // Change mode to SPECIAL_7V7
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });
      expect(modeSelect.value).toBe('SPECIAL_7V7');
    });

    it('renders exactly Team A and Team B without number-of-teams selector or Teams C/D/E', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      // Number of teams selector must NOT be rendered
      expect(screen.queryByLabelText(/number of teams/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/3 teams/i)).not.toBeInTheDocument();

      // Team A and Team B must be rendered
      expect(screen.getByText('Team A')).toBeInTheDocument();
      expect(screen.getByText('Team B')).toBeInTheDocument();

      // Teams C, D, and E must NOT be rendered
      expect(screen.queryByText('Team C')).not.toBeInTheDocument();
      expect(screen.queryByText('Team D')).not.toBeInTheDocument();
      expect(screen.queryByText('Team E')).not.toBeInTheDocument();

      // Exactly 60 checkboxes: 30 for Team A + 30 for Team B
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(60);
    });

    it('clears Teams C, D, and E when switching from WINNER_STAYS to SPECIAL_7V7 without ghost lockout', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      // 1. Switch to WINNER_STAYS
      fireEvent.change(modeSelect, { target: { value: 'WINNER_STAYS' } });
      expect(screen.getByText('Team C')).toBeInTheDocument();

      const checkboxesWinnerStays = screen.getAllByRole('checkbox');
      const teamCCheckboxes = checkboxesWinnerStays.slice(60, 90);

      // Select Player 1 in Team C
      fireEvent.click(teamCCheckboxes[0]);

      // Verify Player 1 is disabled in Team A because assigned to Team C
      const teamACheckboxes = checkboxesWinnerStays.slice(0, 30);
      expect(teamACheckboxes[0]).toBeDisabled();

      // 2. Switch to SPECIAL_7V7
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      // Teams C is no longer displayed
      expect(screen.queryByText('Team C')).not.toBeInTheDocument();

      // Player 1 must now be enabled in Team A (state cleaned up, no ghost assignment)
      const specialCheckboxes = screen.getAllByRole('checkbox');
      const specialTeamACheckboxes = specialCheckboxes.slice(0, 30);
      expect(specialTeamACheckboxes[0]).not.toBeDisabled();
      expect(specialTeamACheckboxes[0]).not.toBeChecked();
    });
  });

  describe('3. Dynamic Squad Capacity (Max 10 Players per Team)', () => {
    it('allows selecting up to 10 players for a team, locking remaining unselected players', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 10 players in Team A (indices 0..9)
      for (let i = 0; i < 10; i++) {
        expect(teamACheckboxes[i]).not.toBeDisabled();
        fireEvent.click(teamACheckboxes[i]);
      }

      // Check badge shows 7 Starters + 3 Subs
      expect(screen.getByText('7 Starters + 3 Subs')).toBeInTheDocument();

      // 11th through 30th player on Team A must now be disabled (capacity locked)
      for (let i = 10; i < 30; i++) {
        expect(teamACheckboxes[i]).toBeDisabled();
      }

      // The 10 selected players on Team A MUST remain enabled (clickable for deselection)
      for (let i = 0; i < 10; i++) {
        expect(teamACheckboxes[i]).not.toBeDisabled();
        expect(teamACheckboxes[i]).toBeChecked();
      }

      // Selected players on Team A must be disabled on Team B (assigned elsewhere)
      for (let i = 0; i < 10; i++) {
        expect(teamBCheckboxes[i]).toBeDisabled();
      }
    });

    it('re-enables unselected players when a selected player is removed from a full team', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);

      // Select 10 players in Team A
      for (let i = 0; i < 10; i++) {
        fireEvent.click(teamACheckboxes[i]);
      }

      expect(teamACheckboxes[10]).toBeDisabled();

      // Deselect 10th player (index 9)
      fireEvent.click(teamACheckboxes[9]);
      expect(teamACheckboxes[9]).not.toBeChecked();

      // Badge updates to 7 Starters + 2 Subs
      expect(screen.getByText('7 Starters + 2 Subs')).toBeInTheDocument();

      // 11th player (index 10) is now re-enabled
      expect(teamACheckboxes[10]).not.toBeDisabled();
    });
  });

  describe('4. Dynamic Badge Counter Progression in UI', () => {
    it('updates badge text dynamically as players are added and removed', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      // Both teams initially display 0/7 Starters
      expect(screen.getAllByText('0/7 Starters')).toHaveLength(2);

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);

      // Select 1 player -> 1/7 Starters
      fireEvent.click(teamACheckboxes[0]);
      expect(screen.getByText('1/7 Starters')).toBeInTheDocument();

      // Select 6 more players (total 7) -> 7 Starters
      for (let i = 1; i < 7; i++) {
        fireEvent.click(teamACheckboxes[i]);
      }
      expect(screen.getByText('7 Starters')).toBeInTheDocument();

      // Select 8th player -> 7 Starters + 1 Sub
      fireEvent.click(teamACheckboxes[7]);
      expect(screen.getByText('7 Starters + 1 Sub')).toBeInTheDocument();

      // Select 9th player -> 7 Starters + 2 Subs
      fireEvent.click(teamACheckboxes[8]);
      expect(screen.getByText('7 Starters + 2 Subs')).toBeInTheDocument();

      // Select 10th player -> 7 Starters + 3 Subs
      fireEvent.click(teamACheckboxes[9]);
      expect(screen.getByText('7 Starters + 3 Subs')).toBeInTheDocument();

      // Deselect 1 player -> decreases back to 7 Starters + 2 Subs
      fireEvent.click(teamACheckboxes[9]);
      expect(screen.getByText('7 Starters + 2 Subs')).toBeInTheDocument();
    });
  });

  describe('5. Match Scheduling Validation (Min 7 Starters Enforcement)', () => {
    it('blocks scheduling and displays warning toast when both teams have 0 players', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      expect(mockToast.warning).toHaveBeenCalledWith(
        'Both teams need at least 7 starters for 7v7 Special Mode.'
      );
      expect(supabase.from).not.toHaveBeenCalledWith('sessions');
    });

    it('blocks scheduling when Team A has only 6 starters (< 7) and Team B has 7 starters', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 6 in Team A
      for (let i = 0; i < 6; i++) fireEvent.click(teamACheckboxes[i]);
      // Select 7 in Team B
      for (let i = 6; i < 13; i++) fireEvent.click(teamBCheckboxes[i]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      expect(mockToast.warning).toHaveBeenCalledWith(
        'Both teams need at least 7 starters for 7v7 Special Mode.'
      );
      expect(supabase.from).not.toHaveBeenCalledWith('sessions');
    });

    it('blocks scheduling when Team A has 7 starters and Team B has only 6 starters (< 7)', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 7 in Team A
      for (let i = 0; i < 7; i++) fireEvent.click(teamACheckboxes[i]);
      // Select 6 in Team B
      for (let i = 7; i < 13; i++) fireEvent.click(teamBCheckboxes[i]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      expect(mockToast.warning).toHaveBeenCalledWith(
        'Both teams need at least 7 starters for 7v7 Special Mode.'
      );
      expect(supabase.from).not.toHaveBeenCalledWith('sessions');
    });

    it('successfully schedules match when both teams have at least 7 starters', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 8 players in Team A (7 starters + 1 sub)
      for (let i = 0; i < 8; i++) fireEvent.click(teamACheckboxes[i]);
      // Select 7 players in Team B (7 starters)
      for (let i = 8; i < 15; i++) fireEvent.click(teamBCheckboxes[i]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('Match Scheduled!')).toBeInTheDocument();
      });

      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(supabase.from).toHaveBeenCalledWith('teams');
      expect(supabase.from).toHaveBeenCalledWith('team_players');
      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', expect.any(Object));
      expect(mockToast.warning).not.toHaveBeenCalled();
    });
  });

  describe('6. WhatsApp Match Details Share Formatting', () => {
    it('formats WhatsApp details copy with 7v7 Special Mode and Starter/Sub labels', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Team A: 9 players (7 starters, 2 subs)
      for (let i = 0; i < 9; i++) fireEvent.click(teamACheckboxes[i]);
      // Team B: 7 players (7 starters, 0 subs)
      for (let i = 9; i < 16; i++) fireEvent.click(teamBCheckboxes[i]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('Match Scheduled!')).toBeInTheDocument();
      });

      const summary = screen.getByText(/🏆 \*New Match Scheduled!\* 🏆/i).textContent || '';

      // Mode label
      expect(summary).toContain('🎯 Mode: 7v7 Special Mode');

      // Team A Starters (indices 0..6: User_01 to User_07)
      expect(summary).toContain('• User_01 (Starter)');
      expect(summary).toContain('• User_07 (Starter)');

      // Team A Subs (indices 7..8: User_08 and User_09)
      expect(summary).toContain('• User_08 (Sub)');
      expect(summary).toContain('• User_09 (Sub)');

      // Team B Starters (indices 0..6: User_10 to User_16)
      expect(summary).toContain('• User_10 (Starter)');
      expect(summary).toContain('• User_16 (Starter)');
      expect(summary).not.toContain('• User_10 (Sub)');
    });

    it('copies formatted details to clipboard when Copy Details button is clicked', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      for (let i = 0; i < 7; i++) fireEvent.click(teamACheckboxes[i]);
      for (let i = 7; i < 14; i++) fireEvent.click(teamBCheckboxes[i]);

      fireEvent.click(screen.getByRole('button', { name: /schedule match/i }));

      await waitFor(() => {
        expect(screen.getByText('Match Scheduled!')).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy details/i });
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('🎯 Mode: 7v7 Special Mode')
      );
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('navigates to /matches when Go to Matches button is clicked', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      for (let i = 0; i < 7; i++) fireEvent.click(teamACheckboxes[i]);
      for (let i = 7; i < 14; i++) fireEvent.click(teamBCheckboxes[i]);

      fireEvent.click(screen.getByRole('button', { name: /schedule match/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to matches/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /go to matches/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/matches');
    });
  });

  describe('7. Error Handling on Match Creation', () => {
    it('shows toast error when session creation fails', async () => {
      setupSupabaseMocks({ sessionError: new Error('Database connection failed') });

      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByRole('combobox');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      for (let i = 0; i < 7; i++) fireEvent.click(teamACheckboxes[i]);
      for (let i = 7; i < 14; i++) fireEvent.click(teamBCheckboxes[i]);

      fireEvent.click(screen.getByRole('button', { name: /schedule match/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to create match: Database connection failed');
      });

      // Does not show Match Scheduled screen
      expect(screen.queryByText('Match Scheduled!')).not.toBeInTheDocument();
      // Schedule button is re-enabled
      expect(screen.getByRole('button', { name: /schedule match/i })).not.toBeDisabled();
    });
  });
});
