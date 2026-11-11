import React, { useState, useEffect } from 'react';
import { X, UserPlus, Search, CheckCircle, Loader2 } from 'lucide-react';
import { fetchAvailableProfilesForGame, adminRegisterPlayer } from '../../../lib/gamePaymentsApi';
import type { PaymentMethod } from '../../../types/gamePayment';
import { useToast } from '../../../contexts/ToastContext';

interface AdminAddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  alreadyInUserIds: string[];
  amountPerPlayer: number;
  onPlayerAdded: () => void;
}

export const AdminAddPlayerModal: React.FC<AdminAddPlayerModalProps> = ({
  isOpen,
  onClose,
  gameId,
  alreadyInUserIds,
  amountPerPlayer,
  onPlayerAdded
}) => {
  const toast = useToast();
  const [profiles, setProfiles] = useState<Array<{ id: string; username: string; photo_url?: string; jersey_number?: number }>>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingProfiles(true);
    fetchAvailableProfilesForGame(alreadyInUserIds)
      .then((data) => {
        if (isMounted) {
          setProfiles(data);
          if (data.length > 0) {
            setSelectedUserId(data[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load available profiles:', err);
        toast.error('Failed to load community players list');
      })
      .finally(() => {
        if (isMounted) setLoadingProfiles(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, alreadyInUserIds]);

  if (!isOpen) return null;

  const filteredProfiles = profiles.filter((p) =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Please select a player to enlist.');
      return;
    }

    try {
      setSubmitting(true);
      await adminRegisterPlayer(gameId, selectedUserId, markAsPaid, paymentMethod);
      toast.success('Player successfully added to match roster!');
      onPlayerAdded();
      onClose();
    } catch (err: any) {
      console.error('Error enlisting player:', err);
      toast.error(err.message || 'Failed to enlist player.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Enlist Player to Match</h2>
              <p className="text-xs text-zinc-400">Manually add offline or WhatsApp enlisted players</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Search Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Search Player
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Select Player List */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Select Player ({filteredProfiles.length} Available)
            </label>
            {loadingProfiles ? (
              <div className="flex items-center justify-center py-6 text-zinc-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading players...</span>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-sm text-zinc-400">
                No matching players found.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-zinc-800/80 rounded-xl p-2 bg-zinc-950/60">
                {filteredProfiles.map((p) => {
                  const isSelected = selectedUserId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedUserId(p.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {p.photo_url ? (
                          <img
                            src={p.photo_url}
                            alt={p.username}
                            className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                            {p.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium truncate">{p.username}</span>
                        {p.jersey_number !== undefined && (
                          <span className="text-xs text-zinc-500">#{p.jersey_number}</span>
                        )}
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mark as Paid Toggle */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-white">Mark as Already Paid</span>
                <p className="text-xs text-zinc-400">
                  Instantly verify ₹{amountPerPlayer} payment without awaiting review
                </p>
              </div>
              <input
                type="checkbox"
                checked={markAsPaid}
                onChange={(e) => setMarkAsPaid(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
              />
            </label>

            {markAsPaid && (
              <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium">Payment Method:</span>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                    paymentMethod === 'UPI'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Direct UPI
                </button>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedUserId || filteredProfiles.length === 0}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enlisting...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Add to Roster</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AdminAddPlayerModal;
