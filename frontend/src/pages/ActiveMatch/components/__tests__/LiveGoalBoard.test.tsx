import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LiveGoalBoard, playerMatchStats } from '../LiveGoalBoard';

const teamA = { id: 'tA', name: 'Team A' };
const teamB = { id: 'tB', name: 'Team B' };
const teamPlayers = {
  tA: [{ id: 'abhi', username: 'Abhi' }, { id: 'ani', username: 'Ani' }],
  tB: [{ id: 'asmit', username: 'Asmit' }, { id: 'bishal', username: 'Bishal' }]
};
// Newest first, like the live data hook
const events = [
  { id: 'e3', event_type: 'GOAL', player_id: 'asmit', team_id: 'tB', assisted_by: 'bishal' },
  { id: 'e2', event_type: 'GOAL', player_id: 'ani', team_id: 'tB', is_own_goal: true },
  { id: 'e1', event_type: 'GOAL', player_id: 'abhi', team_id: 'tA', assisted_by: 'ani' }
];

const renderBoard = (overrides: Record<string, any> = {}) => {
  const props = {
    session: { status: 'IN_PROGRESS', mode: 'STANDARD' },
    profile: { role: 'admin' },
    teamA,
    teamB,
    teamPlayers,
    teamScores: { tA: 1, tB: 2 },
    events,
    waiting: [],
    onInitiateGoal: vi.fn(),
    onSwapTeam: vi.fn(),
    onUndoEvent: vi.fn(),
    ...overrides
  };
  render(<LiveGoalBoard {...props} />);
  return props;
};

describe('LiveGoalBoard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows both teams side by side with their scores', () => {
    renderBoard();
    const colA = screen.getByTestId('live-column-A');
    const colB = screen.getByTestId('live-column-B');
    expect(within(colA).getByLabelText('Team A score')).toHaveTextContent('1');
    expect(within(colB).getByLabelText('Team B score')).toHaveTextContent('2');
    expect(within(colA).getByText('Abhi')).toBeInTheDocument();
    expect(within(colB).getByText('Asmit')).toBeInTheDocument();
    expect(screen.queryByText('+ GOAL')).toBeNull();
  });

  it('tapping a name opens the goal prompt for that player', () => {
    const props = renderBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Record goal for Asmit' }));
    expect(props.onInitiateGoal).toHaveBeenCalledWith('asmit', 'tB', teamPlayers.tB);
  });

  it('shows goals, assists and own goals next to names', () => {
    expect(playerMatchStats(events, 'abhi')).toEqual({ goals: 1, assists: 0, ownGoals: 0 });
    expect(playerMatchStats(events, 'ani')).toEqual({ goals: 0, assists: 1, ownGoals: 1 });
    renderBoard();
    const ani = screen.getByRole('button', { name: 'Record goal for Ani' });
    expect(ani).toHaveTextContent('1A');
    expect(ani).toHaveTextContent('1OG');
    expect(screen.getByRole('button', { name: 'Record goal for Abhi' })).toHaveTextContent('⚽1');
  });

  it('undoes the last goal after confirming', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderBoard();
    return (async () => {
      fireEvent.click(screen.getByRole('button', { name: /Undo last goal \(Asmit\)/ }));
      await Promise.resolve();
      expect(props.onUndoEvent).toHaveBeenCalledWith('e3');
    })();
  });

  it('keeps the goal when the undo is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = renderBoard();
    fireEvent.click(screen.getByRole('button', { name: /Undo last goal/ }));
    await Promise.resolve();
    expect(props.onUndoEvent).not.toHaveBeenCalled();
  });

  it('hides undo when the latest event is not a goal', () => {
    renderBoard({ events: [{ id: 'e9', event_type: 'NO_GOAL_TIME_UP' }, ...events] });
    expect(screen.queryByRole('button', { name: /Undo last goal/ })).toBeNull();
  });

  it('players see the board read-only', () => {
    const props = renderBoard({ profile: { role: 'player' } });
    const abhi = screen.getByRole('button', { name: 'Abhi' });
    expect(abhi).toBeDisabled();
    fireEvent.click(abhi);
    expect(props.onInitiateGoal).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Undo last goal/ })).toBeNull();
  });
});
