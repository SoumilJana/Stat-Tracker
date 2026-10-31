import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WinnerStaysGoalEntry } from '../WinnerStaysGoalEntry';

describe('WinnerStaysGoalEntry Adversarial & Stress Suite', () => {
  const adminProfile = { id: 'admin-1', username: 'Referee', role: 'admin' };
  const userProfile = { id: 'user-1', username: 'Spectator', role: 'user' };

  const activeSession = {
    id: 'session-ws-1',
    mode: 'WINNER_STAYS',
    status: 'IN_PROGRESS'
  };

  const teamA = { id: 'team-green-1', name: 'Team Green' };
  const teamB = { id: 'team-blue-2', name: 'Team Blue' };
  const teamC = { id: 'team-orange-3', name: 'Team Orange' };
  const teamD = { id: 'team-purple-4', name: 'Team Purple' };

  // =========================================================================
  // 1. Edge Cases & Boundary Stress: teamPlayers variations
  // =========================================================================
  describe('Boundary Stress: teamPlayers variations', () => {
    it('handles undefined teamPlayers gracefully without crashing', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={undefined as any}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText(/No players on Team Green/i)).toBeInTheDocument();
    });

    it('handles null teamPlayers gracefully without crashing', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={null as any}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText(/No players on Team Green/i)).toBeInTheDocument();
    });

    it('handles teamPlayers with null / undefined active team roster', () => {
      const { rerender } = render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ 'team-green-1': null as any }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText(/No players on Team Green/i)).toBeInTheDocument();

      rerender(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ 'team-green-1': undefined as any }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText(/No players on Team Green/i)).toBeInTheDocument();
    });

    it('handles player objects with missing properties (name, username, id)', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [
              { id: 'p1' }, // Missing username and name -> fallback to 'Player'
              { id: 'p2', name: 'OnlyName' },
              { id: 'p3', username: 'OnlyUsername' }
            ]
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText('Player')).toBeInTheDocument();
      expect(screen.getByText('OnlyName')).toBeInTheDocument();
      expect(screen.getByText('OnlyUsername')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Extreme Player Names & Layout Stress
  // =========================================================================
  describe('Extreme Player Names & Layout Stress', () => {
    it('truncates excessively long player names with ellipsis and maintains flex-shrink-0 on + GOAL', () => {
      const ultraLongName = 'Wolfeschlegelsteinhausenbergerdorffwelchevoralternwarengewissenhaft';
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [
              { id: 'p-long-1', username: ultraLongName, name: ultraLongName }
            ]
          }}
          events={[]}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      const nameElement = screen.getByText(ultraLongName);
      expect(nameElement).toBeInTheDocument();

      // Check CSS truncation constraints
      expect(nameElement.className).toContain('truncate');
      expect(nameElement.className).toContain('max-w-[90px]');
      expect(nameElement.className).toContain('sm:max-w-[130px]');

      // Check + GOAL action pill has flex-shrink-0
      const goalPill = screen.getByTestId('goal-action-p-long-1');
      expect(goalPill.className).toContain('flex-shrink-0');
      expect(goalPill).toHaveTextContent('+ GOAL');

      // Click card triggers action
      fireEvent.click(goalPill);
      expect(handleInitiateGoal).toHaveBeenCalledWith(
        'p-long-1',
        'team-green-1',
        expect.any(Array)
      );
    });

    it('safely renders unicode, emojis, and special HTML characters without injection', () => {
      const xssAttempt = '<img src=x onerror=alert(1)>⚡⚽';

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p-xss', username: xssAttempt, name: xssAttempt }]
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // React escapes strings into textContent, preventing HTML injection
      expect(screen.getByText(xssAttempt)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Odd Roster Sizes (1, 3, 7 Players)
  // =========================================================================
  describe('Odd Roster Sizes Stress', () => {
    it('renders and supports 1-player roster (1v1 duel)', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'solo-1', username: 'Solo Striker', name: 'Solo Striker' }]
          }}
          events={[]}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      const cards = screen.getAllByTestId(/^player-card-/);
      expect(cards.length).toBe(1);

      fireEvent.click(cards[0]);
      expect(handleInitiateGoal).toHaveBeenCalledWith('solo-1', 'team-green-1', expect.any(Array));
    });

    it('renders and supports 3-player roster cleanly', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [
              { id: 't3-1', username: 'Player 1' },
              { id: 't3-2', username: 'Player 2' },
              { id: 't3-3', username: 'Player 3' }
            ]
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      const cards = screen.getAllByTestId(/^player-card-/);
      expect(cards.length).toBe(3);
    });

    it('renders and supports 7-player roster cleanly', () => {
      const sevenPlayers = Array.from({ length: 7 }, (_, i) => ({
        id: `p-${i + 1}`,
        username: `Roster Player ${i + 1}`
      }));

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': sevenPlayers
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      const cards = screen.getAllByTestId(/^player-card-/);
      expect(cards.length).toBe(7);
      expect(screen.getByText('Roster Player 7')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Rapid Double-Tapping & isSubmitting Race Protection
  // =========================================================================
  describe('Double-Tap & Concurrency Stress', () => {
    it('prevents multiple rapid submissions when isSubmitting is set immediately', () => {
      const handleInitiateGoal = vi.fn();

      const { rerender } = render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Speedy' }]
          }}
          events={[]}
          isSubmitting={false}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      const card = screen.getByTestId('player-card-p1');

      // First click: triggers goal initiation
      fireEvent.click(card);
      expect(handleInitiateGoal).toHaveBeenCalledTimes(1);

      // Parent component sets isSubmitting = true while network request is in-flight
      rerender(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Speedy' }]
          }}
          events={[]}
          isSubmitting={true}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      // Rapid consecutive clicks while isSubmitting is true
      fireEvent.click(card);
      fireEvent.click(card);
      fireEvent.click(card);

      // Expect total calls to remain exactly 1
      expect(handleInitiateGoal).toHaveBeenCalledTimes(1);
    });

    it('pointer-events-none and disabled attributes are present during isSubmitting', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Speedy' }]
          }}
          events={[]}
          isSubmitting={true}
          onInitiateGoal={vi.fn()}
        />
      );

      const card = screen.getByTestId('player-card-p1');
      expect(card).toBeDisabled();
      expect(card.className).toContain('pointer-events-none');
    });
  });

  // =========================================================================
  // 5. Rotation Chaos Stress (Team Swaps & Sudden Replacements)
  // =========================================================================
  describe('Rotation Chaos Stress', () => {
    it('maintains active team selection when teamA and teamB swap positions', () => {
      const { rerender } = render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA} // team-green-1
          teamB={teamB} // team-blue-2
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }],
            'team-blue-2': [{ id: 'p2', username: 'Bob' }]
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // Select Team Blue
      fireEvent.click(screen.getByRole('tab', { name: /Team Blue/i }));
      expect(screen.getByText('Bob')).toBeInTheDocument();

      // Rotation event swaps pitch positions: Team Blue is now teamA, Team Green is teamB
      rerender(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamB} // now team-blue-2
          teamB={teamA} // now team-green-1
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }],
            'team-blue-2': [{ id: 'p2', username: 'Bob' }]
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // Since selectedTeamId was 'team-blue-2', and teamA is now 'team-blue-2',
      // it seamlessly resolves to Team Blue without crashing or desyncing!
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Team Blue/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('self-heals to teamA when both teamA and teamB are replaced simultaneously by brand new teams', () => {
      const { rerender } = render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }],
            'team-blue-2': [{ id: 'p2', username: 'Bob' }],
            'team-orange-3': [{ id: 'p3', username: 'Charlie' }],
            'team-purple-4': [{ id: 'p4', username: 'Diana' }]
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // User was viewing Team Blue
      fireEvent.click(screen.getByRole('tab', { name: /Team Blue/i }));
      expect(screen.getByText('Bob')).toBeInTheDocument();

      // Sudden full pitch rotation: Team C and Team D take the pitch
      rerender(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamC}
          teamB={teamD}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }],
            'team-blue-2': [{ id: 'p2', username: 'Bob' }],
            'team-orange-3': [{ id: 'p3', username: 'Charlie' }],
            'team-purple-4': [{ id: 'p4', username: 'Diana' }]
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // Component immediately falls back to Team C (the new teamA)
      expect(screen.getByRole('tab', { name: /Team Orange/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });

    it('gracefully handles missing teamA or teamB props by using safe fallbacks', () => {
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={undefined as any}
          teamB={null as any}
          teamPlayers={{}}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByRole('tab', { name: /Team A/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Team B/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 6. Events Malformed & High-Volume Stress
  // =========================================================================
  describe('Events High-Volume & Malformation Stress', () => {
    it('handles non-array, null, undefined, or empty events without crashing', () => {
      const { rerender } = render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }]
          }}
          events={'invalid-events' as any}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByTestId('goal-badge-p1')).not.toBeInTheDocument();

      rerender(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }]
          }}
          events={null as any}
          onInitiateGoal={vi.fn()}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByTestId('goal-badge-p1')).not.toBeInTheDocument();
    });

    it('filters out non-goal events (FOUL, ASSIST, CARD) and malformed entries accurately', () => {
      const noisyEvents = [
        null,
        undefined,
        {},
        { event_type: 'FOUL', player_id: 'p1' },
        { event_type: 'YELLOW_CARD', player_id: 'p1' },
        { event_type: 'ASSIST', player_id: 'p1' },
        { event_type: 'GOAL', player_id: 'p1' }, // 1 goal for p1
        { type: 'GOAL', playerId: 'p1' },       // 2nd goal for p1 (alternate property naming)
        { event_type: 'GOAL', player_id: 'other-player' }
      ];

      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }]
          }}
          events={noisyEvents}
          onInitiateGoal={vi.fn()}
        />
      );

      const badge = screen.getByTestId('goal-badge-p1');
      expect(badge).toHaveTextContent('2G');
    });
  });

  // =========================================================================
  // 7. Session & Profile Edge Cases
  // =========================================================================
  describe('Session & Profile Null Safety', () => {
    it('handles null session and null profile safely without runtime errors', () => {
      render(
        <WinnerStaysGoalEntry
          session={null as any}
          profile={null as any}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }]
          }}
          events={[]}
          onInitiateGoal={vi.fn()}
        />
      );

      // Without admin and in-progress, player card renders in disabled spectator view
      const card = screen.getByTestId('player-card-p1');
      expect(card).toBeDisabled();
      expect(screen.queryByText('+ GOAL')).not.toBeInTheDocument();
    });

    it('disables interactions and hides + GOAL when role is user (spectator)', () => {
      const handleInitiateGoal = vi.fn();
      render(
        <WinnerStaysGoalEntry
          session={activeSession}
          profile={userProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            'team-green-1': [{ id: 'p1', username: 'Alice' }]
          }}
          events={[]}
          onInitiateGoal={handleInitiateGoal}
        />
      );

      const card = screen.getByTestId('player-card-p1');
      expect(card).toBeDisabled();
      fireEvent.click(card);
      expect(handleInitiateGoal).not.toHaveBeenCalled();
      expect(screen.queryByText('+ GOAL')).not.toBeInTheDocument();
    });
  });
});
