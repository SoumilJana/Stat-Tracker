import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DynamicQRCode } from '../DynamicQRCode';
import type { PaymentProfile } from '../../../types/gamePayment';

const mockProfile: PaymentProfile = {
  id: 'p-1',
  display_name: 'Soumil Jana',
  upi_id: '9432938110@superyes',
  qr_image_url: '/qr/soumil-qr.png',
  active: true,
  sort_order: 1
};

describe('Phase 2: DynamicQRCode Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders payee name, UPI ID, and amount properly', async () => {
    render(<DynamicQRCode recipient={mockProfile} amount={80} />);

    expect(screen.getByText('Soumil Jana')).toBeInTheDocument();
    expect(screen.getByText('9432938110@superyes')).toBeInTheDocument();
    expect(screen.getByText('₹80')).toBeInTheDocument();
  });

  it('renders the generated QR code image', async () => {
    render(<DynamicQRCode recipient={mockProfile} amount={80} />);

    await waitFor(() => {
      const qrImg = screen.getByRole('img', { name: /UPI QR code for Soumil Jana - ₹80/i });
      expect(qrImg).toBeInTheDocument();
    });
  });

  it('allows switching between dynamic amount QR and original static QR image', async () => {
    render(<DynamicQRCode recipient={mockProfile} amount={80} />);

    const staticToggleBtn = screen.getByRole('button', { name: /Original QR/i });
    fireEvent.click(staticToggleBtn);

    const originalImg = screen.getByRole('img', { name: /Official QR code for Soumil Jana/i });
    expect(originalImg).toBeInTheDocument();
    expect(originalImg).toHaveAttribute('src', '/qr/soumil-qr.png');
  });

  it('triggers onPayNowClick when Pay Now button is pressed', async () => {
    const handlePayNow = vi.fn();
    render(<DynamicQRCode recipient={mockProfile} amount={80} onPayNowClick={handlePayNow} />);

    const payNowBtn = screen.getByRole('button', { name: /Pay Now via UPI App/i });
    fireEvent.click(payNowBtn);

    expect(handlePayNow).toHaveBeenCalledTimes(1);
  });
});
