/**
 * StatTracker - UPI Intent & Vector QR Code Utility
 * Module: frontend/src/lib/upiUtils.ts
 *
 * Implements NPCI-compliant UPI URI generation with pre-filled amounts,
 * deep-link app invocation, and zero-network client-side vector QR generation.
 */

import QRCode from 'qrcode';
import type { PaymentProfile } from '../types/gamePayment';

export interface UpiIntentParams {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  transactionRef?: string;
}

/**
 * Default seeded UPI recipient profiles
 */
export const DEFAULT_PAYMENT_PROFILES: PaymentProfile[] = [
  {
    id: 'seed-soumil-superyes',
    display_name: 'Soumil Jana',
    upi_id: '9432938110@superyes',
    qr_image_url: '/qr/soumil-qr.png',
    active: true,
    sort_order: 1
  },
  {
    id: 'seed-asmit-superyes',
    display_name: 'Asmit Ghosh',
    upi_id: '8777389218@superyes',
    qr_image_url: '/qr/asmit-qr.jpg',
    active: true,
    sort_order: 2
  }
];

/**
 * Generate a standard NPCI-compliant UPI payment URI
 * Example: upi://pay?pa=9432938110@superyes&pn=Soumil%20Jana&am=80.00&cu=INR&tn=StatTracker-Fee
 */
export function generateUpiUri(params: UpiIntentParams): string {
  const { upiId, payeeName, amount, note, transactionRef } = params;

  if (!upiId || !payeeName) {
    throw new Error('UPI ID and Payee Name are required to generate UPI URI');
  }

  const cleanUpi = upiId.trim();
  const cleanName = payeeName.trim();
  const formattedAmount = amount > 0 ? amount.toFixed(2) : '80.00';

  const searchParams = new URLSearchParams();
  searchParams.set('pa', cleanUpi);
  searchParams.set('pn', cleanName);
  searchParams.set('am', formattedAmount);
  searchParams.set('cu', 'INR');

  if (note) {
    searchParams.set('tn', note.trim());
  }
  if (transactionRef) {
    searchParams.set('tr', transactionRef.trim());
  }

  return `upi://pay?${searchParams.toString()}`;
}

/**
 * Generate a high-resolution Data URL (PNG) of the QR code entirely offline in-browser
 */
export async function generateQrDataUrl(
  text: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  const defaultOptions: QRCode.QRCodeToDataURLOptions = {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    ...options
  };

  return QRCode.toDataURL(text, defaultOptions);
}

/**
 * Generate a clean SVG string of the QR code
 */
export async function generateQrSvg(
  text: string,
  options?: QRCode.QRCodeToStringOptions
): Promise<string> {
  const defaultOptions: QRCode.QRCodeToStringOptions = {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    ...options
  };

  return QRCode.toString(text, defaultOptions);
}

/**
 * Copy text to clipboard safely
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy text:', err);
    return false;
  }
}
