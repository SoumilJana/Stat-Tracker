import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchHeader } from '../components/MatchHeader';
import { Scoreboard } from '../components/Scoreboard';
import { AssistModal } from '../components/AssistModal';
import { PitchBoard } from '../components/PitchBoard';

describe('Empirical Challenge: Milestone 3 SPECIAL_7V7 Active Match, Headers, Badges, and Modals', () => {
  const adminProfile = { id: 'admin-1', username: 'SuperAdmin', role: 'admin' };

  const teamA = { id: 'team-a-id', name: 'Alpha Hawks' };
  const teamB = { id: 'team-b-id', name: 'Bravo Wolves' };

  // 10 players for Team A (7 starters, 3 substitutes)
  const teamAPlayers10 = Array.from({ length: 10 }, (_, i) => ({
    id: `alpha-${i + 1}`,
    username: `Alpha_${i + 1}`,
  }));

  // Exactly 7 players for Team B (7 starters, 0 substitutes)
  const teamBPlayers7 = Array.from({ length: 7 }, (_, i) => ({
    id: `bravo-${i + 1}`,
    username: `Bravo_${i + 1}`,
  }));

  let clipboardOutput = '';

  beforeEach(() => {
    vi.clearAllMocks();
    clipboardOutput = '';
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          clipboardOutput = text;
          return Promise.resolve();
        }),
      },
    });
  });

  describe('Challenge Dimension 1: MatchHeader Badge Across All Session Statuses', () => {
    it('renders "7v7 Special" badge for SCHEDULED status', () => {
      const scheduledSession = {
        id: 's-sched',
        mode: 'SPECIAL_7V7',
        status: 'SCHEDULED',
        date: '2026-11-06T18:00:00Z',
        location: 'Arena Pitch 1',
      };

      render(
        <MemoryRouter>
          <MatchHeader
            session={scheduledSession}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers10, [teamB.id]: teamBPlayers7 }}
            events={[]}
            pollVotes={[]}
            bibColors={{}}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={vi.fn()}
            onDeleteMatch={vi.fn()}
            onOpenBulk={vi.fn()}
          />
        </MemoryRouter>
      );

      const modeBadge = screen.getByText('7v7 Special');
      expect(modeBadge).toBeInTheDocument();
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
      expect(modeBadge.className).toContain('text-purple-400');
    });

    it('renders "7v7 Special" badge for IN_PROGRESS status', () => {
      const inProgressSession = {
        id: 's-live',
        mode: 'SPECIAL_7V7',
        status: 'IN_PROGRESS',
        date: '2026-11-06T18:00:00Z',
        location: 'Arena Pitch 1',
      };

      render(
        <MemoryRouter>
          <MatchHeader
            session={inProgressSession}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 1, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers10, [teamB.id]: teamBPlayers7 }}
            events={[]}
            pollVotes={[]}
            bibColors={{}}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={vi.fn()}
            onDeleteMatch={vi.fn()}
            onOpenBulk={vi.fn()}
          />
        </MemoryRouter>
      );

      const modeBadge = screen.getByText('7v7 Special');
      expect(modeBadge).toBeInTheDocument();
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    });

    it('renders "7v7 Special" badge for COMPLETED status', () => {
      const completedSession = {
        id: 's-done',
        mode: 'SPECIAL_7V7',
        status: 'COMPLETED',
        date: '2026-11-06T18:00:00Z',
        location: 'Arena Pitch 1',
      };

      render(
        <MemoryRouter>
          <MatchHeader
            session={completedSession}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 3, [teamB.id]: 1 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers10, [teamB.id]: teamBPlayers7 }}
            events={[]}
            pollVotes={[]}
            bibColors={{}}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={vi.fn()}
            onDeleteMatch={vi.fn()}
            onOpenBulk={vi.fn()}
          />
        </MemoryRouter>
      );

      const modeBadge = screen.getByText('7v7 Special');
      expect(modeBadge).toBeInTheDocument();
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    it('does not render "7v7 Special" badge for STANDARD mode in any status', () => {
      const statuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];

      statuses.forEach(status => {
        const { unmount } = render(
          <MemoryRouter>
            <MatchHeader
              session={{
                id: `s-std-${status}`,
                mode: 'STANDARD',
                status,
                date: '2026-11-06T18:00:00Z',
              }}
              profile={adminProfile}
              teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
              onPitch={[teamA, teamB]}
              waiting={[]}
              teamPlayers={{ [teamA.id]: teamAPlayers10.slice(0, 5), [teamB.id]: teamBPlayers7.slice(0, 5) }}
              events={[]}
              pollVotes={[]}
              bibColors={{}}
              isOffline={false}
              isSyncing={false}
              onOpenEdit={vi.fn()}
              onDeleteMatch={vi.fn()}
              onOpenBulk={vi.fn()}
            />
          </MemoryRouter>
        );

        expect(screen.queryByText('7v7 Special')).toBeNull();
        unmount();
      });
    });

    it('handles unexpected/null status gracefully without unhandled exceptions', () => {
      render(
        <MemoryRouter>
          <MatchHeader
            session={{
              id: 's-unknown',
              mode: 'SPECIAL_7V7',
              status: null,
              date: '2026-11-06T18:00:00Z',
            }}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers10, [teamB.id]: teamBPlayers7 }}
            events={[]}
            pollVotes={[]}
            bibColors={{}}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={vi.fn()}
            onDeleteMatch={vi.fn()}
            onOpenBulk={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('7v7 Special')).toBeInTheDocument();
      expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    });
  });

  describe('Challenge Dimension 2: Scoreboard Mode Badge Placement & Live/Completed Views', () => {
    it('renders "7v7 Special" badge below VS in live match view', () => {
      render(
        <Scoreboard
          session={{ id: 's1', mode: 'SPECIAL_7V7', status: 'IN_PROGRESS' }}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 2, [teamB.id]: 3 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: teamAPlayers10, [teamB.id]: teamBPlayers7 }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      const vsElement = screen.getByText('VS');
      const badge = screen.getByText('7v7 Special');
      expect(vsElement).toBeInTheDocument();
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('mt-2');
    });

    it('renders "7v7 Special" badge in completed match and handles draw resolution properly', () => {
      render(
        <Scoreboard
          session={{ id: 's2', mode: 'SPECIAL_7V7', status: 'COMPLETED', date: '2026-11-06T18:00:00Z' }}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 2, [teamB.id]: 2 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: teamAPlayers10, [teamB.id]: teamBPlayers7 }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      const badge = screen.getByText('7v7 Special');
      expect(badge).toBeInTheDocument();
      expect(screen.getByText('Match Day Winners (Draw)')).toBeInTheDocument();
      expect(screen.getByText('2 Goals')).toBeInTheDocument();
    });

    it('never renders "7v7 Special" badge in STANDARD completed or in-progress match', () => {
      const { rerender } = render(
        <Scoreboard
          session={{ id: 's-std', mode: 'STANDARD', status: 'IN_PROGRESS' }}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 1, [teamB.id]: 0 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: teamAPlayers10.slice(0, 5), [teamB.id]: teamBPlayers7.slice(0, 5) }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      expect(screen.queryByText('7v7 Special')).toBeNull();

      rerender(
        <Scoreboard
          session={{ id: 's-std', mode: 'STANDARD', status: 'COMPLETED', date: '2026-11-06T18:00:00Z' }}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 1, [teamB.id]: 0 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: teamAPlayers10.slice(0, 5), [teamB.id]: teamBPlayers7.slice(0, 5) }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      expect(screen.queryByText('7v7 Special')).toBeNull();
    });
  });

  describe('Challenge Dimension 3: WhatsApp Clipboard Share Formatting', () => {
    it('formats pre-match share with 🎯 Mode: 7v7 Special, bib colors, and exact (Starter)/(Sub) roles', () => {
      render(
        <MemoryRouter>
          <MatchHeader
            session={{
              id: 's-share-pre',
              mode: 'SPECIAL_7V7',
              status: 'SCHEDULED',
              date: '2026-11-06T18:00:00Z',
              location: 'Stadium Court',
            }}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers10, [teamB.id]: teamBPlayers7 }}
            events={[]}
            pollVotes={[]}
            bibColors={{ [teamA.id]: 'Orange', [teamB.id]: 'Blue' }}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={vi.fn()}
            onDeleteMatch={vi.fn()}
            onOpenBulk={vi.fn()}
          />
        </MemoryRouter>
      );

      const copyBtn = screen.getByTitle('Copy Teams');
      fireEvent.click(copyBtn);

      expect(clipboardOutput).toContain('🎯 Mode: 7v7 Special');
      expect(clipboardOutput).toContain('Location: Stadium Court');
      expect(clipboardOutput).toContain('Alpha Hawks (Orange)');
      expect(clipboardOutput).toContain('Bravo Wolves (Blue)');

      // Team A has 10 players
      expect(clipboardOutput).toContain('1. Alpha_1');
      expect(clipboardOutput).toContain('7. Alpha_7');
      expect(clipboardOutput).toContain('8. Alpha_8');
      expect(clipboardOutput).toContain('9. Alpha_9');
      expect(clipboardOutput).toContain('10. Alpha_10');

      // Team B has exactly 7 players
      expect(clipboardOutput).toContain('1. Bravo_1');
      expect(clipboardOutput).toContain('7. Bravo_7');
      expect(clipboardOutput).not.toContain('Bravo_8');
      expect(clipboardOutput).not.toContain('(Starter)');
      expect(clipboardOutput).not.toContain('(Sub)');
    });

    it('formats completed match stats with 🎯 Mode: 7v7 Special, winner role tags, and highlights', () => {
      const events = [
        // Alpha_1 (starter) scores assisted by Alpha_8 (sub)
        { id: 'e1', event_type: 'GOAL', player_id: 'alpha-1', assisted_by: 'alpha-8', team_id: teamA.id },
        // Alpha_8 (sub) scores unassisted
        { id: 'e2', event_type: 'GOAL', player_id: 'alpha-8', assisted_by: null, team_id: teamA.id },
        // Bravo_2 (starter) scores unassisted
        { id: 'e3', event_type: 'GOAL', player_id: 'bravo-2', assisted_by: null, team_id: teamB.id },
      ];

      render(
        <MemoryRouter>
          <MatchHeader
            session={{
              id: 's-share-comp',
              mode: 'SPECIAL_7V7',
              status: 'COMPLETED',
              date: '2026-11-06T18:00:00Z',
              location: 'Stadium Court',
            }}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 2, [teamB.id]: 1 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers10, [teamB.id]: teamBPlayers7 }}
            events={events}
            pollVotes={[]}
            bibColors={{}}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={vi.fn()}
            onDeleteMatch={vi.fn()}
            onOpenBulk={vi.fn()}
          />
        </MemoryRouter>
      );

      const copyBtn = screen.getByTitle('Copy Match Stats');
      fireEvent.click(copyBtn);

      expect(clipboardOutput).toContain('Match Day Stats');
      expect(clipboardOutput).toContain('🎯 Mode: 7v7 Special');
      expect(clipboardOutput).toContain('Location: Stadium Court');
      expect(clipboardOutput).toContain('🏆 WINNER: Alpha Hawks 🏆');

      // Alpha_1 has 1 G
      expect(clipboardOutput).toContain('- Alpha_1: 1 G');
      // Alpha_8 has 1 G, 1 A
      expect(clipboardOutput).toContain('- Alpha_8: 1 G, 1 A');

      // Alpha_2 is on winning team with 0 stats -> rendered by name
      expect(clipboardOutput).toContain('- Alpha_2');

      // Bravo_2 on losing team scored 1 G -> rendered with 1 G
      expect(clipboardOutput).toContain('- Bravo_2: 1 G');
      expect(clipboardOutput).not.toContain('(Starter)');
      expect(clipboardOutput).not.toContain('(Sub)');

      // Highlights
      expect(clipboardOutput).toContain('Top Scorer:');
    });

    it('strictly preserves standard mode clipboard text format without mode badge or role tags', () => {
      const stdPlayersA = teamAPlayers10.slice(0, 5);
      const stdPlayersB = teamBPlayers7.slice(0, 5);

      const events = [
        { id: 'e1', event_type: 'GOAL', player_id: 'alpha-1', assisted_by: null, team_id: teamA.id },
      ];

      render(
        <MemoryRouter>
          <MatchHeader
            session={{
              id: 's-share-std',
              mode: 'STANDARD',
              status: 'COMPLETED',
              date: '2026-11-06T18:00:00Z',
            }}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 1, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: stdPlayersA, [teamB.id]: stdPlayersB }}
            events={events}
            pollVotes={[]}
            bibColors={{}}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={vi.fn()}
            onDeleteMatch={vi.fn()}
            onOpenBulk={vi.fn()}
          />
        </MemoryRouter>
      );

      const copyBtn = screen.getByTitle('Copy Match Stats');
      fireEvent.click(copyBtn);

      expect(clipboardOutput).not.toContain('7v7 Special');
      expect(clipboardOutput).not.toContain('(Starter)');
      expect(clipboardOutput).not.toContain('(Sub)');
      expect(clipboardOutput).toContain('- Alpha_1: 1 G');
    });

    it('triggers rich WhatsApp share with asterisks, tally, and scorecard link when clicking Share button', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share: shareMock });

      const stdPlayersA = teamAPlayers10.slice(0, 5);
      const stdPlayersB = teamBPlayers7.slice(0, 5);
      const events = [
        { id: 'e1', event_type: 'GOAL', player_id: 'alpha-1', assisted_by: null, team_id: teamA.id },
      ];

      render(
        <MemoryRouter>
          <MatchHeader
            session={{
              id: 's-share-whatsapp-test',
              mode: 'SPECIAL_7V7',
              status: 'COMPLETED',
              date: '2026-11-06T18:00:00Z',
              location: 'Turf Park',
            }}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 1, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: stdPlayersA, [teamB.id]: stdPlayersB }}
            events={events}
            pollVotes={[]}
            bibColors={{}}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={vi.fn()}
            onDeleteMatch={vi.fn()}
            onOpenBulk={vi.fn()}
          />
        </MemoryRouter>
      );

      const shareBtn = screen.getByTitle('Share Match Link');
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(shareMock).toHaveBeenCalled();
      const shareCallArg = shareMock.mock.calls[0][0];
      expect(shareCallArg.title).toContain('StatTracker - Match Stats');
      expect(shareCallArg.text).toContain('⚽ *StatTracker Match Day Stats*');
      expect(shareCallArg.text).toContain('🏆 *FINAL TALLY*');
      expect(shareCallArg.text).toContain('👑 *WINNER:* Alpha Hawks');
      expect(shareCallArg.text).toContain('🔗 *Full Match Scorecard:*');
    });
  });

  describe('Challenge Dimension 4: AssistModal 10-Player Viewport and Teammate Selection', () => {
    it('supports selecting a substitute player as the assister', () => {
      const handleConfirm = vi.fn();
      const handleCancel = vi.fn();

      render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'alpha-1', // Starter Alpha_1 scored
            teamId: teamA.id,
            teamPlayers: teamAPlayers10,
          }}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );

      // Verify scorer is shown in subtitle
      expect(screen.getByText('Goal by Alpha_1')).toBeInTheDocument();

      // Click sub Alpha_10
      const subButton = screen.getByText('Alpha_10');
      fireEvent.click(subButton);

      expect(handleConfirm).toHaveBeenCalledTimes(1);
      expect(handleConfirm).toHaveBeenCalledWith('alpha-10');
    });

    it('supports selecting a starter as the assister when a substitute scores', () => {
      const handleConfirm = vi.fn();

      render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'alpha-9', // Substitute Alpha_9 scored
            teamId: teamA.id,
            teamPlayers: teamAPlayers10,
          }}
          onConfirm={handleConfirm}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('Goal by Alpha_9')).toBeInTheDocument();

      // Scorer Alpha_9 must NOT be in the assist list
      const buttons = screen.getAllByRole('button');
      const assisterNames = buttons.map(b => b.textContent);
      expect(assisterNames).not.toContain('Alpha_9');

      // Click starter Alpha_2
      const starterButton = screen.getByText('Alpha_2');
      fireEvent.click(starterButton);

      expect(handleConfirm).toHaveBeenCalledWith('alpha-2');
    });

    it('works cleanly when team has exactly 7 players with 0 substitutes', () => {
      const handleConfirm = vi.fn();

      render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'bravo-1',
            teamId: teamB.id,
            teamPlayers: teamBPlayers7,
          }}
          onConfirm={handleConfirm}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('Goal by Bravo_1')).toBeInTheDocument();

      // 6 teammate buttons + 1 "No Assist" button + 1 "Cancel" button = 8 buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(8);

      fireEvent.click(screen.getByText('No Assist'));
      expect(handleConfirm).toHaveBeenCalledWith(null);
    });

    it('returns null when isOpen is false or pendingGoal is null', () => {
      const { container, rerender } = render(
        <AssistModal
          isOpen={false}
          pendingGoal={{
            playerId: 'alpha-1',
            teamId: teamA.id,
            teamPlayers: teamAPlayers10,
          }}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();

      rerender(
        <AssistModal
          isOpen={true}
          pendingGoal={null}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Challenge Dimension 5: PitchBoard Exact 7-Player Boundary Condition', () => {
    it('does not render "Substitutes" divider or "Sub" badges when team has exactly 7 starters', () => {
      render(
        <PitchBoard
          session={{ id: 's-7', mode: 'SPECIAL_7V7', status: 'IN_PROGRESS' }}
          profile={adminProfile}
          teamA={teamB} // 7 players
          teamB={teamB} // 7 players
          teamPlayers={{
            [teamB.id]: teamBPlayers7,
          }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamB.id]: 1 }}
          onPitch={[teamB, teamB]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      // All 7 should be Starters
      expect(screen.getAllByText('Starter')).toHaveLength(14); // 7 for side A, 7 for side B
      expect(screen.queryByText('Sub')).toBeNull();
      expect(screen.queryByText(/Substitutes/)).toBeNull();
    });
  });
});
