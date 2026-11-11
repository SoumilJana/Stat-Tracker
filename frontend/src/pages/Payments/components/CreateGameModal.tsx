import { useState } from 'react';
import { Calendar, Clock, MapPin, IndianRupee, X, PlusCircle, AlertCircle } from 'lucide-react';
import type { Game } from '../../../types/gamePayment';

export interface CreateGameModalProps {
  existingGame?: Game | null;
  onSave: (gameData: Partial<Game>) => Promise<void>;
  onClose: () => void;
}

export function CreateGameModal({ existingGame, onSave, onClose }: CreateGameModalProps) {
  const [gameDate, setGameDate] = useState(
    existingGame?.game_date || new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState(existingGame?.start_time || '19:00');
  const [location, setLocation] = useState(existingGame?.location || 'Plaza Turf');
  const [amountPerPlayer, setAmountPerPlayer] = useState(
    existingGame?.amount_per_player?.toString() || '80'
  );
  const [totalTurfCost, setTotalTurfCost] = useState(
    existingGame?.total_turf_cost?.toString() || '800'
  );
  const [durationMinutes, setDurationMinutes] = useState(
    existingGame?.duration_minutes?.toString() || '60'
  );
  const [saving, setSaving] = useState(false);

  const isPaymentLocked = existingGame && existingGame.payment_opened_at !== null && existingGame.payment_opened_at !== undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await onSave({
        id: existingGame?.id,
        game_date: gameDate,
        start_time: startTime,
        location,
        amount_per_player: parseFloat(amountPerPlayer) || 80,
        total_turf_cost: parseFloat(totalTurfCost) || 800,
        duration_minutes: parseInt(durationMinutes, 10) || 60,
        mode: existingGame?.mode || 'STANDARD'
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-5 sm:p-7 w-full max-w-md shadow-2xl relative my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary-400" />
            {existingGame ? 'Edit Game Details' : 'Schedule New Match'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary-400" />
              Game Date
            </label>
            <input
              type="date"
              required
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 [color-scheme:dark]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary-400" />
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Duration (Mins)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                <option value="60">60 mins (1 hr)</option>
                <option value="90">90 mins (1.5 hrs)</option>
                <option value="120">120 mins (2 hrs)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary-400" />
              Location / Turf Name
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Plaza Turf / Astro Arena"
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-primary-400" />
                Fee / Player (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                disabled={Boolean(isPaymentLocked)}
                value={amountPerPlayer}
                onChange={(e) => setAmountPerPlayer(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-neutral-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 ${
                  Boolean(isPaymentLocked) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-neutral-400" />
                Total Turf Cost (₹)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={totalTurfCost}
                onChange={(e) => setTotalTurfCost(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
            </div>
          </div>

          {isPaymentLocked && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Fee per player is locked because payments have already opened.
            </p>
          )}

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-neutral-950 font-bold text-xs shadow-lg shadow-primary-500/20 active:scale-95 transition-all"
            >
              {saving ? 'Saving...' : existingGame ? 'Update Game' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
