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

  const formattedAmount = amount > 0 ? amount.toFixed(2) : '80.00';

  // Built by hand instead of URLSearchParams: that encodes spaces as "+" and "@" as "%40",
  // which many UPI apps do not decode (GPay showed the note as "StatTracker+Match+...").
  const pairs: Array<[string, string]> = [
    ['pa', upiId.trim()],
    ['pn', payeeName.trim()],
    ['am', formattedAmount],
    ['cu', 'INR']
  ];
  if (note) pairs.push(['tn', note.trim()]);
  if (transactionRef) pairs.push(['tr', transactionRef.trim()]);

  return `upi://pay?${pairs.map(([k, v]) => `${k}=${encodeUpiValue(v)}`).join('&')}`;
}

/** Percent-encode a UPI query value, keeping "@" readable (spaces become %20, never "+"). */
export function encodeUpiValue(value: string): string {
  return encodeURIComponent(value).replace(/%40/g, '@');
}

export type UpiApp = 'gpay' | 'phonepe' | 'paytm';

export const UPI_APP_LABELS: Record<UpiApp, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm'
};

const UPI_APP_PREFIXES: Record<UpiApp, string> = {
  gpay: 'gpay://upi/pay?',
  phonepe: 'phonepe://pay?',
  paytm: 'paytmmp://pay?'
};

/**
 * Re-target a generic upi:// URI at a specific app. Used on iOS, where upi:// opens whichever
 * app last claimed the scheme (often WhatsApp) instead of showing a chooser.
 */
export function toAppSpecificUri(upiUri: string, app: UpiApp): string {
  const query = upiUri.slice(upiUri.indexOf('?') + 1);
  return `${UPI_APP_PREFIXES[app]}${query}`;
}

export type DevicePlatform = 'android' | 'ios' | 'other';

export function detectPlatform(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0
): DevicePlatform {
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS reports a desktop Mac user agent; touch support gives it away
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  return 'other';
}

/** Convert a data: URL to a File synchronously (keeps navigator.share inside the tap gesture). */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

/**
 * Open the OS share sheet with the QR image so the player can send it straight to their UPI app,
 * which reads it as a scanned QR (not blocked like web-launched upi:// links to personal UPI IDs).
 * Must be called synchronously from a click handler.
 */
export async function shareQrImage(file: File, text: string): Promise<ShareResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav?.share || !nav.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await nav.share({ files: [file], text });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    console.error('QR share failed:', err);
    return 'unsupported';
  }
}

/** Save a data: URL as a file download (fallback when sharing files is not supported). */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
