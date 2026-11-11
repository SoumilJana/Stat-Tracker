import { Calendar, Clock, MapPin, IndianRupee, Trophy } from 'lucide-react';
import type { Game } from '../../../types/gamePayment';

export interface GameHeaderProps {
  game: Game;
  activeCount: number;
  onShareWhatsApp?: () => void;
  isAdmin?: boolean;
  onEditGame?: () => void;
}

export function GameHeader({ game, activeCount: _activeCount, onShareWhatsApp, isAdmin, onEditGame }: GameHeaderProps) {
  const getStatusBadge = () => {
    switch (game.status) {
      case 'PAYMENT_OPEN':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Payments Open
          </span>
        );
      case 'REGISTRATION_OPEN':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-500/10 text-primary-400 border border-primary-500/20">
            Registration Open
          </span>
        );
      case 'ROSTER_CONFIRMED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Roster Confirmed
          </span>
        );
      case 'REGISTRATION_CLOSED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Registration Closed
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-800 text-neutral-400 border border-white/10">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-800 text-neutral-300 border border-white/10">
            {game.status}
          </span>
        );
    }
  };

  const formattedDate = new Date(game.game_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="bg-neutral-900/90 border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-2xl relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-primary-500/10 rounded-full blur-3xl opacity-70"
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {getStatusBadge()}
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/5 text-neutral-300 border border-white/10 flex items-center gap-1.5">
              <Trophy className="w-3 h-3 text-primary-400" />
              {game.mode === 'WINNER_STAYS' ? '3 Teams Winner Stays' : 'Standard 5v5'}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Match Day
            <span className="text-primary-400 text-lg sm:text-xl font-normal">
              ({game.duration_minutes} Mins)
            </span>
          </h2>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-xs sm:text-sm text-neutral-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-primary-400" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-primary-400" />
              {game.start_time}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-primary-400" />
              {game.location}
            </span>
            <span className="flex items-center gap-1.5 font-bold text-primary-400">
              <IndianRupee className="w-4 h-4" />
              ₹{game.amount_per_player.toFixed(0)} / player
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
          {onShareWhatsApp && (
            <button
              type="button"
              onClick={onShareWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm"
            >
              <span>WhatsApp Summary</span>
            </button>
          )}

          {isAdmin && onEditGame && (
            <button
              type="button"
              onClick={onEditGame}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white border border-white/10 text-xs sm:text-sm font-semibold transition-all active:scale-95"
            >
              Manage Game
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
