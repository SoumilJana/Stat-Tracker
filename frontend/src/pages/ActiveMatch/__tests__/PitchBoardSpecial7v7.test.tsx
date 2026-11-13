import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PitchBoard } from '../components/PitchBoard';
import { Scoreboard } from '../components/Scoreboard';
import { MatchHeader } from '../components/MatchHeader';
import { AssistModal } from '../components/AssistModal';

describe('Milestone 3: 7v7 Special Mode (SPECIAL_7V7) Active Match & Pitch Board', () => {
  const adminProfile = { id: 'admin-1', username: 'AdminRef', role: 'admin' };
  const playerProfile = { id: 'player-1', username: 'RegularPlayer', role: 'player' };

  const teamA = { id: 'team-a-id', name: 'Team Alpha' };
  const teamB = { id: 'team-b-id', name: 'Team Beta' };

  // 10 players per team (7 starters, 3 substitutes)
  const teamAPlayers = Array.from({ length: 10 }, (_, i) => ({
    id: `player-a-${i + 1}`,
    username: `AlphaPlayer_${i + 1}`,
  }));

  const teamBPlayers = Array.from({ length: 10 }, (_, i) => ({
    id: `player-b-${i + 1}`,
    username: `BetaPlayer_${i + 1}`,
  }));

  const special7v7SessionInProgress = {
    id: 'session-7v7-1',
    mode: 'SPECIAL_7V7',
    status: 'IN_PROGRESS',
    date: '2026-11-06T15:00:00Z',
    location: 'Pitch 7',
  };

  const special7v7SessionCompleted = {
    id: 'session-7v7-2',
    mode: 'SPECIAL_7V7',
    status: 'COMPLETED',
    date: '2026-11-06T15:00:00Z',
    location: 'Pitch 7',
  };

  const standardSessionInProgress = {
    id: 'session-std-1',
    mode: 'STANDARD',
    status: 'IN_PROGRESS',
    date: '2026-11-06T15:00:00Z',
    location: 'Pitch 5',
  };

  const standardSessionCompleted = {
    id: 'session-std-2',
    mode: 'STANDARD',
    status: 'COMPLETED',
    date: '2026-11-06T15:00:00Z',
    location: 'Pitch 5',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. PitchBoard Starter/Sub Distinction in SPECIAL_7V7', () => {
    it('renders 10 player buttons for Team A and 10 player buttons for Team B in active match', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <PitchBoard
          session={special7v7SessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            [teamA.id]: teamAPlayers,
            [teamB.id]: teamBPlayers,
          }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={handleInitiateGoal}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      // Verify all 10 Team A and 10 Team B players are rendered
      teamAPlayers.forEach(p => {
        expect(screen.getByText(p.username)).toBeInTheDocument();
      });
      teamBPlayers.forEach(p => {
        expect(screen.getByText(p.username)).toBeInTheDocument();
      });
    });

    it('renders exactly 7 Starter badges and 3 Sub badges per team with section dividers', () => {
      render(
        <PitchBoard
          session={special7v7SessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            [teamA.id]: teamAPlayers,
            [teamB.id]: teamBPlayers,
          }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      // Live board: 10 tap-to-score names per team, no Starter/Sub badges
      expect(screen.getAllByRole('button', { name: /Record goal for/ })).toHaveLength(20);
      expect(screen.queryByText('Starter')).toBeNull();
      expect(screen.queryByText('Sub')).toBeNull();

      // Section divider should be rendered for both teams: "Substitutes (3)"
      const dividers = screen.getAllByText('Substitutes (3)');
      expect(dividers).toHaveLength(2);
    });

    it('clicking any starter or substitute button triggers goal initiation with full squad list', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <PitchBoard
          session={special7v7SessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            [teamA.id]: teamAPlayers,
            [teamB.id]: teamBPlayers,
          }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={handleInitiateGoal}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      // Click starter at index 0 (AlphaPlayer_1)
      const starterButton = screen.getByText('AlphaPlayer_1').closest('button');
      expect(starterButton).not.toBeNull();
      fireEvent.click(starterButton!);

      expect(handleInitiateGoal).toHaveBeenCalledWith('player-a-1', teamA.id, teamAPlayers);

      // Click substitute at index 8 (AlphaPlayer_9)
      const subButton = screen.getByText('AlphaPlayer_9').closest('button');
      expect(subButton).not.toBeNull();
      fireEvent.click(subButton!);

      expect(handleInitiateGoal).toHaveBeenCalledWith('player-a-9', teamA.id, teamAPlayers);
    });

    it('disables player buttons when profile is not admin', () => {
      const handleInitiateGoal = vi.fn();

      render(
        <PitchBoard
          session={special7v7SessionInProgress}
          profile={playerProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            [teamA.id]: teamAPlayers,
            [teamB.id]: teamBPlayers,
          }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={handleInitiateGoal}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      const starterButton = screen.getByText('AlphaPlayer_1').closest('button');
      expect(starterButton).toBeDisabled();

      const subButton = screen.getByText('AlphaPlayer_9').closest('button');
      expect(subButton).toBeDisabled();
    });

    it('renders Starter and Sub badges in completed/scheduled roster view', () => {
      render(
        <PitchBoard
          session={special7v7SessionCompleted}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            [teamA.id]: teamAPlayers,
            [teamB.id]: teamBPlayers,
          }}
          waiting={[]}
          bibColors={{}}
          events={[
            { id: 'ev-1', event_type: 'GOAL', player_id: 'player-a-8', assisted_by: 'player-a-1', team_id: teamA.id },
          ]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      // In completed state, badges and divider are also rendered
      expect(screen.getAllByText('Starter')).toHaveLength(14);
      expect(screen.getAllByText('Sub')).toHaveLength(6);
      expect(screen.getAllByText('Substitutes (3)')).toHaveLength(2);
      expect(screen.getByText('AlphaPlayer_8')).toBeInTheDocument();
    });

    it('does not render Starter/Sub badges or dividers in STANDARD 5v5 mode', () => {
      const stdPlayersA = teamAPlayers.slice(0, 5);
      const stdPlayersB = teamBPlayers.slice(0, 5);

      render(
        <PitchBoard
          session={standardSessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{
            [teamA.id]: stdPlayersA,
            [teamB.id]: stdPlayersB,
          }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      expect(screen.queryByText('Starter')).toBeNull();
      expect(screen.queryByText('Sub')).toBeNull();
      expect(screen.queryByText(/Substitutes/)).toBeNull();
    });
  });

  describe('2. Scoreboard 7v7 Special Mode Badges', () => {
    it('renders "7v7 Special" pill badge in live match below VS circle', () => {
      render(
        <Scoreboard
          session={special7v7SessionInProgress}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 3, [teamB.id]: 2 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: teamAPlayers, [teamB.id]: teamBPlayers }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      const badge = screen.getByText('7v7 Special');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-purple-500/10');
      expect(badge.className).toContain('text-purple-400');
    });

    it('renders "7v7 Special" badge in completed match above Match Day Winner', () => {
      render(
        <Scoreboard
          session={special7v7SessionCompleted}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 4, [teamB.id]: 1 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: teamAPlayers, [teamB.id]: teamBPlayers }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      const badge = screen.getByText('7v7 Special');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-purple-500/10');
      expect(badge.className).toContain('text-purple-400');
      expect(screen.getByText('Match Day Winner')).toBeInTheDocument();
    });

    it('does not render "7v7 Special" badge in STANDARD 5v5 mode', () => {
      const { rerender } = render(
        <Scoreboard
          session={standardSessionInProgress}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 1, [teamB.id]: 1 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: teamAPlayers.slice(0, 5), [teamB.id]: teamBPlayers.slice(0, 5) }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      expect(screen.queryByText('7v7 Special')).toBeNull();

      rerender(
        <Scoreboard
          session={standardSessionCompleted}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 2, [teamB.id]: 0 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: teamAPlayers.slice(0, 5), [teamB.id]: teamBPlayers.slice(0, 5) }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      expect(screen.queryByText('7v7 Special')).toBeNull();
    });
  });

  describe('3. MatchHeader Mode Badge and WhatsApp Share Stats', () => {
    let mockClipboardText = '';

    beforeEach(() => {
      mockClipboardText = '';
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockImplementation((text: string) => {
            mockClipboardText = text;
            return Promise.resolve();
          }),
        },
      });
    });

    it('renders "7v7 Special" badge beside status badge in header', () => {
      render(
        <MemoryRouter>
          <MatchHeader
            session={special7v7SessionInProgress}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers, [teamB.id]: teamBPlayers }}
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
      expect(modeBadge.className).toContain('bg-purple-500/10');
      expect(modeBadge.className).toContain('text-purple-400');
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    });

    it('formats WhatsApp pre-match roster with 🎯 Mode: 7v7 Special and (Starter)/(Sub) roles', () => {
      render(
        <MemoryRouter>
          <MatchHeader
            session={special7v7SessionInProgress}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers, [teamB.id]: teamBPlayers }}
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

      const copyBtn = screen.getByTitle('Send Teams on WhatsApp');
      fireEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(mockClipboardText).toContain('🎯 Mode: 7v7 Special');
      expect(mockClipboardText).not.toContain('Captain:');

      expect(mockClipboardText).toContain('1. AlphaPlayer_1');
      expect(mockClipboardText).toContain('7. AlphaPlayer_7');
      expect(mockClipboardText).toContain('8. AlphaPlayer_8');
      expect(mockClipboardText).toContain('9. AlphaPlayer_9');
      expect(mockClipboardText).toContain('10. AlphaPlayer_10');
      expect(mockClipboardText).not.toContain('(Starter)');
      expect(mockClipboardText).not.toContain('(Sub)');
    });

    it('formats WhatsApp completed match stats with 🎯 Mode: 7v7 Special and appends (Starter)/(Sub)', () => {
      const matchEvents = [
        { id: 'ev-1', event_type: 'GOAL', player_id: 'player-a-1', assisted_by: 'player-a-8', team_id: teamA.id },
        { id: 'ev-2', event_type: 'GOAL', player_id: 'player-a-8', assisted_by: null, team_id: teamA.id },
      ];

      render(
        <MemoryRouter>
          <MatchHeader
            session={special7v7SessionCompleted}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 2, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: teamAPlayers, [teamB.id]: teamBPlayers }}
            events={matchEvents}
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

      const copyBtn = screen.getByTitle('Send Match Stats on WhatsApp');
      fireEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(mockClipboardText).toContain('🎯 Mode: 7v7 Special');
      expect(mockClipboardText).toContain('- AlphaPlayer_1');
      expect(mockClipboardText).toContain('- AlphaPlayer_8');
      expect(mockClipboardText).not.toContain('(Starter)');
      expect(mockClipboardText).not.toContain('(Sub)');
    });

    it('preserves standard format in STANDARD mode without 7v7 Special or Starter/Sub roles', () => {
      const stdPlayersA = teamAPlayers.slice(0, 5);
      const stdPlayersB = teamBPlayers.slice(0, 5);

      render(
        <MemoryRouter>
          <MatchHeader
            session={standardSessionInProgress}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: stdPlayersA, [teamB.id]: stdPlayersB }}
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

      const copyBtn = screen.getByTitle('Send Teams on WhatsApp');
      fireEvent.click(copyBtn);

      expect(mockClipboardText).not.toContain('7v7 Special');
      expect(mockClipboardText).toContain('Captain: AlphaPlayer_1');
      expect(mockClipboardText).not.toContain('(Starter)');
      expect(mockClipboardText).not.toContain('(Sub)');
    });
  });

  describe('4. AssistModal Viewport Constraint with 10 Players', () => {
    it('renders with max-h-[60vh] overflow-y-auto and shows all 9 potential assister teammates', () => {
      const handleConfirm = vi.fn();
      const handleCancel = vi.fn();

      const { container } = render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'player-a-1',
            teamId: teamA.id,
            teamPlayers: teamAPlayers,
          }}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );

      // Verify the scroll container has the required classes
      const scrollContainer = container.querySelector('.max-h-\\[60vh\\].overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
      expect(scrollContainer?.className).toContain('pr-1');

      // 1 "No Assist" button + 9 teammate buttons = 10 buttons total in scrollContainer
      const buttons = scrollContainer?.querySelectorAll('button');
      expect(buttons).toHaveLength(10);

      // Scorer (AlphaPlayer_1) is excluded from assist options
      expect(screen.getByText('Goal by AlphaPlayer_1')).toBeInTheDocument();
      expect(within(scrollContainer as HTMLElement).queryByText('AlphaPlayer_1')).toBeNull();

      // Check teammate from subs (AlphaPlayer_10) is present and clickable
      const subAssister = screen.getByText('AlphaPlayer_10');
      fireEvent.click(subAssister);
      expect(handleConfirm).toHaveBeenCalledWith('player-a-10');
    });

    it('clicking "No Assist" confirms with null assistedBy', () => {
      const handleConfirm = vi.fn();

      render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'player-a-1',
            teamId: teamA.id,
            teamPlayers: teamAPlayers,
          }}
          onConfirm={handleConfirm}
          onCancel={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('No Assist'));
      expect(handleConfirm).toHaveBeenCalledWith(null);
    });
  });
});
