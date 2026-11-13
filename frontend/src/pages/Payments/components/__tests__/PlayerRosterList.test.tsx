import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerRosterList } from '../PlayerRosterList';
import type { PlayerRosterItem } from '../../../../types/gamePayment';

const mockActiveSquad: PlayerRosterItem[] = [
  {
    user_id: 'u1',
    username: 'Soumil Jana',
    response: 'IN',
    joined_at: '2026-11-11T10:00:00Z',
    slot_number: 1,
    is_waitlist: false,
    payment: {
      id: 'pay-1',
      game_id: 'g-1',
      user_id: 'u1',
      amount: 80,
      method: 'UPI',
      status: 'VERIFIED',
      created_at: '2026-11-11T10:05:00Z',
      updated_at: '2026-11-11T10:05:00Z'
    }
  },
  {
    user_id: 'u2',
    username: 'Souvik Roy',
    response: 'IN',
    joined_at: '2026-11-11T10:02:00Z',
    slot_number: 2,
    is_waitlist: false,
    payment: null
  }
];

const mockWaitingList: PlayerRosterItem[] = [
  {
    user_id: 'u11',
    username: 'Rohit Sharma',
    response: 'IN',
    joined_at: '2026-11-11T10:20:00Z',
    slot_number: 11,
    is_waitlist: true,
    payment: null
  }
];

describe('Phase 3: PlayerRosterList Component', () => {
  it('renders active squad in order with slot numbers and statuses', () => {
    render(
      <PlayerRosterList
        activeSquad={mockActiveSquad}
        waitingList={[]}
        outList={[]}
        currentUserId="u1"
      />
    );

    expect(screen.getByText('Soumil Jana')).toBeInTheDocument();
    expect(screen.getByText('(You)')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();

    expect(screen.getByText('Souvik Roy')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('Due')).toBeInTheDocument();
  });

  it('renders waiting list section when players exist beyond 10', () => {
    render(
      <PlayerRosterList
        activeSquad={mockActiveSquad}
        waitingList={mockWaitingList}
        outList={[]}
      />
    );

    expect(screen.getByText('Waiting List')).toBeInTheDocument();
    expect(screen.getByText('1 In Line')).toBeInTheDocument();
    expect(screen.getByText('Rohit Sharma')).toBeInTheDocument();
    expect(screen.getByText('#11')).toBeInTheDocument();
  });

  it('renders quick checkmark button for admins on unverified players and calls onQuickVerify', () => {
    const handleQuickVerify = vi.fn();
    render(
      <PlayerRosterList
        activeSquad={mockActiveSquad}
        waitingList={[]}
        outList={[]}
        isAdmin={true}
        onQuickVerify={handleQuickVerify}
      />
    );

    // Soumil is already verified, so button is not shown for Soumil
    expect(screen.queryByLabelText(/Mark Soumil Jana as paid/i)).not.toBeInTheDocument();

    // Souvik is unverified, so checkmark button should be rendered
    const quickCheckBtn = screen.getByLabelText(/Mark Souvik Roy as paid/i);
    expect(quickCheckBtn).toBeInTheDocument();

    fireEvent.click(quickCheckBtn);
    expect(handleQuickVerify).toHaveBeenCalledWith('u2');
  });

  it('shows a cash choice as Cash Due, not paid', () => {
    const squad: PlayerRosterItem[] = [
      {
        ...mockActiveSquad[1],
        payment: {
          id: 'pay-2',
          game_id: 'g-1',
          user_id: 'u2',
          amount: 80,
          method: 'CASH',
          status: 'PENDING'
        }
      }
    ];
    render(<PlayerRosterList activeSquad={squad} waitingList={[]} outList={[]} isAdmin onQuickVerify={vi.fn()} />);

    expect(screen.getByText('Cash Due')).toBeInTheDocument();
    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark Souvik Roy as paid/i })).toBeInTheDocument();
  });
});
