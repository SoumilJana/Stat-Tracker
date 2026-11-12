import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  describe('Pay Now', () => {
    const originalUA = navigator.userAgent;
    const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });

    afterEach(() => {
      setUA(originalUA);
      Object.assign(navigator, { share: undefined, canShare: undefined });
    });

    const renderReady = async (onPayNowClick = vi.fn()) => {
      render(<DynamicQRCode recipient={mockProfile} amount={80} onPayNowClick={onPayNowClick} />);
      await screen.findByRole('img', { name: /UPI QR code for Soumil Jana/i });
      return onPayNowClick;
    };

    it('on Android, shares the QR image and then notifies the parent', async () => {
      setUA('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
      const share = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share, canShare: () => true });
      const handlePayNow = await renderReady();

      fireEvent.click(screen.getByRole('button', { name: /Pay Now via UPI App/i }));

      await waitFor(() => expect(handlePayNow).toHaveBeenCalledTimes(1));
      const shared = share.mock.calls[0][0];
      expect(shared.files[0]).toBeInstanceOf(File);
      expect(shared.files[0].type).toBe('image/png');
      expect(screen.getByRole('status')).toHaveTextContent(/come back here/i);
    });

    it('does not notify the parent when the share sheet is dismissed', async () => {
      setUA('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
      const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
      Object.assign(navigator, { share, canShare: () => true });
      const handlePayNow = await renderReady();

      fireEvent.click(screen.getByRole('button', { name: /Pay Now via UPI App/i }));

      await waitFor(() => expect(share).toHaveBeenCalled());
      expect(handlePayNow).not.toHaveBeenCalled();
    });

    it('falls back to saving the QR when sharing files is unsupported', async () => {
      setUA('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const handlePayNow = await renderReady();

      fireEvent.click(screen.getByRole('button', { name: /Pay Now via UPI App/i }));

      await waitFor(() => expect(handlePayNow).toHaveBeenCalledTimes(1));
      expect(clickSpy).toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(/QR saved/i);
      clickSpy.mockRestore();
    });

    it('on iOS, shows UPI app choices instead of opening upi:// directly', async () => {
      setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
      const handlePayNow = await renderReady();

      fireEvent.click(screen.getByRole('button', { name: /Pay Now via UPI App/i }));

      expect(screen.getByRole('button', { name: 'Google Pay' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'PhonePe' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Paytm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save QR image/i })).toBeInTheDocument();
      expect(handlePayNow).not.toHaveBeenCalled();
    });
  });
});
