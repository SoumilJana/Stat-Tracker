import { Check, Clock, XCircle, User, ShieldCheck, UserPlus, Banknote } from 'lucide-react';
import { useState } from 'react';
import type { PlayerRosterItem } from '../../../types/gamePayment';
import type { PaymentStatusChoice } from '../../../lib/gamePaymentsApi';
import { PaymentStatusSheet } from './PaymentStatusSheet';

export interface PlayerRosterListProps {
  activeSquad: PlayerRosterItem[];
  waitingList: PlayerRosterItem[];
  outList: PlayerRosterItem[];
  isAdmin?: boolean;
  onQuickVerify?: (userId: string) => void;
  currentUserId?: string;
  onOpenAddPlayer?: () => void;
  /** Admin: change a player's payment status from their badge */
  onChangePaymentStatus?: (userId: string, choice: PaymentStatusChoice) => Promise<void>;
}

export function PlayerRosterList({
  activeSquad,
  waitingList,
  outList,
  isAdmin = false,
  onQuickVerify,
  currentUserId,
  onOpenAddPlayer,
  onChangePaymentStatus
}: PlayerRosterListProps) {
  const [editingPlayer, setEditingPlayer] = useState<PlayerRosterItem | null>(null);
  const canEditStatus = isAdmin && !!onChangePaymentStatus;

  const renderPaymentBadge = (item: PlayerRosterItem) => {
    const status = item.payment?.status;

    if (status === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Check className="w-3 h-3" />
          Paid
        </span>
      );
    }
    if (status === 'AWAITING_VERIFICATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" />
          Reviewing
        </span>
      );
    }
    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
    if (status === 'PENDING' && item.payment?.method === 'CASH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-300 border border-orange-500/20">
          <Banknote className="w-3 h-3" />
          Cash Due
        </span>
      );
    }
    if (status === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300 border border-white/10">
          Pay Later
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-neutral-400 bg-neutral-900 border border-white/5">
        Due
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active Squad Section */}
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Confirmed Squad
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {activeSquad.length} Players
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Players ordered strictly by response timestamp
            </p>
          </div>

          {isAdmin && onOpenAddPlayer && (
            <button
              type="button"
              onClick={onOpenAddPlayer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Enlist Player</span>
            </button>
          )}
        </div>

        {activeSquad.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 text-sm">
            No players have joined yet. Be the first to react IN!
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {activeSquad.map((player) => {
              const isCurrentUser = player.user_id === currentUserId;
              const isVerified = player.payment?.status === 'VERIFIED';

              return (
                <div
                  key={player.user_id}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-between transition-colors ${
                    isCurrentUser ? 'bg-primary-950/30 border border-primary-500/20' : 'hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono font-bold text-neutral-500 w-5 text-right shrink-0">
                      #{player.slot_number}
                    </span>

                    <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-neutral-300 shrink-0 overflow-hidden">
                      {player.photo_url ? (
                        <img src={player.photo_url} alt={player.username} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                        {player.username}
                        {isCurrentUser && (
                          <span className="text-[10px] text-primary-400 font-bold uppercase tracking-wider">
                            (You)
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        Joined {new Date(player.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canEditStatus ? (
                      <button
                        type="button"
                        onClick={() => setEditingPlayer(player)}
                        className="rounded-full transition-transform active:scale-95 hover:brightness-125"
                        aria-label={`Change payment status for ${player.username}`}
                        title="Change payment status"
                      >
                        {renderPaymentBadge(player)}
                      </button>
                    ) : (
                      renderPaymentBadge(player)
                    )}

                    {/* Admin 1-Tap Checkmark Button */}
                    {isAdmin && !isVerified && onQuickVerify && (
                      <button
                        type="button"
                        onClick={() => onQuickVerify(player.user_id)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all active:scale-95 flex items-center gap-1"
                        title={player.payment?.method === 'CASH' ? 'Cash received: mark as paid' : 'Mark as Paid (Cash / In-Person)'}
                        aria-label={`Mark ${player.username} as paid`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Waiting List Section (Slots 11–14 or 16+) */}
      {waitingList.length > 0 && (
        <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                Waiting List
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {waitingList.length} In Line
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Waiting for spots to open up, or for 15 players to trigger 3 Teams Winner Stays
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {waitingList.map((player) => (
              <div
                key={player.user_id}
                className="py-2 px-3 rounded-xl flex items-center justify-between hover:bg-neutral-800/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono font-bold text-amber-400/80 w-5 text-right shrink-0">
                    #{player.slot_number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-200 truncate">{player.username}</p>
                    <p className="text-[10px] text-neutral-400">Standby (Payment locked until promoted)</p>
                  </div>
                </div>

                <span className="text-xs font-medium text-neutral-400 px-2 py-0.5 rounded-md bg-neutral-800">
                  Waitlist
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropped OUT List Section */}
      {outList.length > 0 && (
        <div className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4 shadow-sm">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Not Attending ({outList.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {outList.map((player) => (
              <span
                key={player.user_id}
                className="text-xs text-neutral-400 bg-neutral-800/80 px-2.5 py-1 rounded-lg border border-white/5 line-through"
              >
                {player.username}
              </span>
            ))}
          </div>
        </div>
      )}
      {editingPlayer && onChangePaymentStatus && (
        <PaymentStatusSheet
          username={editingPlayer.username}
          payment={editingPlayer.payment}
          onSave={(choice) => onChangePaymentStatus(editingPlayer.user_id, choice)}
          onClose={() => setEditingPlayer(null)}
        />
      )}
    </div>
  );
}
