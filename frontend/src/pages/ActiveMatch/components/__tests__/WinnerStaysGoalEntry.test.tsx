import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WinnerStaysGoalEntry } from '../WinnerStaysGoalEntry';

describe('WinnerStaysGoalEntry Component', () => {
  const adminProfile = { id: 'admin-1', username: 'Referee', role: 'admin' };
  const userProfile = { id: 'user-1', username: 'Spectator', role: 'user' };

  const activeSession = {
    id: 'session-ws-1',
    mode: 'WINNER_STAYS',
    status: 'IN_PROGRESS'
  };

  const completedSession = {
    id: 'session-ws-1',
    mode: 'WINNER_STAYS',
    status: 'COMPLETED'
  };

  const teamA = { id: 'team-green-1', name: 'Team Green' };
  const teamB = { id: 'team-blue-2', name: 'Team Blue' };
  const teamC = { id: 'team-orange-3', name: 'Team Orange' };

  const mockTeamPlayers = {
    'team-green-1': [
      { id: 'p1', username: 'Alice', name: 'Alice' },
      { id: 'p2', username: 'Bob', name: 'Bob' },
      { id: 'p3', username: 'Charlie', name: 'Charlie' },
      { id: 'p4', username: 'David', name: 'David' }
    ],
    'team-blue-2': [
      { id: 'p5', username: 'Eve', name: 'Eve' },
      { id: 'p6', username: 'Frank', name: 'Frank' },
      { id: 'p7', username: 'Grace', name: 'Grace' },
      { id: 'p8', username: 'Heidi', name: 'Heidi' },
      { id: 'p9', username: 'Ivan', name: 'Ivan' }
    ],
    'team-orange-3': [
      { id: 'p10', username: 'Judy', name: 'Judy' },
      { id: 'p11', username: 'Mallory', name: 'Mallory' },
      { id: 'p12', username: 'Niaj', name: 'Niaj' },
      { id: 'p13', username: 'Olivia', name: 'Olivia' },
      { id: 'p14', username: 'Peggy', name: 'Peggy' },
      { id: 'p15', username: 'Rupert', name: 'Rupert' }
    ]
  };

  const mockEvents = [
    { id: 'ev-1', event_type: 'GOAL', player_id: 'p1', team_id: 'team-green-1' },
    { id: 'ev-2', event_type: 'GOAL', player_id: 'p1', team_id: 'team-green-1' },
    { id: 'ev-3', event_type: 'GOAL', player_id: 'p2', team_id: 'team-green-1' },
    { id: 'ev-4', event_type: 'GOAL', player_id: 'p5', team_id: 'team-blue-2' }
  ];

  // =========================================================================
  // 1. Team Switcher Tabs Rendering & Styling
  // =========================================================================
  describe('Team Switcher Tabs', () => {
    it('renders both team tabs with correct names and color themes', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={mockEvents}
          onInitiateGoal={vi.fn()}
        />
      );

      const tabTeamA = screen.getByRole('tab', { name: /Team Green/i });
      const tabTeamB = screen.getByRole('tab', { name: /Team Blue/i });

      expect(tabTeamA).toBeInTheDocument();
      expect(tabTeamB).toBeInTheDocument();

      // Team A is active initially: Green identity styling
      expect(tabTeamA).toHaveAttribute('aria-selected', 'true');
      expect(tabTeamA.className).toContain('bg-primary-500');
      expect(tabTeamA.className).toContain('text-neutral-950');
      expect(tabTeamA.className).toContain('border-primary-400');

      // Team B is inactive initially: Neutral styling
      expect(tabTeamB).toHaveAttribute('aria-selected', 'false');
      expect(tabTeamB.className).toContain('bg-neutral-900/80');
      expect(tabTeamB.className).toContain('text-neutral-400');
    });

    it('toggling tabs switches active team and applies blue identity to Team B', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={mockEvents}
          onInitiateGoal={vi.fn()}
        />
      );

      const tabTeamA = screen.getByRole('tab', { name: /Team Green/i });
      const tabTeamB = screen.getByRole('tab', { name: /Team Blue/i });

      // Click Team B tab
      fireEvent.click(tabTeamB);

      expect(tabTeamB).toHaveAttribute('aria-selected', 'true');
      expect(tabTeamB.className).toContain('bg-blue-500');
      expect(tabTeamB.className).toContain('text-neutral-950');
      expect(tabTeamB.className).toContain('border-blue-400');

      // Team A is now inactive
      expect(tabTeamA).toHaveAttribute('aria-selected', 'false');
      expect(tabTeamA.className).toContain('bg-neutral-900/80');
      expect(tabTeamA.className).toContain('text-neutral-400');
    });
  });

  // =========================================================================
  // 2. Roster Switching & Roster Display
  // =========================================================================
  describe('Roster Switching & Display', () => {
    it('switches the displayed player roster instantly when toggling tabs', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={mockEvents}
          onInitiateGoal={vi.fn()}
        />
      );

      // Initially Team Green's players are visible
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('David')).toBeInTheDocument();

      // Team Blue's players are not visible
      expect(screen.queryByText('Eve')).not.toBeInTheDocument();
      expect(screen.queryByText('Frank')).not.toBeInTheDocument();

      // Switch to Team Blue
      fireEvent.click(screen.getByRole('tab', { name: /Team Blue/i }));

      // Now Team Blue's players are visible
      expect(screen.getByText('Eve')).toBeInTheDocument();
      expect(screen.getByText('Frank')).toBeInTheDocument();
      expect(screen.getByText('Grace')).toBeInTheDocument();
      expect(screen.getByText('Heidi')).toBeInTheDocument();
      expect(screen.getByText('Ivan')).toBeInTheDocument();

      // Team Green's players are no longer visible
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });

    it('displays goal badges accurately for players who scored in match events', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={mockEvents}
          onInitiateGoal={vi.fn()}
        />
      );

      // Alice scored 2 goals
      const aliceBadge = screen.getByTestId('goal-badge-p1');
      expect(aliceBadge).toHaveTextContent('2G');

      // Bob scored 1 goal
      const bobBadge = screen.getByTestId('goal-badge-p2');
      expect(bobBadge).toHaveTextContent('1G');

      // Charlie scored 0 goals -> no badge
      expect(screen.queryByTestId('goal-badge-p3')).not.toBeInTheDocument();

      // Switch to Team Blue where Eve has 1 goal
      fireEvent.click(screen.getByRole('tab', { name: /Team Blue/i }));
      const eveBadge = screen.getByTestId('goal-badge-p5');
      expect(eveBadge).toHaveTextContent('1G');

      // Frank has 0 goals -> no badge
      expect(screen.queryByTestId('goal-badge-p6')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Goal Action Dispatch & Assist Modal Integration
  // =========================================================================
  describe('Goal Initiation Flow', () => {
    it('calls onInitiateGoal with (playerId, teamId, playersList) when tapping + GOAL', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={mockEvents}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      // Tap + GOAL pill for Alice
      const aliceGoalPill = screen.getByTestId('goal-action-p1');
      fireEvent.click(aliceGoalPill);

      expect(handleInitiateGoal).toHaveBeenCalledTimes(1);
      expect(handleInitiateGoal).toHaveBeenCalledWith(
        'p1',
        'team-green-1',
        mockTeamPlayers['team-green-1']
      );
    });

    it('calls onInitiateGoal when tapping anywhere on the player card', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={mockEvents}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      // Tap Bob's player card
      const bobCard = screen.getByTestId('player-card-p2');
      fireEvent.click(bobCard);

      expect(handleInitiateGoal).toHaveBeenCalledTimes(1);
      expect(handleInitiateGoal).toHaveBeenCalledWith(
        'p2',
        'team-green-1',
        mockTeamPlayers['team-green-1']
      );
    });

    it('passes correct teamId and player list when scoring for Team B', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={mockEvents}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      // Switch to Team Blue
      fireEvent.click(screen.getByRole('tab', { name: /Team Blue/i }));

      // Tap Frank's + GOAL action
      const frankGoalPill = screen.getByTestId('goal-action-p6');
      fireEvent.click(frankGoalPill);

      expect(handleInitiateGoal).toHaveBeenCalledTimes(1);
      expect(handleInitiateGoal).toHaveBeenCalledWith(
        'p6',
        'team-blue-2',
        mockTeamPlayers['team-blue-2']
      );
    });
  });

  // =========================================================================
  // 4. Admin vs Non-Admin Authorization & In-Progress Gating
  // =========================================================================
  describe('Authorization & Gating', () => {
    it('shows + GOAL buttons for admin in progress and allows action', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      const goalButtons = screen.getAllByText('+ GOAL');
      expect(goalButtons.length).toBe(4); // 4 players on Team Green

      const card = screen.getByTestId('player-card-p1');
      expect(card).not.toBeDisabled();
      fireEvent.click(card);
      expect(handleInitiateGoal).toHaveBeenCalledTimes(1);
    });

    it('hides + GOAL buttons and disables player cards for non-admin spectators', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={userProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      // + GOAL button is not rendered for non-admins
      expect(screen.queryByText('+ GOAL')).not.toBeInTheDocument();

      // Cards are rendered with disabled state (4 player card buttons + 2 tabs)
      const playerCards = screen.getAllByRole('button');
      expect(playerCards.length).toBe(4);
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(2);
      const playerCard = screen.getByTestId('player-card-p1');
      expect(playerCard).toBeDisabled();

      fireEvent.click(playerCard);
      expect(handleInitiateGoal).not.toHaveBeenCalled();
    });

    it('hides + GOAL buttons and disables cards when match status is not IN_PROGRESS', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={completedSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      expect(screen.queryByText('+ GOAL')).not.toBeInTheDocument();
      const card = screen.getByTestId('player-card-p1');
      expect(card).toBeDisabled();

      fireEvent.click(card);
      expect(handleInitiateGoal).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. In-flight Duplicate Submission Protection
  // =========================================================================
  describe('Duplicate Submission Protection (isSubmitting)', () => {
    it('disables goal action buttons and blocks clicks when isSubmitting is true', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          isSubmitting={true}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      const playerCard = screen.getByTestId('player-card-p1');
      expect(playerCard).toBeDisabled();
      expect(playerCard.className).toContain('opacity-50');
      expect(playerCard.className).toContain('cursor-not-allowed');

      fireEvent.click(playerCard);
      expect(handleInitiateGoal).not.toHaveBeenCalled();
    });

    it('re-enables buttons and permits clicks when isSubmitting transitions to false', () => {
      const handleInitiateGoal = vi.fn();

      const { rerender } = render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          isSubmitting={true}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      expect(screen.getByTestId('player-card-p1')).toBeDisabled();

      // Rerender after network request settles
      rerender(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          isSubmitting={false}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      const playerCard = screen.getByTestId('player-card-p1');
      expect(playerCard).not.toBeDisabled();

      fireEvent.click(playerCard);
      expect(handleInitiateGoal).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 6. Dynamic Roster Adaptation (4, 5, 6+ Players)
  // =========================================================================
  describe('Dynamic Roster Adaptation', () => {
    it('adapts cleanly to a 4-player roster', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      const cards = screen.getAllByTestId(/^player-card-/);
      expect(cards.length).toBe(4);
      cards.forEach((card) => {
        expect(card.className).toContain('min-h-[44px]');
      });
    });

    it('adapts cleanly to a 5-player roster', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // Switch to Team Blue (5 players)
      fireEvent.click(screen.getByRole('tab', { name: /Team Blue/i }));

      const cards = screen.getAllByTestId(/^player-card-/);
      expect(cards.length).toBe(5);
      expect(screen.getByText('Eve')).toBeInTheDocument();
      expect(screen.getByText('Frank')).toBeInTheDocument();
      expect(screen.getByText('Grace')).toBeInTheDocument();
      expect(screen.getByText('Heidi')).toBeInTheDocument();
      expect(screen.getByText('Ivan')).toBeInTheDocument();
    });

    it('adapts cleanly to a 6-player roster', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamC} // Team Orange has 6 players
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      const cards = screen.getAllByTestId(/^player-card-/);
      expect(cards.length).toBe(6);
      expect(screen.getByText('Judy')).toBeInTheDocument();
      expect(screen.getByText('Rupert')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 7. Auto-Healing & Self-Recovery When Pitch Teams Rotate
  // =========================================================================
  describe('Auto-Healing on Rotation', () => {
    it('auto-heals to teamA when selectedTeamId is no longer on the pitch', () => {
      const { rerender } = render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // User selects Team Blue (teamB)
      fireEvent.click(screen.getByRole('tab', { name: /Team Blue/i }));
      expect(screen.getByText('Eve')).toBeInTheDocument();

      // Team Blue concedes and rotates out; Team Orange (teamC) rotates onto pitch slot B
      rerender(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamC}
          teamPlayers={mockTeamPlayers}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // Since previously selected team (team-blue-2) is no longer on pitch,
      // it auto-heals to Team Green (teamA)
      expect(screen.getByRole('tab', { name: /Team Green/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Eve')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 8. Optional Team Swap Action
  // =========================================================================
  describe('Team Swap Action', () => {
    it('renders swap button when onSwapTeam, waiting teams, and admin in-progress are present', () => {
      const handleSwapTeam = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          waiting={[{ id: 'team-orange-3', name: 'Team Orange' }]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={handleSwapTeam}
        />
      );

      const swapButton = screen.getByRole('button', { name: /Swap Team Green/i });
      expect(swapButton).toBeInTheDocument();

      fireEvent.click(swapButton);
      expect(handleSwapTeam).toHaveBeenCalledWith('team-green-1');
    });

    it('swaps active team when Team B is selected', () => {
      const handleSwapTeam = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          waiting={[{ id: 'team-orange-3', name: 'Team Orange' }]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={handleSwapTeam}
        />
      );

      // Switch to Team Blue
      fireEvent.click(screen.getByRole('tab', { name: /Team Blue/i }));

      const swapButton = screen.getByRole('button', { name: /Swap Team Blue/i });
      fireEvent.click(swapButton);
      expect(handleSwapTeam).toHaveBeenCalledWith('team-blue-2');
    });

    it('does not render swap button if waiting queue is empty', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={mockTeamPlayers}
          events={[]}
          waiting={[]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Swap/i })).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 9. Edge Cases & Resilience
  // =========================================================================
  describe('Edge Cases & Defensive Handling', () => {
    it('gracefully renders an empty roster message when a team has no players', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={{ id: 'empty-team', name: 'Empty Team' }}
          teamB={teamB}
          teamPlayers={{}}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText(/No players on Empty Team/i)).toBeInTheDocument();
    });

    it('handles null/undefined events and missing player names gracefully', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'anon-1' }]
          }}
          events={null as any}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText('Player')).toBeInTheDocument();
    });
  });
});
