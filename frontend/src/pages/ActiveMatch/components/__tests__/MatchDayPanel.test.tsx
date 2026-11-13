import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchDayPanel } from '../MatchDayPanel';

const teams = {
  teamA: { id: 'tA', name: 'Team A' },
  teamB: { id: 'tC', name: 'Team C' },
  waiting: [
    { id: 'tB', name: 'Team B' },
    { id: 'tD', name: 'Team D' }
  ]
};

const renderPanel = (overrides: Record<string, any> = {}) => {
  const props = {
    profile: { role: 'admin' },
    ...teams,
    teamScores: { tA: 3, tC: 1, tB: 2, tD: 0 },
    bibColors: { tA: 'Red' },
    onBibColorChange: vi.fn(),
    onOpenQueueManager: vi.fn(),
    onEndSession: vi.fn(),
    ...overrides
  };
  render(<MatchDayPanel {...props} />);
  return props;
};

describe('MatchDayPanel', () => {
  it('lists every team in play order with its goals and position', () => {
    renderPanel();
    const rows = screen.getAllByTestId(/^match-day-team-/);
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'match-day-team-tA',
      'match-day-team-tC',
      'match-day-team-tB',
      'match-day-team-tD'
    ]);
    expect(rows[0]).toHaveTextContent('On pitch');
    expect(rows[0]).toHaveTextContent('3');
    expect(rows[2]).toHaveTextContent('Next');
    expect(rows[3]).toHaveTextContent('2nd');
  });

  it('admins change bib colours, reorder the queue and end the match day', () => {
    const props = renderPanel();
    expect(screen.getByRole('combobox', { name: 'Bib colour for Team A' })).toHaveValue('Red');
    fireEvent.change(screen.getByRole('combobox', { name: 'Bib colour for Team B' }), { target: { value: 'Blue' } });
    expect(props.onBibColorChange).toHaveBeenCalledWith('tB', 'Blue');

    fireEvent.click(screen.getByRole('button', { name: /Reorder queue/i }));
    expect(props.onOpenQueueManager).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /END MATCH DAY/ }));
    expect(props.onEndSession).toHaveBeenCalled();
  });

  it('players see the order and bib colours but no controls', () => {
    renderPanel({ profile: { role: 'player' } });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('match-day-team-tA')).toHaveTextContent('Red');
  });
});
