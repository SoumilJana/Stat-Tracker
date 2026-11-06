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

// Mock Supabase
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

function setupSupabaseMocks() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue({
          then: (cb: (res: { data: any[]; error: any }) => void) =>
            Promise.resolve(cb({ data: mockPlayers, error: null })),
        }),
      } as any;
    }

    if (table === 'sessions') {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'session-7v7-test', mode: 'SPECIAL_7V7', status: 'SCHEDULED' },
              error: null,
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

describe('Milestone 2: New Match Configuration & Validation Adversarial Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMocks();
  });

  describe('Focus 1: Squad Capacity & Checkbox Disable Stress-Test', () => {
    it('verifies getTeamBadgeText helper across all boundary counts (0, 1, 6, 7, 8, 9, 10, 11) for all modes', () => {
      // SPECIAL_7V7
      expect(getTeamBadgeText('SPECIAL_7V7', 0)).toBe('0/7 Starters');
      expect(getTeamBadgeText('SPECIAL_7V7', 1)).toBe('1/7 Starters');
      expect(getTeamBadgeText('SPECIAL_7V7', 6)).toBe('6/7 Starters');
      expect(getTeamBadgeText('SPECIAL_7V7', 7)).toBe('7 Starters');
      expect(getTeamBadgeText('SPECIAL_7V7', 8)).toBe('7 Starters + 1 Sub');
      expect(getTeamBadgeText('SPECIAL_7V7', 9)).toBe('7 Starters + 2 Subs');
      expect(getTeamBadgeText('SPECIAL_7V7', 10)).toBe('7 Starters + 3 Subs');
      expect(getTeamBadgeText('SPECIAL_7V7', 11)).toBe('7 Starters + 4 Subs');

      // STANDARD: (0, 1, 6, 7, 8, 9, 10, 11)
      expect(getTeamBadgeText('STANDARD', 0)).toBe('0 Players');
      expect(getTeamBadgeText('STANDARD', 1)).toBe('1 Players');
      expect(getTeamBadgeText('STANDARD', 6)).toBe('6 Players');
      expect(getTeamBadgeText('STANDARD', 7)).toBe('7 Players');
      expect(getTeamBadgeText('STANDARD', 8)).toBe('8 Players');
      expect(getTeamBadgeText('STANDARD', 9)).toBe('9 Players');
      expect(getTeamBadgeText('STANDARD', 10)).toBe('10 Players');
      expect(getTeamBadgeText('STANDARD', 11)).toBe('11 Players');

      // WINNER_STAYS: (0, 1, 6, 7, 8, 9, 10, 11)
      expect(getTeamBadgeText('WINNER_STAYS', 0)).toBe('0 Players');
      expect(getTeamBadgeText('WINNER_STAYS', 1)).toBe('1 Players');
      expect(getTeamBadgeText('WINNER_STAYS', 6)).toBe('6 Players');
      expect(getTeamBadgeText('WINNER_STAYS', 7)).toBe('7 Players');
      expect(getTeamBadgeText('WINNER_STAYS', 8)).toBe('8 Players');
      expect(getTeamBadgeText('WINNER_STAYS', 9)).toBe('9 Players');
      expect(getTeamBadgeText('WINNER_STAYS', 10)).toBe('10 Players');
      expect(getTeamBadgeText('WINNER_STAYS', 11)).toBe('11 Players');

      // Edge cases: negative, large, fallback
      expect(getTeamBadgeText('SPECIAL_7V7', -1)).toBe('-1/7 Starters');
      expect(getTeamBadgeText('SPECIAL_7V7', 100)).toBe('7 Starters + 93 Subs');
      expect(getTeamBadgeText('special_7v7', 7)).toBe('7 Players');
      expect(getTeamBadgeText('', 7)).toBe('7 Players');
      expect(getTeamBadgeText('UNKNOWN', 7)).toBe('7 Players');
    });

    it('enforces strictly 5-player cap in STANDARD mode for both teams', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      // Default mode is STANDARD.
      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 5 players in Team A (indices 0..4)
      for (let i = 0; i < 5; i++) {
        expect(teamACheckboxes[i]).not.toBeDisabled();
        fireEvent.click(teamACheckboxes[i]);
      }

      // Check badge shows 5 Players
      expect(screen.getByText('5 Players')).toBeInTheDocument();

      // 6th player in Team A must be DISABLED because max capacity is 5
      expect(teamACheckboxes[5]).toBeDisabled();
      expect(teamACheckboxes[6]).toBeDisabled();

      // Any of the 5 already selected players MUST remain enabled for deselection
      for (let i = 0; i < 5; i++) {
        expect(teamACheckboxes[i]).not.toBeDisabled();
        expect(teamACheckboxes[i]).toBeChecked();
      }

      // Select 5 players in Team B (indices 5..9)
      for (let i = 5; i < 10; i++) {
        expect(teamBCheckboxes[i]).not.toBeDisabled();
        fireEvent.click(teamBCheckboxes[i]);
      }

      // 6th player in Team B (index 10) must be disabled
      expect(teamBCheckboxes[10]).toBeDisabled();

      // Selected players from Team A (0..4) are disabled in Team B (assigned elsewhere)
      for (let i = 0; i < 5; i++) {
        expect(teamBCheckboxes[i]).toBeDisabled();
      }

      // Selected players from Team B (5..9) are disabled in Team A (assigned elsewhere)
      for (let i = 5; i < 10; i++) {
        expect(teamACheckboxes[i]).toBeDisabled();
      }

      // Deselect 1 player from Team A (index 4)
      fireEvent.click(teamACheckboxes[4]);
      expect(teamACheckboxes[4]).not.toBeChecked();

      // Team A now has 4 players (< 5), so unassigned player (index 10) becomes enabled in Team A
      expect(teamACheckboxes[10]).not.toBeDisabled();

      // Deselect 1 player from Team B (index 9)
      fireEvent.click(teamBCheckboxes[9]);
      expect(teamBCheckboxes[9]).not.toBeChecked();

      // Team B now has 4 players (< 5), so index 4 (now unassigned anywhere) becomes enabled in Team B
      expect(teamBCheckboxes[4]).not.toBeDisabled();
    });

    it('enforces exactly 10-player cap in SPECIAL_7V7 mode, disabling the 11th player', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      // Switch mode to SPECIAL_7V7
      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 10 players into Team A (indices 0..9)
      for (let i = 0; i < 10; i++) {
        expect(teamACheckboxes[i]).not.toBeDisabled();
        fireEvent.click(teamACheckboxes[i]);
      }

      // Badge must show 7 Starters + 3 Subs
      expect(screen.getByText('7 Starters + 3 Subs')).toBeInTheDocument();

      // 11th through 30th players in Team A MUST be disabled
      for (let i = 10; i < 30; i++) {
        expect(teamACheckboxes[i]).toBeDisabled();
      }

      // All 10 selected players in Team A MUST remain enabled (for deselection)
      for (let i = 0; i < 10; i++) {
        expect(teamACheckboxes[i]).not.toBeDisabled();
        expect(teamACheckboxes[i]).toBeChecked();
      }

      // All 10 selected players MUST be disabled in Team B (assigned elsewhere)
      for (let i = 0; i < 10; i++) {
        expect(teamBCheckboxes[i]).toBeDisabled();
      }

      // Deselect player 10 (index 9)
      fireEvent.click(teamACheckboxes[9]);
      expect(teamACheckboxes[9]).not.toBeChecked();

      // Badge should update to 7 Starters + 2 Subs
      expect(screen.getByText('7 Starters + 2 Subs')).toBeInTheDocument();

      // The 11th player in Team A must now become ENABLED
      expect(teamACheckboxes[10]).not.toBeDisabled();
    });

    it('promotes first substitute to starter when initial starter is deselected in SPECIAL_7V7', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 8 players in Team A: User_01..User_07 (Starters), User_08 (Sub)
      for (let i = 0; i < 8; i++) fireEvent.click(teamACheckboxes[i]);
      // Select 7 players in Team B: User_09..User_15
      for (let i = 8; i < 15; i++) fireEvent.click(teamBCheckboxes[i]);

      // Deselect User_01 from Team A
      fireEvent.click(teamACheckboxes[0]);
      expect(teamACheckboxes[0]).not.toBeChecked();

      // Team A now has 7 players: User_02..User_08.
      // Team B also has 7 players. Both show "7 Starters" badge!
      const starterBadges = screen.getAllByText('7 Starters');
      expect(starterBadges).toHaveLength(2);

      // Schedule match to inspect formatting of promoted player
      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('Match Scheduled!')).toBeInTheDocument();
      });

      const summaryText = screen.getByText(/🏆 \*New Match Scheduled!\* 🏆/i).textContent || '';
      // User_08 was previously Sub, now in index 6, so User_08 must be a (Starter), NOT a (Sub)
      expect(summaryText).toContain('• User_08 (Starter)');
      expect(summaryText).not.toContain('• User_08 (Sub)');
    });
  });

  describe('Focus 2: Mode Switching Hazard & Ghost Player Cleanup', () => {
    it('purges Teams C, D, and E when switching from 5-team WINNER_STAYS to SPECIAL_7V7', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      // 1. Switch to WINNER_STAYS mode
      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'WINNER_STAYS' } });

      // Change number of teams to 5
      const numTeamsSelect = screen.getByDisplayValue('3 Teams');
      fireEvent.change(numTeamsSelect, { target: { value: '5' } });

      // Verify Teams C, D, E exist in UI
      expect(screen.getByText('Team C')).toBeInTheDocument();
      expect(screen.getByText('Team D')).toBeInTheDocument();
      expect(screen.getByText('Team E')).toBeInTheDocument();

      // 5 teams x 30 players = 150 checkboxes
      let allCheckboxes = screen.getAllByRole('checkbox');
      expect(allCheckboxes).toHaveLength(150);

      const teamCCheckboxes = allCheckboxes.slice(60, 90);
      const teamDCheckboxes = allCheckboxes.slice(90, 120);
      const teamECheckboxes = allCheckboxes.slice(120, 150);

      // Assign Player 1 to Team C, Player 2 to Team D, Player 3 to Team E
      fireEvent.click(teamCCheckboxes[0]); // User_01
      fireEvent.click(teamDCheckboxes[1]); // User_02
      fireEvent.click(teamECheckboxes[2]); // User_03

      // In Team A, Player 1, 2, 3 must be disabled (assigned elsewhere)
      allCheckboxes = screen.getAllByRole('checkbox');
      const teamACheckboxesBeforeSwitch = allCheckboxes.slice(0, 30);
      expect(teamACheckboxesBeforeSwitch[0]).toBeDisabled();
      expect(teamACheckboxesBeforeSwitch[1]).toBeDisabled();
      expect(teamACheckboxesBeforeSwitch[2]).toBeDisabled();

      // 2. Switch mode from WINNER_STAYS to SPECIAL_7V7
      fireEvent.change(screen.getByDisplayValue('Winner Stays'), { target: { value: 'SPECIAL_7V7' } });

      // Teams C, D, E should no longer be rendered
      expect(screen.queryByText('Team C')).not.toBeInTheDocument();
      expect(screen.queryByText('Team D')).not.toBeInTheDocument();
      expect(screen.queryByText('Team E')).not.toBeInTheDocument();

      // Checkboxes are now just Team A (0..29) and Team B (30..59)
      const newCheckboxes = screen.getAllByRole('checkbox');
      expect(newCheckboxes).toHaveLength(60);
      const teamACheckboxesAfterSwitch = newCheckboxes.slice(0, 30);
      const teamBCheckboxesAfterSwitch = newCheckboxes.slice(30, 60);

      // CRITICAL ASSERTION: Players 1, 2, 3 were on Teams C, D, E, which were purged by the cleanup effect.
      // Therefore, NONE of them should be locked out in Team A or Team B!
      for (let i = 0; i < 3; i++) {
        expect(teamACheckboxesAfterSwitch[i]).not.toBeDisabled();
        expect(teamACheckboxesAfterSwitch[i]).not.toBeChecked();

        expect(teamBCheckboxesAfterSwitch[i]).not.toBeDisabled();
        expect(teamBCheckboxesAfterSwitch[i]).not.toBeChecked();
      }

      // And User_01 can now be checked for Team A
      fireEvent.click(teamACheckboxesAfterSwitch[0]);
      expect(teamACheckboxesAfterSwitch[0]).toBeChecked();
    });

    it('purges Teams C, D, and E when switching from WINNER_STAYS to STANDARD', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'WINNER_STAYS' } });

      let allCheckboxes = screen.getAllByRole('checkbox');
      const teamCCheckboxes = allCheckboxes.slice(60, 90);

      // Assign Player 5 to Team C
      fireEvent.click(teamCCheckboxes[4]);

      // Switch back to STANDARD
      fireEvent.change(screen.getByDisplayValue('Winner Stays'), { target: { value: 'STANDARD' } });
      expect(screen.queryByText('Team C')).not.toBeInTheDocument();

      const standardCheckboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = standardCheckboxes.slice(0, 30);

      // Player 5 must NOT be disabled
      expect(teamACheckboxes[4]).not.toBeDisabled();
    });
  });

  describe('Focus 3: Match Scheduling Validation for SPECIAL_7V7', () => {
    it('blocks scheduling when Team A has fewer than 7 starters', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 6 players in Team A, 7 players in Team B
      for (let i = 0; i < 6; i++) fireEvent.click(teamACheckboxes[i]);
      for (let i = 6; i < 13; i++) fireEvent.click(teamBCheckboxes[i]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      expect(mockToast.warning).toHaveBeenCalledWith(
        'Both teams need at least 7 starters for 7v7 Special Mode.'
      );
      expect(supabase.from).not.toHaveBeenCalledWith('sessions');
    });

    it('blocks scheduling when Team B has fewer than 7 starters', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 7 players in Team A, 6 players in Team B
      for (let i = 0; i < 7; i++) fireEvent.click(teamACheckboxes[i]);
      for (let i = 7; i < 13; i++) fireEvent.click(teamBCheckboxes[i]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      expect(mockToast.warning).toHaveBeenCalledWith(
        'Both teams need at least 7 starters for 7v7 Special Mode.'
      );
      expect(supabase.from).not.toHaveBeenCalledWith('sessions');
    });

    it('successfully schedules match and shows success summary with (Starter) and (Sub) markers', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Team A gets 8 players (7 starters, 1 sub)
      for (let i = 0; i < 8; i++) fireEvent.click(teamACheckboxes[i]);
      // Team B gets 7 players (7 starters, 0 subs)
      for (let i = 8; i < 15; i++) fireEvent.click(teamBCheckboxes[i]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('Match Scheduled!')).toBeInTheDocument();
      });

      // Verify sessions table called with SPECIAL_7V7
      expect(supabase.from).toHaveBeenCalledWith('sessions');

      // Verify WhatsApp match details summary text
      const summaryContainer = screen.getByText(/🏆 \*New Match Scheduled!\* 🏆/i);
      const summaryText = summaryContainer.textContent || '';
      expect(summaryText).toContain('🎯 Mode: 7v7 Special Mode');
      expect(summaryText).toContain('• User_01 (Starter)');
      expect(summaryText).toContain('• User_07 (Starter)');
      expect(summaryText).toContain('• User_08 (Sub)');
      expect(summaryText).toContain('• User_09 (Starter)');
    });

    it('passes validation when Team A has exactly 7 starters and Team B has exactly 7 starters', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Exactly 7 in Team A
      for (let i = 0; i < 7; i++) fireEvent.click(teamACheckboxes[i]);
      // Exactly 7 in Team B
      for (let i = 7; i < 14; i++) fireEvent.click(teamBCheckboxes[i]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('Match Scheduled!')).toBeInTheDocument();
      });

      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(mockToast.warning).not.toHaveBeenCalled();
    });

    it('restores Standard formatting without role tags when switching back to Standard mode', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByDisplayValue('Standard Match');
      // Switch to SPECIAL_7V7 first
      fireEvent.change(modeSelect, { target: { value: 'SPECIAL_7V7' } });
      // Switch back to STANDARD
      fireEvent.change(modeSelect, { target: { value: 'STANDARD' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Select 1 player in Team A, 1 in Team B
      fireEvent.click(teamACheckboxes[0]); // User_01
      fireEvent.click(teamBCheckboxes[1]); // User_02

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('Match Scheduled!')).toBeInTheDocument();
      });

      const summaryContainer = screen.getByText(/🏆 \*New Match Scheduled!\* 🏆/i);
      const summaryText = summaryContainer.textContent || '';
      expect(summaryText).toContain('🎯 Mode: Standard Match');
      expect(summaryText).toContain('• User_01');
      expect(summaryText).toContain('• User_02');
      expect(summaryText).not.toContain('(Starter)');
      expect(summaryText).not.toContain('(Sub)');
    });

    it('allows Standard mode with 1 player per team to schedule normally', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      // Default mode is STANDARD
      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      fireEvent.click(teamACheckboxes[0]); // 1 player in Team A
      fireEvent.click(teamBCheckboxes[1]); // 1 player in Team B

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      await waitFor(() => {
        expect(screen.getByText('Match Scheduled!')).toBeInTheDocument();
      });

      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(mockToast.warning).not.toHaveBeenCalled();
    });

    it('blocks Standard mode when Team A or Team B is empty', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      // 0 players on both teams
      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      expect(mockToast.warning).toHaveBeenCalledWith('Team A and Team B need at least 1 player.');
      expect(supabase.from).not.toHaveBeenCalledWith('sessions');
    });

    it('blocks Winner Stays mode when Team C is empty', async () => {
      render(<NewMatch />);
      await waitFor(() => {
        expect(screen.getAllByText('User_01').length).toBeGreaterThan(0);
      });

      const modeSelect = screen.getByDisplayValue('Standard Match');
      fireEvent.change(modeSelect, { target: { value: 'WINNER_STAYS' } });

      const checkboxes = screen.getAllByRole('checkbox');
      const teamACheckboxes = checkboxes.slice(0, 30);
      const teamBCheckboxes = checkboxes.slice(30, 60);

      // Team A has 1, Team B has 1, Team C has 0
      fireEvent.click(teamACheckboxes[0]);
      fireEvent.click(teamBCheckboxes[1]);

      const scheduleButton = screen.getByRole('button', { name: /schedule match/i });
      fireEvent.click(scheduleButton);

      expect(mockToast.warning).toHaveBeenCalledWith('Team C needs at least 1 player for Winner Stays.');
      expect(supabase.from).not.toHaveBeenCalledWith('sessions');
    });
  });
});

