import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WhatsAppSummaryModal } from '../WhatsAppSummaryModal';
import type { Game, PlayerRosterItem } from '../../../../types/gamePayment';

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
  created_at: '2026-11-11T10:00:00Z',
  updated_at: '2026-11-11T10:00:00Z'
};

const mockSquad: PlayerRosterItem[] = [
  {
    user_id: 'u-1',
    username: 'Soumil Jana',
    response: 'IN',
    joined_at: '2026-11-11T10:00:00Z',
    slot_number: 1,
    is_waitlist: false,
    payment: {
      id: 'pay-1',
      game_id: 'game-1',
      user_id: 'u-1',
      amount: 80,
      method: 'UPI',
      status: 'VERIFIED',
      created_at: '2026-11-11T10:00:00Z',
      updated_at: '2026-11-11T10:00:00Z'
    }
  }
];

describe('Phase 6: WhatsAppSummaryModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal header, summary text preview, and action buttons', () => {
    render(
      <WhatsAppSummaryModal
        game={mockGame}
        activeSquad={mockSquad}
        waitingList={[]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('WhatsApp Game Summary')).toBeInTheDocument();
    expect(screen.getByText('Message Preview:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Share on WhatsApp/i })).toBeInTheDocument();
  });

  it('copies summary text to clipboard on button click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText }
    });

    render(
      <WhatsAppSummaryModal
        game={mockGame}
        activeSquad={mockSquad}
        waitingList={[]}
        onClose={vi.fn()}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /Copy Summary/i });
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalled();
  });

  it('opens WhatsApp share URL in a new window on button click', () => {
    const openMock = vi.fn();
    window.open = openMock;

    render(
      <WhatsAppSummaryModal
        game={mockGame}
        activeSquad={mockSquad}
        waitingList={[]}
        onClose={vi.fn()}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share on WhatsApp/i });
    fireEvent.click(shareBtn);

    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.whatsapp.com/send?text='),
      '_blank',
      'noopener,noreferrer'
    );
  });
});
