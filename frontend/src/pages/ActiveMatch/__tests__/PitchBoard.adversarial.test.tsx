import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PitchBoard } from '../components/PitchBoard';
import { Scoreboard } from '../components/Scoreboard';
import { MatchHeader } from '../components/MatchHeader';
import { AssistModal } from '../components/AssistModal';

function makePlayers(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-p${i + 1}`,
    username: `${prefix}Player_${i + 1}`,
  }));
}

describe('PitchBoard & Active Match Adversarial Stress Tests (SPECIAL_7V7)', () => {
  const adminProfile = { id: 'admin-id-1', username: 'HeadRef', role: 'admin' };
  const playerProfile = { id: 'player-id-1', username: 'GuestPlayer', role: 'player' };

  const teamA = { id: 'team-a', name: 'Team Red' };
  const teamB = { id: 'team-b', name: 'Team Blue' };

  const sessionInProgress = {
    id: 'sess-adv-1',
    mode: 'SPECIAL_7V7',
    status: 'IN_PROGRESS',
    date: '2026-11-06T18:00:00Z',
    location: 'Turf Arena',
  };

  const sessionScheduled = {
    id: 'sess-adv-2',
    mode: 'SPECIAL_7V7',
    status: 'SCHEDULED',
    date: '2026-11-06T18:00:00Z',
    location: 'Turf Arena',
  };

  const sessionCompleted = {
    id: 'sess-adv-3',
    mode: 'SPECIAL_7V7',
    status: 'COMPLETED',
    date: '2026-11-06T18:00:00Z',
    location: 'Turf Arena',
  };

  const sessionStandard = {
    id: 'sess-adv-4',
    mode: 'STANDARD',
    status: 'IN_PROGRESS',
    date: '2026-11-06T18:00:00Z',
    location: 'Turf Arena',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Squad Size Boundaries: 7, 8, 9, 10 players and Asymmetric Squads', () => {
    it('squad size 7 (7 starters, 0 subs): renders exactly 7 Starters and NO Substitutes divider', () => {
      const playersA = makePlayers('A', 7);
      const playersB = makePlayers('B', 7);
      const onInitiateGoal = vi.fn();

      render(
        <PitchBoard
          session={sessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={onInitiateGoal}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      // Live board: one tap-to-score button per player, no Starter/Sub badges
      const starters = screen.getAllByRole('button', { name: /Record goal for/ });
      expect(starters).toHaveLength(14);

      // Zero Subs and zero Substitutes dividers
      expect(screen.queryByText('Sub')).toBeNull();
      expect(screen.queryByText(/Substitutes/)).toBeNull();

      // Ensure 7th player (index 6) can initiate goal
      const p7Btn = screen.getByText('APlayer_7').closest('button');
      expect(p7Btn).not.toBeNull();
      fireEvent.click(p7Btn!);
      expect(onInitiateGoal).toHaveBeenCalledWith('A-p7', teamA.id, playersA);
    });

    it('squad size 8 (7 starters, 1 sub): renders 7 Starters, 1 Sub, and "Substitutes (1)" divider per team', () => {
      const playersA = makePlayers('A', 8);
      const playersB = makePlayers('B', 8);
      const onInitiateGoal = vi.fn();

      render(
        <PitchBoard
          session={sessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={onInitiateGoal}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      expect(screen.getAllByRole('button', { name: /Record goal for/ })).toHaveLength(16);
      expect(screen.queryByText('Sub')).toBeNull();

      const dividers = screen.getAllByText('Substitutes (1)');
      expect(dividers).toHaveLength(2);

      // Sub player (APlayer_8) can initiate goal
      const subBtn = screen.getByText('APlayer_8').closest('button');
      fireEvent.click(subBtn!);
      expect(onInitiateGoal).toHaveBeenCalledWith('A-p8', teamA.id, playersA);
    });

    it('squad size 9 (7 starters, 2 subs): renders 7 Starters, 2 Subs, and "Substitutes (2)" divider', () => {
      const playersA = makePlayers('A', 9);
      const playersB = makePlayers('B', 9);
      const onInitiateGoal = vi.fn();

      render(
        <PitchBoard
          session={sessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={onInitiateGoal}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      expect(screen.getAllByRole('button', { name: /Record goal for/ })).toHaveLength(18);
      expect(screen.queryByText('Sub')).toBeNull();

      const dividers = screen.getAllByText('Substitutes (2)');
      expect(dividers).toHaveLength(2);

      // Both subs are clickable
      const sub1 = screen.getByText('APlayer_8').closest('button');
      const sub2 = screen.getByText('APlayer_9').closest('button');
      fireEvent.click(sub1!);
      expect(onInitiateGoal).toHaveBeenCalledWith('A-p8', teamA.id, playersA);
      fireEvent.click(sub2!);
      expect(onInitiateGoal).toHaveBeenCalledWith('A-p9', teamA.id, playersA);
    });

    it('squad size 10 (7 starters, 3 subs): renders 7 Starters, 3 Subs, and "Substitutes (3)" divider', () => {
      const playersA = makePlayers('A', 10);
      const playersB = makePlayers('B', 10);

      render(
        <PitchBoard
          session={sessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
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

      expect(screen.getAllByRole('button', { name: /Record goal for/ })).toHaveLength(20);
      expect(screen.queryByText('Sub')).toBeNull();
      expect(screen.getAllByText('Substitutes (3)')).toHaveLength(2);
    });

    it('handles asymmetric squads (Team A has 7 players, Team B has 10 players)', () => {
      const playersA = makePlayers('A', 7);
      const playersB = makePlayers('B', 10);
      const onInitiateGoal = vi.fn();

      render(
        <PitchBoard
          session={sessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={onInitiateGoal}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      // Players: 7 from Team A + 10 from Team B = 17
      expect(screen.getAllByRole('button', { name: /Record goal for/ })).toHaveLength(17);
      // Subs: 0 from Team A + 3 from Team B = 3
      expect(screen.queryByText('Sub')).toBeNull();
      // Only 1 divider for Team B
      const divider = screen.getByText('Substitutes (3)');
      expect(divider).toBeInTheDocument();

      // Trigger goal for Team A (passes 7-length array)
      fireEvent.click(screen.getByText('APlayer_1').closest('button')!);
      expect(onInitiateGoal).toHaveBeenCalledWith('A-p1', teamA.id, playersA);

      // Trigger goal for Team B sub (passes 10-length array)
      fireEvent.click(screen.getByText('BPlayer_10').closest('button')!);
      expect(onInitiateGoal).toHaveBeenCalledWith('B-p10', teamB.id, playersB);
    });
  });

  describe('2. Match Status Transitions: SCHEDULED, IN_PROGRESS, COMPLETED', () => {
    it('SCHEDULED state: renders roster cards, allows bib color selection for admin, no goal buttons', () => {
      const playersA = makePlayers('A', 8);
      const playersB = makePlayers('B', 8);
      const onBibColorChange = vi.fn();

      render(
        <PitchBoard
          session={sessionScheduled}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{ [teamA.id]: 'Red' }}
          events={[]}
          timeOnPitch={{ [teamA.id]: 0, [teamB.id]: 0 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={onBibColorChange}
          onOpenQueueManager={vi.fn()}
        />
      );

      // Roster cards show Starter and Sub badges
      expect(screen.getAllByText('Starter')).toHaveLength(14);
      expect(screen.getAllByText('Sub')).toHaveLength(2);
      expect(screen.getAllByText('Substitutes (1)')).toHaveLength(2);

      // No + GOAL action buttons exist in SCHEDULED state
      expect(screen.queryByText('+ GOAL')).toBeNull();

      // Admin sees bib color selector
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(1);
      fireEvent.change(selects[0], { target: { value: 'Blue' } });
      expect(onBibColorChange).toHaveBeenCalledWith(teamA.id, 'Blue');
    });

    it('SCHEDULED state: non-admin does NOT see bib color selectors', () => {
      const playersA = makePlayers('A', 8);
      const playersB = makePlayers('B', 8);

      render(
        <PitchBoard
          session={sessionScheduled}
          profile={playerProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 0, [teamB.id]: 0 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={vi.fn()}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('COMPLETED state: displays goals and assists tallies, renders Starter/Sub badges, no bib color dropdowns', () => {
      const playersA = makePlayers('A', 9);
      const playersB = makePlayers('B', 9);
      const events = [
        { id: 'ev-1', event_type: 'GOAL', player_id: 'A-p1', assisted_by: 'A-p8', team_id: teamA.id },
        { id: 'ev-2', event_type: 'GOAL', player_id: 'A-p8', assisted_by: null, team_id: teamA.id },
      ];

      render(
        <PitchBoard
          session={sessionCompleted}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{}}
          events={events}
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

      expect(screen.getAllByText('Starter')).toHaveLength(14);
      expect(screen.getAllByText('Sub')).toHaveLength(4);
      expect(screen.getAllByText('Substitutes (2)')).toHaveLength(2);

      // Verify goal and assist tallies on cards (2 goals + 1 assist = 3 badge tallies of "1")
      expect(screen.getAllByText('1')).toHaveLength(3);
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(screen.queryByText('+ GOAL')).toBeNull();
    });
  });

  describe('3. Permission Boundary: Admin vs Non-Admin in Live Match', () => {
    it('non-admin user cannot click players to initiate goals and does not see END MATCH DAY', () => {
      const playersA = makePlayers('A', 7);
      const playersB = makePlayers('B', 7);
      const onInitiateGoal = vi.fn();
      const onEndSession = vi.fn();

      render(
        <PitchBoard
          session={sessionInProgress}
          profile={playerProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={onInitiateGoal}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={onEndSession}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      // Player button should be disabled
      const btn = screen.getByText('APlayer_1').closest('button');
      expect(btn).toBeDisabled();
      fireEvent.click(btn!);
      expect(onInitiateGoal).not.toHaveBeenCalled();

      // No + GOAL badges
      expect(screen.queryByText('+ GOAL')).toBeNull();

      // No END MATCH DAY button
      expect(screen.queryByText('END MATCH DAY')).toBeNull();
    });

    it('admin user sees enabled buttons, tap-to-score names, and END MATCH DAY button', () => {
      const playersA = makePlayers('A', 7);
      const playersB = makePlayers('B', 7);
      const onEndSession = vi.fn();

      render(
        <PitchBoard
          session={sessionInProgress}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: playersA, [teamB.id]: playersB }}
          waiting={[]}
          bibColors={{}}
          events={[]}
          timeOnPitch={{ [teamA.id]: 1, [teamB.id]: 1 }}
          onPitch={[teamA, teamB]}
          onInitiateGoal={vi.fn()}
          onSwapTeam={vi.fn()}
          onRecordTimeUp={vi.fn()}
          onEndSession={onEndSession}
          onBibColorChange={vi.fn()}
          onOpenQueueManager={vi.fn()}
        />
      );

      const btn = screen.getByText('APlayer_1').closest('button');
      expect(btn).not.toBeDisabled();

      const goalBadges = screen.getAllByRole('button', { name: /Record goal for/ });
      expect(goalBadges).toHaveLength(14); // 7 + 7

      const endMatchBtn = screen.getByText('END MATCH DAY');
      expect(endMatchBtn).toBeInTheDocument();
      fireEvent.click(endMatchBtn);
      expect(onEndSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. AssistModal Invariants across 7, 8, 9, 10-player rosters', () => {
    it('verifies exact teammate count and scorer exclusion for squad size 7', () => {
      const squad = makePlayers('A', 7);
      const onConfirm = vi.fn();

      const { container } = render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'A-p1',
            teamId: teamA.id,
            teamPlayers: squad,
          }}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      );

      const scrollContainer = container.querySelector('.max-h-\\[60vh\\].overflow-y-auto');
      expect(scrollContainer).not.toBeNull();

      // 6 teammates + 1 "No Assist" = 7 buttons
      const buttons = scrollContainer?.querySelectorAll('button');
      expect(buttons).toHaveLength(7);

      // Scorer APlayer_1 not in assist options
      expect(within(scrollContainer as HTMLElement).queryByText('APlayer_1')).toBeNull();

      // Last starter (APlayer_7) is selectable
      fireEvent.click(screen.getByText('APlayer_7'));
      expect(onConfirm).toHaveBeenCalledWith('A-p7');
    });

    it('verifies sub-scorer in squad size 8 can attribute assist to starter', () => {
      const squad = makePlayers('A', 8);
      const onConfirm = vi.fn();

      const { container } = render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'A-p8', // Sub scored!
            teamId: teamA.id,
            teamPlayers: squad,
          }}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      );

      const scrollContainer = container.querySelector('.max-h-\\[60vh\\].overflow-y-auto');
      // 7 teammates + 1 "No Assist" = 8 buttons
      expect(scrollContainer?.querySelectorAll('button')).toHaveLength(8);

      expect(within(scrollContainer as HTMLElement).queryByText('APlayer_8')).toBeNull();

      // Starter APlayer_3 assisted
      fireEvent.click(screen.getByText('APlayer_3'));
      expect(onConfirm).toHaveBeenCalledWith('A-p3');
    });

    it('verifies starter scorer in squad size 10 can attribute assist to substitute', () => {
      const squad = makePlayers('A', 10);
      const onConfirm = vi.fn();

      const { container } = render(
        <AssistModal
          isOpen={true}
          pendingGoal={{
            playerId: 'A-p2',
            teamId: teamA.id,
            teamPlayers: squad,
          }}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      );

      const scrollContainer = container.querySelector('.max-h-\\[60vh\\].overflow-y-auto');
      // 9 teammates + 1 "No Assist" = 10 buttons
      expect(scrollContainer?.querySelectorAll('button')).toHaveLength(10);

      // Sub APlayer_10 assisted
      fireEvent.click(screen.getByText('APlayer_10'));
      expect(onConfirm).toHaveBeenCalledWith('A-p10');
    });
  });

  describe('5. WhatsApp Share Formatting across Squad Variations', () => {
    let clipboardText = '';

    beforeEach(() => {
      clipboardText = '';
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockImplementation((text: string) => {
            clipboardText = text;
            return Promise.resolve();
          }),
        },
      });
    });

    it('formats pre-match share for 7-player team (all starters, no subs in text)', () => {
      const squadA = makePlayers('A', 7);
      const squadB = makePlayers('B', 7);

      render(
        <MemoryRouter>
          <MatchHeader
            session={sessionInProgress}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: squadA, [teamB.id]: squadB }}
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

      fireEvent.click(screen.getByTitle('Copy Teams'));

      expect(clipboardText).toContain('🎯 Mode: 7v7 Special');
      expect(clipboardText).toContain('1. APlayer_1');
      expect(clipboardText).toContain('7. APlayer_7');
      expect(clipboardText).not.toContain('(Starter)');
      expect(clipboardText).not.toContain('(Sub)');
    });

    it('formats pre-match share for 9-player team (7 starters, 2 subs)', () => {
      const squadA = makePlayers('A', 9);
      const squadB = makePlayers('B', 9);

      render(
        <MemoryRouter>
          <MatchHeader
            session={sessionInProgress}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 0, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: squadA, [teamB.id]: squadB }}
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

      fireEvent.click(screen.getByTitle('Copy Teams'));

      expect(clipboardText).toContain('7. APlayer_7');
      expect(clipboardText).toContain('8. APlayer_8');
      expect(clipboardText).toContain('9. APlayer_9');
      expect(clipboardText).not.toContain('10. APlayer_10');
      expect(clipboardText).not.toContain('(Starter)');
      expect(clipboardText).not.toContain('(Sub)');
    });

    it('formats completed match stats share distinguishing starter and sub goalscorers', () => {
      const squadA = makePlayers('A', 10);
      const squadB = makePlayers('B', 10);
      const events = [
        { id: 'e1', event_type: 'GOAL', player_id: 'A-p1', assisted_by: 'A-p9', team_id: teamA.id },
        { id: 'e2', event_type: 'GOAL', player_id: 'A-p9', assisted_by: null, team_id: teamA.id },
      ];

      render(
        <MemoryRouter>
          <MatchHeader
            session={sessionCompleted}
            profile={adminProfile}
            teamScores={{ [teamA.id]: 2, [teamB.id]: 0 }}
            onPitch={[teamA, teamB]}
            waiting={[]}
            teamPlayers={{ [teamA.id]: squadA, [teamB.id]: squadB }}
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

      fireEvent.click(screen.getByTitle('Copy Match Stats'));

      expect(clipboardText).toContain('🎯 Mode: 7v7 Special');
      expect(clipboardText).toContain('- APlayer_1: 1 G');
      expect(clipboardText).toContain('- APlayer_9: 1 G, 1 A');
      expect(clipboardText).not.toContain('(Starter)');
      expect(clipboardText).not.toContain('(Sub)');
    });
  });

  describe('6. Non-Interference: STANDARD mode safety', () => {
    it('never renders 7v7 Special artifacts in STANDARD mode even with > 7 players', () => {
      const largeSquadA = makePlayers('A', 8);
      const largeSquadB = makePlayers('B', 8);

      render(
        <PitchBoard
          session={sessionStandard}
          profile={adminProfile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={{ [teamA.id]: largeSquadA, [teamB.id]: largeSquadB }}
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

    it('Scoreboard never renders "7v7 Special" in STANDARD mode', () => {
      render(
        <Scoreboard
          session={sessionStandard}
          teamA={teamA}
          teamB={teamB}
          teamScores={{ [teamA.id]: 2, [teamB.id]: 1 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={{ [teamA.id]: makePlayers('A', 5), [teamB.id]: makePlayers('B', 5) }}
          profile={adminProfile}
          onOpenVoting={vi.fn()}
          onPitch={[teamA, teamB]}
          waiting={[]}
        />
      );

      expect(screen.queryByText('7v7 Special')).toBeNull();
    });
  });
});
