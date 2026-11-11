import { useState, useEffect } from 'react';
import { CreditCard, Banknote, Clock, CheckCircle2, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { DynamicQRCode } from '../../../components/payments/DynamicQRCode';
import type { Game, GamePayment, PaymentProfile, PaymentMethod } from '../../../types/gamePayment';

export interface PaymentSectionProps {
  game: Game;
  userPayment?: GamePayment | null;
  paymentProfiles: PaymentProfile[];
  isUserInSquad: boolean;
  isUserWaitlisted: boolean;
  isPaymentUnlocked: boolean;
  onSubmitPayment: (method: PaymentMethod, recipientId?: string, utr?: string) => Promise<void>;
  loading?: boolean;
}

export function PaymentSection({
  game,
  userPayment,
  paymentProfiles,
  isUserInSquad,
  isUserWaitlisted,
  isPaymentUnlocked,
  onSubmitPayment,
  loading: _loading = false
}: PaymentSectionProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('UPI');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    paymentProfiles[0]?.id || ''
  );
  const [utrInput, setUtrInput] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedRecipientId && paymentProfiles.length > 0) {
      setSelectedRecipientId(paymentProfiles[0].id);
    }
  }, [paymentProfiles, selectedRecipientId]);

  const selectedProfile = paymentProfiles.find((p) => p.id === selectedRecipientId) || paymentProfiles[0];
  const amount = game.amount_per_player || 80.0;

  // Case 1: User is waitlisted
  if (isUserWaitlisted) {
    return (
      <div className="bg-neutral-900 border border-amber-500/20 rounded-2xl p-5 text-center shadow-lg">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white tracking-tight">You are on the Waiting List</h3>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
          Payment is locked. If an active player drops out or if 15 players join, you will be promoted to the active squad and payment will unlock!
        </p>
      </div>
    );
  }

  // Case 2: Not in squad
  if (!isUserInSquad) {
    return (
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 text-center shadow-lg">
        <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center text-neutral-400 mx-auto mb-3">
          <CreditCard className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white tracking-tight">Payment Section</h3>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
          React <span className="text-emerald-400 font-bold">"I'm IN"</span> above to join the match roster and unlock payment instructions.
        </p>
      </div>
    );
  }

  // Case 3: Threshold not yet reached (Under 10 players)
  if (!isPaymentUnlocked) {
    return (
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 text-center shadow-lg">
        <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 mx-auto mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white tracking-tight">Waiting for 10 Players</h3>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
          Payments automatically unlock as soon as 10 players register IN to ensure the turf is confirmed!
        </p>
      </div>
    );
  }

  // Case 4: Payment already VERIFIED
  if (userPayment?.status === 'VERIFIED') {
    return (
      <div className="bg-gradient-to-br from-emerald-950/60 to-neutral-900 border border-emerald-500/30 rounded-2xl p-6 text-center shadow-2xl relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl opacity-60"
        />
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-3 shadow-inner">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full inline-block mb-2">
          Verified Match Entry
        </span>
        <h3 className="text-xl font-black text-white tracking-tight">You're All Set!</h3>
        <p className="text-sm text-neutral-300 mt-1 max-w-sm mx-auto">
          Your payment of <span className="text-emerald-400 font-bold">₹{userPayment.amount.toFixed(0)}</span> has been confirmed by the match organizer.
        </p>
        <p className="text-xs text-neutral-400 mt-3">
          See you on the pitch!
        </p>
      </div>
    );
  }

  // Case 5: Payment AWAITING_VERIFICATION
  if (userPayment?.status === 'AWAITING_VERIFICATION') {
    return (
      <div className="bg-neutral-900 border border-amber-500/30 rounded-2xl p-6 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-2">
          Awaiting Verification
        </span>
        <h3 className="text-xl font-bold text-white tracking-tight">Payment Claim Submitted</h3>
        <p className="text-sm text-neutral-300 mt-1 max-w-sm mx-auto">
          The match admin is verifying your payment with their account. Your name will be marked with a green tick as soon as confirmed!
        </p>
        {userPayment.utr && (
          <p className="text-xs font-mono text-neutral-400 mt-3 bg-neutral-950/80 py-1 px-3 rounded-lg inline-block border border-white/5">
            Ref/UTR: {userPayment.utr}
          </p>
        )}
      </div>
    );
  }

  // Handle reporting payment
  const handleReportPayment = async () => {
    try {
      setSubmitting(true);
      await onSubmitPayment(selectedMethod, selectedRecipientId, utrInput);
      setShowReportModal(false);
      setUtrInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-400 bg-primary-950/80 border border-primary-500/30 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3" />
            Match Fee Payment
          </span>
          <h3 className="text-xl font-black text-white tracking-tight">Complete Your Match Payment</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-neutral-400">Total Dues</p>
          <p className="text-2xl font-black text-primary-400">₹{amount.toFixed(0)}</p>
        </div>
      </div>

      {/* Show rejection alert if previous payment was rejected */}
      {userPayment?.status === 'REJECTED' && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-400">Previous Payment Claim Rejected</p>
            <p className="mt-0.5 text-neutral-300">
              Reason: {userPayment.rejection_reason || 'Payment not found in bank account'}. Please re-submit or check the UPI ID.
            </p>
          </div>
        </div>
      )}

      {/* Payment Method Selector Tabs */}
      <div className="grid grid-cols-3 gap-2 mb-6 bg-neutral-950 p-1.5 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setSelectedMethod('UPI')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            selectedMethod === 'UPI'
              ? 'bg-primary-500 text-neutral-950 shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>UPI / QR</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMethod('CASH')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            selectedMethod === 'CASH'
              ? 'bg-primary-500 text-neutral-950 shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Banknote className="w-3.5 h-3.5" />
          <span>Cash</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMethod('LATER')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            selectedMethod === 'LATER'
              ? 'bg-primary-500 text-neutral-950 shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pay Later</span>
        </button>
      </div>

      {/* Method A: UPI Content */}
      {selectedMethod === 'UPI' && (
        <div className="space-y-5">
          {/* Recipient Account Selector (if multiple exist) */}
          {paymentProfiles.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Select Recipient Account:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {paymentProfiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedRecipientId(p.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedRecipientId === p.id
                        ? 'bg-primary-950/40 border-primary-500/50 text-white shadow-sm'
                        : 'bg-neutral-950/60 border-white/5 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    <p className="text-xs font-bold text-white">{p.display_name}</p>
                    <p className="text-[11px] font-mono text-neutral-400 truncate">{p.upi_id}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Vector QR Component with pre-filled amount */}
          {selectedProfile && (
            <DynamicQRCode
              recipient={selectedProfile}
              amount={amount}
              note={`StatTracker Match ${game.game_date}`}
              onPayNowClick={() => setShowReportModal(true)}
            />
          )}

          {/* After-Payment Confirmation Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 text-white font-bold text-sm border border-white/10 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>I Have Made This Payment (Report UTR)</span>
              <ArrowRight className="w-4 h-4 text-primary-400" />
            </button>
          </div>
        </div>
      )}

      {/* Method B: Cash Content */}
      {selectedMethod === 'CASH' && (
        <div className="bg-neutral-950/60 rounded-2xl p-6 text-center border border-white/5 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 mx-auto">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Cash Payment at Turf</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              Please hand over ₹{amount.toFixed(0)} cash directly to the match organizer before kickoff. The admin will verify your cash receipt.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmitPayment('CASH')}
            className="w-full py-3 px-4 rounded-xl bg-primary-500 hover:bg-primary-400 text-neutral-950 font-bold text-sm shadow-lg shadow-primary-500/20 active:scale-95 transition-all"
          >
            {submitting ? 'Submitting...' : `Submit Cash Request (₹${amount.toFixed(0)})`}
          </button>
        </div>
      )}

      {/* Method C: Pay Later Content */}
      {selectedMethod === 'LATER' && (
        <div className="bg-neutral-950/60 rounded-2xl p-6 text-center border border-white/5 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center text-neutral-300 mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Pay Later</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              Record your intent to pay later. Note: Match dues of ₹{amount.toFixed(0)} must be cleared before match day.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmitPayment('LATER')}
            className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm border border-white/10 active:scale-95 transition-all"
          >
            {submitting ? 'Submitting...' : 'Record as Pay Later'}
          </button>
        </div>
      )}

      {/* Report Payment Modal (with optional UTR) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="text-lg font-bold text-white tracking-tight">Confirm Payment Submission</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Confirm that you have transferred ₹{amount.toFixed(0)} to {selectedProfile?.display_name}.
            </p>

            <div className="mt-4">
              <label htmlFor="utr-input" className="block text-xs font-semibold text-neutral-300 mb-1">
                UPI Reference / UTR Number (Optional):
              </label>
              <input
                id="utr-input"
                type="text"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                placeholder="e.g. 432187654321 (12 digits)"
                maxLength={20}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-white/10 rounded-xl text-white font-mono text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
              <p className="text-[10px] text-neutral-500 mt-1">
                Found in your Google Pay, PhonePe, or Paytm transaction details.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleReportPayment}
                className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-neutral-950 font-bold text-xs shadow-lg shadow-primary-500/20 transition-all active:scale-95"
              >
                {submitting ? 'Submitting...' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
