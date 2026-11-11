import React, { useState, useEffect } from 'react';
import { X, UserPlus, Search, CheckCircle, Loader2, CheckSquare, Square } from 'lucide-react';
import { fetchAvailableProfilesForGame, adminRegisterPlayers } from '../../../lib/gamePaymentsApi';
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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
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
          setSelectedUserIds([]);
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

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredProfiles.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredProfiles.map((p) => p.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one player to enlist.');
      return;
    }

    try {
      setSubmitting(true);
      await adminRegisterPlayers(gameId, selectedUserIds, markAsPaid, paymentMethod);
      const count = selectedUserIds.length;
      toast.success(`${count} player${count > 1 ? 's' : ''} successfully added to match roster!`);
      onPlayerAdded();
      onClose();
    } catch (err: any) {
      console.error('Error enlisting players:', err);
      toast.error(err.message || 'Failed to enlist players.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalFeePreview = amountPerPlayer * selectedUserIds.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Enlist Players to Match</h2>
                {selectedUserIds.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                    {selectedUserIds.length} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">Select one or multiple players to add to the roster</p>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Search Box & Select All Toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Search Player
              </label>
              {filteredProfiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {selectedUserIds.length === filteredProfiles.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
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

          {/* Select Player List (Multi-Select) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <span>Available Players ({filteredProfiles.length})</span>
              {selectedUserIds.length > 0 && (
                <span className="text-emerald-400 normal-case font-bold">
                  {selectedUserIds.length} player{selectedUserIds.length > 1 ? 's' : ''} chosen
                </span>
              )}
            </div>
            {loadingProfiles ? (
              <div className="flex items-center justify-center py-8 text-zinc-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span className="text-sm">Loading players...</span>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-sm text-zinc-400">
                No matching players available to enlist.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-zinc-800/80 rounded-xl p-2 bg-zinc-950/60">
                {filteredProfiles.map((p) => {
                  const isSelected = selectedUserIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleUserSelection(p.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0 text-zinc-500">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-600" />
                          )}
                        </div>
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
                  {selectedUserIds.length > 0 ? (
                    <>
                      Verify <span className="text-emerald-400 font-bold">₹{totalFeePreview}</span> (₹{amountPerPlayer} × {selectedUserIds.length}) immediately
                    </>
                  ) : (
                    `Instantly verify ₹${amountPerPlayer}/player without awaiting review`
                  )}
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
              disabled={submitting || selectedUserIds.length === 0}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enlisting {selectedUserIds.length} Player{selectedUserIds.length > 1 ? 's' : ''}...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {selectedUserIds.length === 0
                      ? 'Select Players'
                      : `Enlist ${selectedUserIds.length} Player${selectedUserIds.length > 1 ? 's' : ''}`}
                  </span>
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
