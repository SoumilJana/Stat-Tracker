import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentSection } from '../PaymentSection';
import type { Game, PaymentProfile } from '../../../../types/gamePayment';

const mockGame: Game = {
  id: 'game-1',
  game_date: '2026-11-15',
  start_time: '19:00',
  location: 'Plaza Turf',
  amount_per_player: 80,
  total_turf_cost: 800,
  duration_minutes: 60,
  mode: 'STANDARD',
  min_players: 10,
  max_players: 15,
  status: 'PAYMENT_OPEN',
  payment_opened_at: '2026-11-11T10:00:00Z',
  created_at: '2026-11-11T09:00:00Z',
  updated_at: '2026-11-11T10:00:00Z'
};

const mockProfiles: PaymentProfile[] = [
  {
    id: 'p-1',
    display_name: 'Soumil Jana',
    upi_id: '9432938110@superyes',
    qr_image_url: '/qr/soumil-qr.png',
    active: true,
    sort_order: 1
  }
];

describe('Phase 4: PaymentSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders locked message when user is on the waiting list', () => {
    render(
      <PaymentSection
        game={mockGame}
        paymentProfiles={mockProfiles}
        isUserInSquad={false}
        isUserWaitlisted={true}
        isPaymentUnlocked={true}
        onSubmitPayment={vi.fn()}
      />
    );

    expect(screen.getByText('You are on the Waiting List')).toBeInTheDocument();
    expect(screen.getByText(/Payment is locked/i)).toBeInTheDocument();
  });

  it('renders invitation to react IN when user has not joined squad', () => {
    render(
      <PaymentSection
        game={mockGame}
        paymentProfiles={mockProfiles}
        isUserInSquad={false}
        isUserWaitlisted={false}
        isPaymentUnlocked={true}
        onSubmitPayment={vi.fn()}
      />
    );

    expect(screen.getByText(/"I'm IN"/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment Section/i)).toBeInTheDocument();
  });

  it('renders threshold wait message when payments are not yet unlocked', () => {
    render(
      <PaymentSection
        game={mockGame}
        paymentProfiles={mockProfiles}
        isUserInSquad={true}
        isUserWaitlisted={false}
        isPaymentUnlocked={false}
        onSubmitPayment={vi.fn()}
      />
    );

    expect(screen.getByText('Waiting for 10 Players')).toBeInTheDocument();
  });

  it('renders verified success card when payment is already verified', () => {
    render(
      <PaymentSection
        game={mockGame}
        userPayment={{
          id: 'pay-1',
          game_id: 'game-1',
          user_id: 'u-1',
          amount: 80,
          method: 'UPI',
          status: 'VERIFIED',
          created_at: '2026-11-11T10:00:00Z',
          updated_at: '2026-11-11T10:00:00Z'
        }}
        paymentProfiles={mockProfiles}
        isUserInSquad={true}
        isUserWaitlisted={false}
        isPaymentUnlocked={true}
        onSubmitPayment={vi.fn()}
      />
    );

    expect(screen.getByText("You're All Set!")).toBeInTheDocument();
    expect(screen.getByText('Verified Match Entry')).toBeInTheDocument();
  });

  it('submits cash payment when Cash tab is selected', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentSection
        game={mockGame}
        paymentProfiles={mockProfiles}
        isUserInSquad={true}
        isUserWaitlisted={false}
        isPaymentUnlocked={true}
        onSubmitPayment={handleSubmit}
      />
    );

    // Switch to Cash tab
    const cashTab = screen.getByRole('button', { name: /Cash/i });
    fireEvent.click(cashTab);

    // Submit Cash
    const submitBtn = screen.getByRole('button', { name: /Submit Cash Request/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith('CASH');
  });

  it('opens UTR reporting modal and submits UPI claim', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentSection
        game={mockGame}
        paymentProfiles={mockProfiles}
        isUserInSquad={true}
        isUserWaitlisted={false}
        isPaymentUnlocked={true}
        onSubmitPayment={handleSubmit}
      />
    );

    // Click "I Have Made This Payment"
    const reportBtn = screen.getByRole('button', { name: /I Have Made This Payment/i });
    fireEvent.click(reportBtn);

    // Modal appears
    expect(screen.getByText('Confirm Payment Submission')).toBeInTheDocument();

    const utrInput = screen.getByPlaceholderText(/e\.g\. 432187654321/i);
    fireEvent.change(utrInput, { target: { value: '987654321012' } });

    const confirmBtn = screen.getByRole('button', { name: /Mark as Paid/i });
    fireEvent.click(confirmBtn);

    expect(handleSubmit).toHaveBeenCalledWith('UPI', 'p-1', '987654321012');
  });
});
