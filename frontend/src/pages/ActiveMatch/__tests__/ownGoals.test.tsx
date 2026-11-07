import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssistModal } from '../components/AssistModal';
import { EventTimeline } from '../components/EventTimeline';
import { useMatchEngine } from '../hooks/useMatchEngine';
import { renderHook } from '@testing-library/react';
import { buildWhatsAppShareText } from '../utils/shareUtils';

describe('Own Goals System: Comprehensive Suite', () => {
  describe('1. AssistModal Own Goal UI & Attribution', () => {
    const mockPlayers = [
      { id: 'player-a1', username: 'Alice' },
      { id: 'player-a2', username: 'Bob' },
      { id: 'player-a3', username: 'Charlie' }
    ];

    it('renders Own Goal button with opponent team name when opponentTeam is provided', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'player-a1',
            teamId: 'team-a',
            teamPlayers: mockPlayers,
            opponentTeam: { id: 'team-b', name: 'Team Bravo' }
          }}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText('Who assisted?')).toBeInTheDocument();
      expect(screen.getByText(/Goal by/)).toHaveTextContent('Alice');
      expect(screen.getByText('⚡ Own Goal (Award to Team Bravo)')).toBeInTheDocument();
      expect(screen.getByText('No Assist')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('triggers onConfirm(null, true) when Own Goal button is tapped', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'player-a1',
            teamId: 'team-a',
            teamPlayers: mockPlayers,
            opponentTeam: { id: 'team-b', name: 'Team Bravo' }
          }}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const ogButton = screen.getByText('⚡ Own Goal (Award to Team Bravo)');
      fireEvent.click(ogButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(null, true);
    });

    it('triggers onConfirm(null) when No Assist is tapped', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'player-a1',
            teamId: 'team-a',
            teamPlayers: mockPlayers,
            opponentTeam: { id: 'team-b', name: 'Team Bravo' }
          }}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const noAssistButton = screen.getByText('No Assist');
      fireEvent.click(noAssistButton);

      expect(onConfirm).toHaveBeenCalledWith(null);
    });

    it('triggers onConfirm(teammateId) when a teammate is selected', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'player-a1',
            teamId: 'team-a',
            teamPlayers: mockPlayers,
            opponentTeam: { id: 'team-b', name: 'Team Bravo' }
          }}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const teammateButton = screen.getByText('Bob');
      fireEvent.click(teammateButton);

      expect(onConfirm).toHaveBeenCalledWith('player-a2');
    });
  });

  describe('2. Match Engine Scoring & Winner Stays Rotation with Own Goals', () => {
    const teamA = { id: 'team-a', name: 'Team Alpha' };
    const teamB = { id: 'team-b', name: 'Team Bravo' };
    const teamC = { id: 'team-c', name: 'Team Charlie' };

    it('awards goal score to Team B and charges goal conceded to Team A when Team A player scores own goal', () => {
      const events = [
        {
          id: 'ev-1',
          event_type: 'GOAL',
          player_id: 'player-a1',
          team_id: 'team-b', // Awarded to Team B
          is_own_goal: true,
          timestamp: new Date().toISOString()
        }
      ];

      const { result } = renderHook(() =>
        useMatchEngine(events, { mode: 'STANDARD' }, [teamA, teamB])
      );

      // Team B got the goal, Team A did not
      expect(result.current.teamScores['team-b']).toBe(1);
      expect(result.current.teamScores['team-a']).toBe(0);

      // Team A conceded the goal
      expect(result.current.goalsConceded['team-a']).toBe(1);
      expect(result.current.goalsConceded['team-b']).toBe(0);
    });

    it('rotates losing Team A to queue and keeps awarded Team B on pitch in WINNER_STAYS mode', () => {
      const events = [
        {
          id: 'ev-1',
          event_type: 'GOAL',
          player_id: 'player-a1',
          team_id: 'team-b', // Team B awarded goal
          is_own_goal: true,
          timestamp: new Date().toISOString()
        }
      ];

      const { result } = renderHook(() =>
        useMatchEngine(events, { mode: 'WINNER_STAYS' }, [teamA, teamB, teamC])
      );

      // Winner Team B stays on pitch; Challenger Team C enters pitch
      expect(result.current.onPitch[0].id).toBe('team-b');
      expect(result.current.onPitch[1].id).toBe('team-c');

      // Conceding Team A rotated to back of the queue
      expect(result.current.waiting[0].id).toBe('team-a');
    });
  });

  describe('3. Share Utils & Match Recap Isolation', () => {
    it('does not inflate player goals with own goals and formats OG in match recap', () => {
      const teamA = { id: 'team-a', name: 'Team Alpha' };
      const teamB = { id: 'team-b', name: 'Team Bravo' };
      const teamPlayers = {
        'team-a': [{ id: 'p1', username: 'Alice' }, { id: 'p2', username: 'Bob' }],
        'team-b': [{ id: 'p3', username: 'Charlie' }]
      };

      const events = [
        // Alice scores an OWN GOAL awarded to Team B
        { id: 'e1', event_type: 'GOAL', player_id: 'p1', team_id: 'team-b', is_own_goal: true },
        // Bob scores a regular goal for Team A assisted by Alice
        { id: 'e2', event_type: 'GOAL', player_id: 'p2', assisted_by: 'p1', team_id: 'team-a', is_own_goal: false },
        // Charlie scores a regular goal for Team B
        { id: 'e3', event_type: 'GOAL', player_id: 'p3', team_id: 'team-b', is_own_goal: false }
      ];

      const text = buildWhatsAppShareText({
        session: { id: 'session-1', status: 'COMPLETED', mode: 'STANDARD', location: 'Turf Arena', date: new Date().toISOString() },
        onPitch: [teamA, teamB],
        waiting: [],
        teamPlayers,
        events,
        pollVotes: [],
        bibColors: {},
        teamScores: { 'team-a': 1, 'team-b': 2 }
      });

      // Bob should have 1 G
      expect(text).toContain('Bob: 1 G');
      // Alice has 1 A (assist to Bob) and 1 OG (own goal), but NOT 1 G
      expect(text).toContain('Alice: 1 A, 1 OG');
      expect(text).not.toContain('Alice: 1 G');

      // Charlie has 1 G and should be the top scorer (not Alice)
      expect(text).toContain('Charlie');
    });
  });

  describe('4. Event Timeline Own Goal Display', () => {
    it('renders own goal indicator and details with undo action', () => {
      const teamA = { id: 'team-a', name: 'Team Alpha' };
      const teamB = { id: 'team-b', name: 'Team Bravo' };
      const onUndoEvent = vi.fn();

      const events = [
        {
          id: 'ev-og-1',
          event_type: 'GOAL',
          player_id: 'player-a1',
          team_id: 'team-b',
          is_own_goal: true,
          player: { username: 'Alice' },
          timestamp: new Date().toISOString()
        }
      ];

      render(
        <EventTimeline
          events={events}
          session={{ status: 'IN_PROGRESS' }}
          profile={{ role: 'admin' }}
          teamA={teamA}
          teamB={teamB}
          onPitch={[teamA, teamB]}
          waiting={[]}
          onUndoEvent={onUndoEvent}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('OG')).toBeInTheDocument();
      expect(screen.getByText('own goal')).toBeInTheDocument();
      expect(screen.getByText(/awarded to/)).toBeInTheDocument();
      expect(screen.getByText('Team Bravo')).toBeInTheDocument();

      const undoButton = screen.getByTitle('Undo Event');
      fireEvent.click(undoButton);
      expect(onUndoEvent).toHaveBeenCalledWith('ev-og-1');
    });
  });
});
