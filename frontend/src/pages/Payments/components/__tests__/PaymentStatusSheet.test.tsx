import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayerRosterList } from '../PlayerRosterList';
import { currentChoice } from '../PaymentStatusSheet';
import { adminSetPaymentStatus } from '../../../../lib/gamePaymentsApi';
import { supabase } from '../../../../lib/supabase';
import type { PlayerRosterItem } from '../../../../types/gamePayment';

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) }
  }
}));

const paidCash: PlayerRosterItem = {
  user_id: 'u5',
  username: 'Asmit',
  response: 'IN',
  joined_at: '2026-11-11T16:39:00Z',
  slot_number: 5,
  is_waitlist: false,
  payment: { id: 'pay-5', game_id: 'g-1', user_id: 'u5', amount: 80, method: 'CASH', status: 'VERIFIED' }
};

describe('Admin payment status menu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin taps a Paid badge and changes it to Cash Due', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<PlayerRosterList activeSquad={[paidCash]} waitingList={[]} outList={[]} isAdmin onChangePaymentStatus={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Change payment status for Asmit/i }));
    expect(screen.getByRole('dialog', { name: /Change payment status for Asmit/i })).toBeInTheDocument();

    // Current status is preselected, so saving is disabled until something else is picked
    expect(screen.getByRole('radio', { name: /Paid \(Cash received\)/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /Update status/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /Cash Due/i }));
    fireEvent.click(screen.getByRole('button', { name: /Update status/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('u5', 'CASH_DUE'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('players cannot tap the badge', () => {
    render(<PlayerRosterList activeSquad={[paidCash]} waitingList={[]} outList={[]} onChangePaymentStatus={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Change payment status/i })).not.toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('keeps the menu open if saving fails', async () => {
    const onChange = vi.fn().mockRejectedValue(new Error('nope'));
    render(<PlayerRosterList activeSquad={[paidCash]} waitingList={[]} outList={[]} isAdmin onChangePaymentStatus={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Change payment status for Asmit/i }));
    fireEvent.click(screen.getByRole('radio', { name: /Not paid/i }));
    fireEvent.click(screen.getByRole('button', { name: /Update status/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('maps payments to the matching option', () => {
    expect(currentChoice(null)).toBe('NOT_PAID');
    expect(currentChoice({ ...paidCash.payment!, method: 'UPI' })).toBe('PAID_UPI');
    expect(currentChoice({ ...paidCash.payment!, status: 'PENDING' })).toBe('CASH_DUE');
    expect(currentChoice({ ...paidCash.payment!, method: 'LATER', status: 'PENDING' })).toBe('PAY_LATER');
    expect(currentChoice({ ...paidCash.payment!, method: 'UPI', status: 'AWAITING_VERIFICATION' })).toBeNull();
  });

  it('calls the database function, and pushes "verified" only when set to paid', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: { success: true, payment_id: 'pay-5', status: 'PENDING' }, error: null });
    await adminSetPaymentStatus('g-1', 'u5', 'CASH_DUE');
    expect(supabase.rpc).toHaveBeenCalledWith('admin_set_payment_status', { p_game_id: 'g-1', p_user_id: 'u5', p_choice: 'CASH_DUE' });
    await new Promise((r) => setTimeout(r, 0));
    expect(supabase.functions.invoke).not.toHaveBeenCalled();

    (supabase.rpc as any).mockResolvedValueOnce({ data: { success: true, payment_id: 'pay-5', status: 'VERIFIED' }, error: null });
    await adminSetPaymentStatus('g-1', 'u5', 'PAID_UPI');
    await new Promise((r) => setTimeout(r, 0));
    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
      body: { notificationType: 'PAYMENT_VERIFIED', paymentId: 'pay-5' }
    });
  });
});
