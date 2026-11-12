import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateUpiUri,
  toAppSpecificUri,
  detectPlatform,
  dataUrlToFile,
  shareQrImage,
  generateQrDataUrl,
  generateQrSvg,
  copyToClipboard,
  DEFAULT_PAYMENT_PROFILES
} from '../upiUtils';

describe('Phase 2: UPI Utilities & Vector QR Generator', () => {
  describe('generateUpiUri', () => {
    it('creates a standard NPCI compliant UPI URI with pre-filled amount', () => {
      const uri = generateUpiUri({
        upiId: '9432938110@superyes',
        payeeName: 'Soumil Jana',
        amount: 80,
        note: 'StatTracker Match Fee'
      });

      expect(uri).toBe(
        'upi://pay?pa=9432938110@superyes&pn=Soumil%20Jana&am=80.00&cu=INR&tn=StatTracker%20Match%20Fee'
      );
      expect(uri).not.toContain('+');
      expect(uri).not.toContain('%40');
    });

    it('re-targets the URI at specific UPI apps for iOS', () => {
      const uri = generateUpiUri({ upiId: 'a@b', payeeName: 'A B', amount: 80 });
      const query = 'pa=a@b&pn=A%20B&am=80.00&cu=INR';
      expect(toAppSpecificUri(uri, 'gpay')).toBe(`gpay://upi/pay?${query}`);
      expect(toAppSpecificUri(uri, 'phonepe')).toBe(`phonepe://pay?${query}`);
      expect(toAppSpecificUri(uri, 'paytm')).toBe(`paytmmp://pay?${query}`);
    });

    it('formats amount to 2 decimal places properly', () => {
      const uri = generateUpiUri({
        upiId: 'test@upi',
        payeeName: 'Test Player',
        amount: 150.5
      });

      expect(uri).toContain('am=150.50');
    });

    it('defaults to 80.00 if amount is 0 or negative', () => {
      const uri = generateUpiUri({
        upiId: 'test@upi',
        payeeName: 'Test Player',
        amount: 0
      });

      expect(uri).toContain('am=80.00');
    });

    it('throws error when upiId or payeeName is missing', () => {
      expect(() =>
        generateUpiUri({
          upiId: '',
          payeeName: 'Test',
          amount: 80
        })
      ).toThrow('UPI ID and Payee Name are required');

      expect(() =>
        generateUpiUri({
          upiId: 'test@upi',
          payeeName: '',
          amount: 80
        })
      ).toThrow('UPI ID and Payee Name are required');
    });
  });

  describe('generateQrDataUrl & generateQrSvg', () => {
    it('generates an offline QR PNG Data URL', async () => {
      const dataUrl = await generateQrDataUrl('upi://pay?pa=9432938110@superyes&am=80.00');
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('generates an offline QR SVG string', async () => {
      const svg = await generateQrSvg('upi://pay?pa=9432938110@superyes&am=80.00');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });
  });

  describe('detectPlatform', () => {
    it('detects Android, iPhone, iPadOS and desktop', () => {
      expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe('android');
      expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe('ios');
      expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
      expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other');
      expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe('other');
    });
  });

  describe('dataUrlToFile & shareQrImage', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

    afterEach(() => {
      Object.assign(navigator, { share: undefined, canShare: undefined });
    });

    it('converts a data URL to a PNG File', () => {
      const file = dataUrlToFile(dataUrl, 'qr.png');
      expect(file.name).toBe('qr.png');
      expect(file.type).toBe('image/png');
      expect(file.size).toBe(8);
    });

    it('returns unsupported when file sharing is unavailable', async () => {
      Object.assign(navigator, { share: undefined, canShare: undefined });
      expect(await shareQrImage(dataUrlToFile(dataUrl, 'qr.png'), 'x')).toBe('unsupported');
    });

    it('shares the file when supported, and reports a cancelled share', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share, canShare: () => true });
      const file = dataUrlToFile(dataUrl, 'qr.png');
      expect(await shareQrImage(file, 'pay')).toBe('shared');
      expect(share).toHaveBeenCalledWith({ files: [file], text: 'pay' });

      share.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));
      expect(await shareQrImage(file, 'pay')).toBe('cancelled');
    });
  });

  describe('copyToClipboard', () => {
    it('copies text using navigator.clipboard when available', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText }
      });

      const success = await copyToClipboard('9432938110@superyes');
      expect(success).toBe(true);
      expect(writeText).toHaveBeenCalledWith('9432938110@superyes');
    });
  });

  describe('DEFAULT_PAYMENT_PROFILES', () => {
    it('contains Soumil Jana and Asmit Ghosh as default payment recipients', () => {
      expect(DEFAULT_PAYMENT_PROFILES).toHaveLength(2);
      expect(DEFAULT_PAYMENT_PROFILES[0].display_name).toBe('Soumil Jana');
      expect(DEFAULT_PAYMENT_PROFILES[0].upi_id).toBe('9432938110@superyes');
      expect(DEFAULT_PAYMENT_PROFILES[0].qr_image_url).toBe('/qr/soumil-qr.png');
      expect(DEFAULT_PAYMENT_PROFILES[0].active).toBe(true);

      expect(DEFAULT_PAYMENT_PROFILES[1].display_name).toBe('Asmit Ghosh');
      expect(DEFAULT_PAYMENT_PROFILES[1].upi_id).toBe('8777389218@superyes');
      expect(DEFAULT_PAYMENT_PROFILES[1].qr_image_url).toBe('/qr/asmit-qr.jpg');
      expect(DEFAULT_PAYMENT_PROFILES[1].active).toBe(true);
    });
  });
});
