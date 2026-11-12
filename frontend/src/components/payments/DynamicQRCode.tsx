import { useState, useEffect } from 'react';
import { QrCode, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';
import {
  generateUpiUri,
  generateQrDataUrl,
  copyToClipboard,
  detectPlatform,
  dataUrlToFile,
  shareQrImage,
  downloadDataUrl,
  toAppSpecificUri,
  UPI_APP_LABELS,
  type DevicePlatform,
  type UpiApp
} from '../../lib/upiUtils';
import type { PaymentProfile } from '../../types/gamePayment';

export interface DynamicQRCodeProps {
  recipient: PaymentProfile;
  amount: number;
  note?: string;
  onPayNowClick?: () => void;
  className?: string;
}

export function DynamicQRCode({
  recipient,
  amount,
  note = 'StatTracker Match Fee',
  onPayNowClick,
  className = ''
}: DynamicQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'dynamic' | 'static'>('dynamic');
  const [platform] = useState<DevicePlatform>(() => detectPlatform());
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [payHint, setPayHint] = useState<'shared' | 'saved' | null>(null);

  const upiUri = generateUpiUri({
    upiId: recipient.upi_id,
    payeeName: recipient.display_name,
    amount,
    note
  });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    generateQrDataUrl(upiUri)
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate dynamic QR code:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [upiUri]);

  const handleCopyUpi = async () => {
    const success = await copyToClipboard(recipient.upi_id);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openUri = (uri: string) => {
    onPayNowClick?.();
    window.location.href = uri;
  };

  // Share the QR image to the UPI app (read as a scanned QR); fall back to saving it.
  const shareOrSaveQr = async () => {
    if (!qrDataUrl) {
      openUri(upiUri);
      return;
    }
    const fileName = `pay-${recipient.display_name.replace(/\s+/g, '-').toLowerCase()}-${amount}.png`;
    const file = dataUrlToFile(qrDataUrl, fileName);
    const result = await shareQrImage(file, `Scan to pay ₹${amount} to ${recipient.display_name}`);
    if (result === 'cancelled') return;
    if (result === 'unsupported') {
      downloadDataUrl(qrDataUrl, fileName);
      setPayHint('saved');
    } else {
      setPayHint('shared');
    }
    onPayNowClick?.();
  };

  const handlePayNow = () => {
    if (platform === 'ios') {
      setShowAppPicker((v) => !v);
      return;
    }
    void shareOrSaveQr();
  };

  return (
    <div className={`bg-neutral-900 border border-white/10 rounded-2xl p-5 sm:p-6 text-center max-w-sm mx-auto shadow-2xl relative ${className}`}>
      {/* Recipient Header */}
      <div className="mb-4">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-primary-400 bg-primary-950/80 border border-primary-500/20 px-2.5 py-1 rounded-full inline-flex items-center gap-1 mb-2">
          <Sparkles className="w-3 h-3" />
          UPI Recipient
        </span>
        <h3 className="text-lg font-bold text-white tracking-tight">{recipient.display_name}</h3>
        
        {/* UPI ID with 1-tap Copy */}
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs font-mono text-neutral-300 bg-neutral-800/80 px-2.5 py-1 rounded-lg border border-white/5 select-all">
            {recipient.upi_id}
          </span>
          <button
            type="button"
            onClick={handleCopyUpi}
            aria-label="Copy UPI ID"
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors border border-white/5 active:scale-95"
            title="Copy UPI ID"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Amount Display */}
      <div className="mb-4 py-2 px-3 bg-neutral-950/60 rounded-xl border border-white/5">
        <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Amount to Pay</p>
        <p className="text-2xl font-black text-primary-400">₹{amount.toFixed(0)}</p>
      </div>

      {/* View Mode Switcher (if static QR image is available) */}
      {recipient.qr_image_url && (
        <div className="flex justify-center mb-4">
          <div className="bg-neutral-950 p-1 rounded-xl border border-white/5 inline-flex">
            <button
              type="button"
              onClick={() => setViewMode('dynamic')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'dynamic'
                  ? 'bg-primary-500 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Amount QR
            </button>
            <button
              type="button"
              onClick={() => setViewMode('static')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'static'
                  ? 'bg-primary-500 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Original QR
            </button>
          </div>
        </div>
      )}

      {/* QR Code Container */}
      <div className="relative mx-auto w-56 h-56 bg-white rounded-2xl p-3 flex items-center justify-center shadow-lg ring-4 ring-primary-500/10">
        {viewMode === 'dynamic' ? (
          loading ? (
            <div className="flex flex-col items-center justify-center text-neutral-500 text-xs">
              <QrCode className="w-8 h-8 animate-pulse mb-2 text-neutral-400" />
              Generating QR...
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`UPI QR code for ${recipient.display_name} - ₹${amount}`}
              className="w-full h-full object-contain rounded-xl"
            />
          ) : (
            <p className="text-xs text-red-500 font-medium">Failed to render QR</p>
          )
        ) : (
          <img
            src={recipient.qr_image_url || ''}
            alt={`Official QR code for ${recipient.display_name}`}
            className="w-full h-full object-contain rounded-xl"
          />
        )}
      </div>

      <p className="text-[11px] text-neutral-400 mt-3 font-medium">
        Scan using GPay, PhonePe, Paytm, or BHIM
      </p>

      {/* Pay Now Button (Direct App Launch on Phone) */}
      <div className="mt-5">
        <button
          type="button"
          onClick={handlePayNow}
          className="w-full py-3 px-4 rounded-xl bg-primary-500 hover:bg-primary-400 text-neutral-950 font-bold text-sm tracking-wide shadow-lg shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Pay Now via UPI App (₹{amount})
        </button>
        {platform === 'ios' && showAppPicker ? (
          <div className="mt-3 space-y-2" role="group" aria-label="Choose your UPI app">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(UPI_APP_LABELS) as UpiApp[]).map((app) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => openUri(toAppSpecificUri(upiUri, app))}
                  className="py-2 px-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-white/10 active:scale-95 transition-all"
                >
                  {UPI_APP_LABELS[app]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void shareOrSaveQr()}
              className="w-full py-2 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-white/10 transition-colors"
            >
              App didn't work? Save QR image
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-neutral-400 mt-1.5">
            {platform === 'ios'
              ? 'Choose your UPI app'
              : 'Choose GPay, PhonePe or Paytm from the share menu'}
          </p>
        )}

        {payHint && (
          <p role="status" className="text-[11px] text-primary-300 mt-2 bg-primary-950/40 border border-primary-500/20 rounded-lg px-3 py-2">
            {payHint === 'saved'
              ? 'QR saved. Open your UPI app → Scan → pick the QR from your gallery. Come back here after paying.'
              : 'Finish the payment in your UPI app, then come back here to confirm.'}
          </p>
        )}

        {platform === 'android' && (
          <button
            type="button"
            onClick={() => openUri(upiUri)}
            className="mt-2 text-[11px] text-neutral-400 underline underline-offset-2 hover:text-white"
          >
            Or open UPI app directly
          </button>
        )}
      </div>
    </div>
  );
}
