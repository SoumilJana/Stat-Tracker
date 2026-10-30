import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Activity, Edit2, Trash2 } from 'lucide-react';
import type { Profile } from '../types';
import PlayerRatingBadge from '../../../components/PlayerRatingBadge';
import { formatRating } from '../../../lib/playerRating';

interface PlayerDetailModalProps {
  player: Profile | null;
  currentUserId: string | undefined;
  isAdmin: boolean | undefined;
  shouldReduceMotion: boolean | null;
  onClose: () => void;
  onEdit: (player: Profile) => void;
  onDelete: (player: Profile) => void;
}

export function PlayerDetailModal({
  player,
  currentUserId,
  isAdmin,
  shouldReduceMotion,
  onClose,
  onEdit,
  onDelete
}: PlayerDetailModalProps) {
  // Dual scroll lock & restoration for mobile modal
  useEffect(() => {
    if (!player) return;

    const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement | null;
    const originalContainerOverflow = scrollContainer ? scrollContainer.style.overflow : '';
    const originalBodyOverflow = document.body.style.overflow;
    const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
    }
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (scrollContainer) {
        scrollContainer.style.overflow = originalContainerOverflow;
        scrollContainer.scrollTop = savedScrollTop;
      }
      document.body.style.overflow = originalBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [player, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {player && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 26, stiffness: 320 }}
            className={`bg-neutral-950 sm:border sm:rounded-3xl overflow-hidden w-full h-[100dvh] sm:h-auto sm:max-h-[88dvh] sm:max-w-xl shadow-2xl relative flex flex-col z-10 ${
              player.role === 'manager'
                ? 'sm:border-cyan-400/80 sm:shadow-[0_0_40px_rgba(34,211,238,0.7)]'
                : player.onFire
                ? 'sm:border-orange-500/80 sm:shadow-[0_0_25px_rgba(249,115,22,0.5)]'
                : 'sm:border-neutral-800'
            }`}
          >
            {/* Subtle Background Ambient Photo */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {player.photo_url ? (
                <img
                  src={player.photo_url}
                  alt={player.username}
                  className="w-full h-full object-cover object-[center_20%] opacity-25 blur-[3px] scale-105"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl font-black text-neutral-800 bg-neutral-900">
                  {player.username.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/80 via-neutral-950/92 to-neutral-950" />
            </div>

            {/* Pinned Top Bar: Safe Area, Badges, Close Button */}
            <div className="relative z-30 flex items-center justify-between px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 shrink-0 bg-neutral-950/60 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {player.leaderboardRank && player.leaderboardRank <= 3 && (
                  <span
                    className={`whitespace-nowrap px-2.5 py-1 rounded-lg border backdrop-blur-md text-[10px] font-black uppercase tracking-wider ${
                      player.leaderboardRank === 1
                        ? 'border-amber-400/50 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.25)]'
                        : player.leaderboardRank === 2
                        ? 'border-neutral-300/40 bg-neutral-300/20 text-neutral-200'
                        : 'border-amber-700/50 bg-amber-700/20 text-amber-500'
                    }`}
                  >
                    {player.leaderboardRank === 1 ? '🥇 #1' : player.leaderboardRank === 2 ? '🥈 #2' : '🥉 #3'}
                  </span>
                )}
                <span
                  className={`whitespace-nowrap px-2.5 py-1 rounded-lg border backdrop-blur-md text-[10px] font-black uppercase tracking-wider ${
                    player.role === 'manager'
                      ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-300'
                      : player.position === 'FWD'
                      ? 'border-blue-500/40 bg-blue-500/20 text-blue-300'
                      : player.position === 'MID'
                      ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                      : player.position === 'DEF'
                      ? 'border-yellow-500/40 bg-yellow-500/20 text-yellow-300'
                      : player.position === 'GK'
                      ? 'border-purple-500/40 bg-purple-500/20 text-purple-300'
                      : 'border-white/10 bg-white/5 text-neutral-300'
                  }`}
                >
                  {player.role === 'manager' ? 'MANAGER' : player.position || 'FWD'}
                </span>
                {player.onFire && (
                  <span
                    className="px-2 py-0.5 rounded-lg border border-orange-500/40 bg-orange-500/20 text-orange-400 text-[10px] font-black animate-pulse"
                    title="On Fire"
                  >
                    🔥 ON FIRE
                  </span>
                )}
                {player.isTopAssister && (
                  <span className="whitespace-nowrap flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-400/30 bg-blue-500/10 backdrop-blur-sm text-[10px] font-bold text-blue-300 uppercase tracking-widest">
                    🎯 TOP ASSIST
                  </span>
                )}
              </div>

              <button
                onClick={onClose}
                aria-label="Close player profile"
                className="w-11 h-11 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-white/15 flex items-center justify-center text-white backdrop-blur-xl transition-all active:scale-95 shadow-lg shrink-0 ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pinned Player Identity */}
            <div className="relative z-20 px-4 sm:px-6 pb-3.5 shrink-0 border-b border-white/[0.08] bg-neutral-950/70 backdrop-blur-md">
              <div className="flex items-center gap-3.5 sm:gap-4">
                {/* Avatar Thumbnail */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border border-white/15 bg-neutral-900 shrink-0 shadow-lg">
                  {player.photo_url ? (
                    <img
                      src={player.photo_url}
                      alt={player.username}
                      className="w-full h-full object-cover object-[center_20%]"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-black text-neutral-600">
                      {player.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-2xl sm:text-3xl font-black text-white truncate tracking-tight drop-shadow-md">
                      {player.username}
                    </h3>
                    {player.rating !== undefined && <PlayerRatingBadge rating={player.rating} variant="boxed" />}
                  </div>
                  {player.full_name && (
                    <p className="text-xs sm:text-sm text-primary-400 font-semibold tracking-wide truncate mt-0.5">
                      {player.full_name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Stats & Actions */}
            <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 sm:px-6 py-4 space-y-4 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {/* Goals */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                  <Target className="w-4 h-4 text-primary-400 mb-1" />
                  <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                    {player.total_goals || 0}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Goals</div>
                </div>

                {/* Assists */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                  <Target className="w-4 h-4 text-blue-400 mb-1" />
                  <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                    {player.total_assists || 0}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Assists</div>
                </div>

                {/* Goals / Game */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                  <Target className="w-4 h-4 text-green-400 mb-1" />
                  <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                    {player.games_played ? ((player.total_goals || 0) / player.games_played).toFixed(2) : '0.00'}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Goals / Game</div>
                </div>

                {/* Matches Played */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                  <Activity className="w-4 h-4 text-primary-400 mb-1" />
                  <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                    {player.games_played || 0}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Played</div>
                </div>

                {/* Win Rate */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                  <Activity className="w-4 h-4 text-orange-400 mb-1" />
                  <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                    {player.games_played && player.games_played > 0
                      ? Math.round(((player.total_wins || 0) / player.games_played) * 100) + '%'
                      : '0%'}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Win Rate</div>
                </div>

                {/* Overall Rating Card */}
                {player.rating !== undefined && (
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                    <Activity className="w-4 h-4 text-amber-400 mb-1" />
                    <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                      {formatRating(player.rating)}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">OVR</div>
                  </div>
                )}

                {/* Best Defender Awards */}
                {player.best_defender_awards ? (
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                    <span className="text-lg mb-0.5 drop-shadow-md">🛡️</span>
                    <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                      {player.best_defender_awards}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Best Def</div>
                  </div>
                ) : null}

                {/* Best GK Awards */}
                {player.best_gk_awards ? (
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                    <span className="text-lg mb-0.5 drop-shadow-md">🧤</span>
                    <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                      {player.best_gk_awards}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Best GK</div>
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              {(currentUserId === player.id || isAdmin) && (
                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    onClick={() => onEdit(player)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider border border-white/15 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Profile
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => onDelete(player)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 active:scale-95 text-red-200 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border border-red-500/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
