import { describe, it, expect, vi } from 'vitest';
import {
  generateUpiUri,
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

      expect(uri).toContain('upi://pay?');
      expect(uri).toContain('pa=9432938110%40superyes');
      expect(uri).toContain('pn=Soumil+Jana');
      expect(uri).toContain('am=80.00');
      expect(uri).toContain('cu=INR');
      expect(uri).toContain('tn=StatTracker+Match+Fee');
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
    it('contains Soumil Jana super.money profile as default seed', () => {
      expect(DEFAULT_PAYMENT_PROFILES).toHaveLength(1);
      expect(DEFAULT_PAYMENT_PROFILES[0].display_name).toBe('Soumil Jana');
      expect(DEFAULT_PAYMENT_PROFILES[0].upi_id).toBe('9432938110@superyes');
      expect(DEFAULT_PAYMENT_PROFILES[0].qr_image_url).toBe('/qr/soumil-qr.png');
      expect(DEFAULT_PAYMENT_PROFILES[0].active).toBe(true);
    });
  });
});
