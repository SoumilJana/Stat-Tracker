import { useState } from 'react';
import { Check, X, Undo, ShieldCheck, AlertCircle, ArrowRight, UserMinus } from 'lucide-react';
import type { Game, PlayerRosterItem, GamePayment } from '../../../types/gamePayment';

export interface AdminReconciliationModalProps {
  game: Game;
  activeSquad: PlayerRosterItem[];
  allPayments: GamePayment[];
  onVerifyPayment: (paymentId: string) => Promise<void>;
  onRejectPayment: (paymentId: string, reason: string) => Promise<void>;
  onRevertPayment: (paymentId: string) => Promise<void>;
  onQuickVerifyPlayer: (userId: string) => Promise<void>;
  onConfirmRoster: () => Promise<void>;
  onSettleRefund?: (paymentId: string) => Promise<void>;
  onClose: () => void;
  onNavigateToMatch?: (gameId: string) => void;
  /** Mark a player OUT (refund flagged if they paid; waiting list moves up) */
  onRemovePlayer?: (userId: string, username: string) => void;
  /** user_id -> username, used to name players owed a refund */
  playerNames?: Record<string, string>;
}

export function AdminReconciliationModal({
  game,
  activeSquad,
  allPayments,
  onVerifyPayment,
  onRejectPayment,
  onRevertPayment,
  onQuickVerifyPlayer,
  onConfirmRoster,
  onSettleRefund,
  onClose,
  onNavigateToMatch,
  onRemovePlayer,
  playerNames = {}
}: AdminReconciliationModalProps) {
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Payment not received in account');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmingRoster, setConfirmingRoster] = useState(false);

  // Squad is capped at capacity (10 or sticky 15); every squad slot must be verified.
  const targetCount = Math.max(10, activeSquad.length);
  const verifiedCount = activeSquad.filter((p) => p.payment?.status === 'VERIFIED').length;
  const allVerified = activeSquad.length >= targetCount && verifiedCount >= targetCount;
  const isRosterConfirmed = game.status === 'ROSTER_CONFIRMED';

  // Find any payments needing refund (paid dropouts or cancelled game)
  const pendingRefunds = allPayments.filter((p) => p.status === 'REFUND_PENDING');

  const handleVerify = async (paymentId: string) => {
    try {
      setActionLoading(true);
      await onVerifyPayment(paymentId);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingPaymentId) return;
    try {
      setActionLoading(true);
      await onRejectPayment(rejectingPaymentId, rejectionReason);
      setRejectingPaymentId(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRoster = async () => {
    try {
      setConfirmingRoster(true);
      await onConfirmRoster();
    } finally {
      setConfirmingRoster(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-5 sm:p-7 w-full max-w-2xl shadow-2xl relative my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-1">
              <ShieldCheck className="w-3 h-3" />
              Admin Center
            </span>
            <h3 className="text-xl font-black text-white tracking-tight">Payment Reconciliation & Roster</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body with scrolling */}
        <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-neutral-950/70 p-3 rounded-2xl border border-white/5">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Active Squad</p>
              <p className="text-xl font-black text-white">{activeSquad.length} / {targetCount}</p>
            </div>
            <div className="bg-neutral-950/70 p-3 rounded-2xl border border-white/5">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Verified Paid</p>
              <p className="text-xl font-black text-emerald-400">{verifiedCount} / {activeSquad.length}</p>
            </div>
            <div className="bg-neutral-950/70 p-3 rounded-2xl border border-white/5">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Collected</p>
              <p className="text-xl font-black text-primary-400">₹{(verifiedCount * game.amount_per_player).toFixed(0)}</p>
            </div>
          </div>

          {/* Pending Refunds Notice (if any player who paid dropped out) */}
          {pendingRefunds.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Refunds to Settle ({pendingRefunds.length})
              </h4>
              <p className="text-xs text-neutral-300 mb-3">
                These players paid but dropped out. Return their money via your UPI app and tap Mark Settled:
              </p>
              <div className="space-y-2">
                {pendingRefunds.map((refund) => (
                  <div key={refund.id} className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/5">
                    <div>
                      <p className="text-xs font-bold text-white">{playerNames[refund.user_id] || `Player ${refund.user_id.slice(0, 8)}…`}</p>
                      <p className="text-[10px] text-neutral-400">Amount: ₹{refund.amount} | Method: {refund.method}</p>
                    </div>
                    {onSettleRefund && (
                      <button
                        type="button"
                        onClick={() => onSettleRefund(refund.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition-all active:scale-95"
                      >
                        Mark Settled
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Player Reconciliation Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Squad Verification ({activeSquad.length} Players)
            </h4>

            {activeSquad.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4 text-center">No players registered yet.</p>
            ) : (
              <div className="divide-y divide-white/5 bg-neutral-950/80 rounded-2xl border border-white/5 overflow-hidden">
                {activeSquad.map((player) => {
                  const payment = player.payment;
                  const isVerified = payment?.status === 'VERIFIED';
                  const isAwaiting = payment?.status === 'AWAITING_VERIFICATION';

                  return (
                    <div key={player.user_id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-neutral-500">#{player.slot_number}</span>
                          <span className="text-sm font-bold text-white truncate">{player.username}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-400">
                          <span>
                            Method: {payment?.method || 'None'}
                            {payment?.method === 'CASH' && payment.status === 'PENDING' && (
                              <span className="text-orange-300"> · due on game day</span>
                            )}
                          </span>
                          {payment?.utr && (
                            <span className="font-mono text-neutral-300 bg-neutral-900 px-1.5 py-0.5 rounded border border-white/5">
                              UTR: {payment.utr}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onRemovePlayer && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => onRemovePlayer(player.user_id, player.username)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Remove player"
                            aria-label={`Remove ${player.username}`}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isVerified ? (
                          <div className="flex items-center gap-1">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Verified
                            </span>
                            {payment && (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => onRevertPayment(payment.id)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                                title="Revert to Pending"
                                aria-label={`Revert payment for ${player.username}`}
                              >
                                <Undo className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : isAwaiting && payment ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleVerify(payment.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 text-neutral-950 font-bold text-xs hover:bg-emerald-400 transition-all active:scale-95 flex items-center gap-1"
                              aria-label={`Verify ${player.username}`}
                            >
                              <Check className="w-3 h-3" /> Verify
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => setRejectingPaymentId(payment.id)}
                              className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-500/30 transition-all active:scale-95"
                              aria-label={`Reject ${player.username}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          // Unreported, Cash Due or Pay Later: confirm once the cash is in hand
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => onQuickVerifyPlayer(player.user_id)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                            aria-label={`Mark ${player.username} cash verified`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Confirm Cash
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer / Match Roster Lock Action */}
        <div className="pt-4 border-t border-white/10 shrink-0">
          {isRosterConfirmed ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-blue-950/40 border border-blue-500/30 p-3.5 rounded-2xl">
              <div>
                <p className="text-xs font-bold text-blue-400">Roster Locked & Confirmed!</p>
                <p className="text-[11px] text-neutral-300">Only verified players are available in Matches for tomorrow.</p>
              </div>
              {onNavigateToMatch && (
                <button
                  type="button"
                  onClick={() => onNavigateToMatch(game.id)}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0"
                >
                  <span>Start Match Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {!allVerified && (
                <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  All {targetCount} players must be verified before confirming the roster
                </p>
              )}
              <button
                type="button"
                disabled={!allVerified || confirmingRoster}
                onClick={handleConfirmRoster}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  allVerified
                    ? 'bg-primary-500 hover:bg-primary-400 text-neutral-950 shadow-lg shadow-primary-500/20 active:scale-95'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5'
                }`}
              >
                <span>{confirmingRoster ? 'Confirming...' : `Confirm & Lock Match Roster (${verifiedCount}/${targetCount} Verified)`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Rejection Prompt Modal */}
        {rejectingPaymentId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 max-w-sm w-full">
              <h4 className="text-sm font-bold text-white mb-2">Reject Payment Claim</h4>
              <p className="text-xs text-neutral-400 mb-3">
                Specify the reason why this claim is being rejected:
              </p>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-xl text-white text-xs mb-4 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingPaymentId(null)}
                  className="flex-1 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectConfirm}
                  className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
