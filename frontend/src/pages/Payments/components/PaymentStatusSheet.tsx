import { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { GamePayment } from '../../../types/gamePayment';
import type { PaymentStatusChoice } from '../../../lib/gamePaymentsApi';

const OPTIONS: Array<{ value: PaymentStatusChoice; label: string; hint: string }> = [
  { value: 'PAID_UPI', label: 'Paid (UPI)', hint: 'Money received online' },
  { value: 'PAID_CASH', label: 'Paid (Cash received)', hint: 'Cash handed over' },
  { value: 'CASH_DUE', label: 'Cash Due', hint: 'Will pay cash at the turf' },
  { value: 'PAY_LATER', label: 'Pay Later', hint: 'Will pay online later' },
  { value: 'NOT_PAID', label: 'Not paid', hint: 'Clear the payment (shows as Due)' }
];

/** Which option matches the player's current payment */
export function currentChoice(payment?: GamePayment | null): PaymentStatusChoice | null {
  if (!payment) return 'NOT_PAID';
  if (payment.status === 'VERIFIED') return payment.method === 'UPI' ? 'PAID_UPI' : 'PAID_CASH';
  if (payment.status === 'PENDING') return payment.method === 'CASH' ? 'CASH_DUE' : 'PAY_LATER';
  if (payment.status === 'UNREPORTED') return 'NOT_PAID';
  return null; // Reviewing / Rejected: no matching option, admin picks one
}

export interface PaymentStatusSheetProps {
  username: string;
  payment?: GamePayment | null;
  onSave: (choice: PaymentStatusChoice) => Promise<void>;
  onClose: () => void;
}

export function PaymentStatusSheet({ username, payment, onSave, onClose }: PaymentStatusSheetProps) {
  const current = currentChoice(payment);
  const [selected, setSelected] = useState<PaymentStatusChoice | null>(current);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selected || selected === current) return;
    try {
      setSaving(true);
      await onSave(selected);
      onClose();
    } catch {
      /* error already shown by the caller; keep the sheet open to retry */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Change payment status for ${username}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-3xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Payment status</p>
            <h3 className="text-lg font-black text-white">{username}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2" role="radiogroup">
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(opt.value)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'bg-primary-950/40 border-primary-500/50'
                    : 'bg-neutral-950/60 border-white/5 hover:border-white/20'
                }`}
              >
                <span>
                  <span className="block text-sm font-bold text-white">
                    {opt.label}
                    {current === opt.value && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Current</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-neutral-400">{opt.hint}</span>
                </span>
                {isSelected && <Check className="w-4 h-4 text-primary-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!selected || selected === current || saving}
          onClick={handleSave}
          className="mt-4 w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-400 text-neutral-950 font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {saving ? 'Saving...' : 'Update status'}
        </button>
      </div>
    </div>
  );
}
