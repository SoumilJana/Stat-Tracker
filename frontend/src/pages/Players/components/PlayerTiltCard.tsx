import React from 'react';
import { motion, useMotionValue, useTransform, useMotionTemplate, useSpring } from 'framer-motion';
import type { Profile } from '../types';
import PlayerRatingBadge from '../../../components/PlayerRatingBadge';

interface PlayerTiltCardProps {
  player: Profile;
  isDiamond: boolean;
  shouldReduceMotion?: boolean | null;
  onClick: () => void;
}

export function PlayerTiltCard({ player, isDiamond, shouldReduceMotion, onClick }: PlayerTiltCardProps) {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springConfig = { damping: 30, stiffness: 400, mass: 0.5 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // Reduced tilt angles for a more premium, subtle effect
  const rotateX = useTransform(smoothMouseY, [0, 1], ['10deg', '-10deg']);
  const rotateY = useTransform(smoothMouseX, [0, 1], ['-10deg', '10deg']);

  const glareX = useTransform(smoothMouseX, [0, 1], ['0%', '100%']);
  const glareY = useTransform(smoothMouseY, [0, 1], ['0%', '100%']);

  const background = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDiamond || shouldReduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / height));
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    if (!isDiamond || shouldReduceMotion) return;
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <div className="w-full max-w-md mx-auto min-[480px]:max-w-none">
      <motion.div
        layoutId={`card-${player.id}`}
        role="button"
        tabIndex={0}
        aria-label={`View profile for ${player.username}`}
        onClick={onClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={
          isDiamond && !shouldReduceMotion
            ? {
                rotateX,
                rotateY,
                transformStyle: 'preserve-3d'
              }
            : {}
        }
        className={`group relative bg-black border rounded-2xl overflow-hidden cursor-pointer shadow-xl transition-all duration-300 aspect-[3/4] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 ${
          isDiamond
            ? 'border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.6)] hover:shadow-[0_0_35px_rgba(34,211,238,0.9)]'
            : player.onFire
            ? 'border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:shadow-[0_0_25px_rgba(249,115,22,0.6)]'
            : 'border-white/10 hover:border-primary-500/40 hover:shadow-primary-500/20'
        }`}
      >
        {isDiamond && !shouldReduceMotion && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-50 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background }}
          />
        )}

        {/* Background Image Container */}
        <motion.div layoutId={`avatar-${player.id}`} className="absolute inset-0 bg-neutral-900">
          {player.photo_url ? (
            <img
              src={player.photo_url}
              alt={player.username}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-[center_20%] opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 ease-out"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center shadow-inner">
                <span className="text-3xl font-black text-primary-400/80 tracking-tighter">
                  {player.username.substring(0, 2).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Top Scrim (Protects Top Badges) */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Bottom Scrim (Protects Identity & Stats) */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/85 via-45% to-transparent pointer-events-none" />

        {/* Content Container */}
        <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-between pointer-events-none z-10">
          {/* Top Row: Structured Badge Anchor */}
          <div className="flex items-center justify-between gap-2 w-full">
            {/* Left: Position & Podium Rank */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-lg border backdrop-blur-md text-[10px] font-black uppercase tracking-wider ${
                  isDiamond
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
                {isDiamond ? 'MANAGER' : player.position || 'FWD'}
              </span>

              {player.leaderboardRank && player.leaderboardRank <= 3 && (
                <span
                  className={`px-2 py-0.5 rounded-lg border backdrop-blur-md text-[10px] font-black uppercase tracking-wider ${
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
            </div>

            {/* Right: OVR Rating & OnFire Badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              {player.onFire && (
                <span
                  className="px-1.5 py-0.5 rounded-lg border border-orange-500/40 bg-orange-500/20 text-orange-400 text-[10px] font-black animate-pulse"
                  title="On Fire"
                >
                  🔥
                </span>
              )}
              {player.rating !== undefined && <PlayerRatingBadge rating={player.rating} variant="boxed" />}
            </div>
          </div>

          {/* Lower Card Area: Identity & Athletic Stat Strip */}
          <div className="w-full space-y-2.5 mt-auto">
            {/* Achievement Chips */}
            {(player.isTopAssister || (player.best_defender_awards || 0) > 0 || (player.best_gk_awards || 0) > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {player.isTopAssister && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-400/30 bg-blue-500/10 backdrop-blur-sm text-[9px] font-bold text-blue-300 uppercase tracking-wider">
                    🎯 TOP ASSIST
                  </span>
                )}
                {(player.best_defender_awards || 0) > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-400/30 bg-amber-500/10 backdrop-blur-sm text-[9px] font-bold text-amber-300 uppercase tracking-wider">
                    🛡️ {player.best_defender_awards}
                  </span>
                )}
                {(player.best_gk_awards || 0) > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-purple-400/30 bg-purple-500/10 backdrop-blur-sm text-[9px] font-bold text-purple-300 uppercase tracking-wider">
                    🧤 {player.best_gk_awards}
                  </span>
                )}
              </div>
            )}

            {/* Player Name & Subtitle */}
            <div className="min-w-0">
              <motion.h3
                layoutId={`username-${player.id}`}
                className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-lg truncate"
              >
                {player.username}
              </motion.h3>
              {player.full_name && (
                <motion.p
                  layoutId={`fullname-${player.id}`}
                  className="text-[11px] font-bold text-primary-400 uppercase tracking-wider truncate drop-shadow-md mt-0.5"
                >
                  {player.full_name}
                </motion.p>
              )}
            </div>

            {/* Athletic Card Stats Strip */}
            <div className="grid grid-cols-4 gap-1.5 pt-2.5 border-t border-white/10 w-full">
              <div className="flex flex-col items-center justify-center py-1.5 px-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/[0.08]">
                <span className="text-base sm:text-lg font-black text-white tabular-nums leading-none">
                  {player.total_goals || 0}
                </span>
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-1">GLS</span>
              </div>
              <div className="flex flex-col items-center justify-center py-1.5 px-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/[0.08]">
                <span className="text-base sm:text-lg font-black text-white tabular-nums leading-none">
                  {player.total_assists || 0}
                </span>
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-1">AST</span>
              </div>
              <div className="flex flex-col items-center justify-center py-1.5 px-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/[0.08]">
                <span className="text-base sm:text-lg font-black text-white tabular-nums leading-none">
                  {player.games_played ? ((player.total_goals || 0) / player.games_played).toFixed(2) : '0.00'}
                </span>
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-1">G/G</span>
              </div>
              <div className="flex flex-col items-center justify-center py-1.5 px-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/[0.08]">
                <span className="text-base sm:text-lg font-black text-white tabular-nums leading-none">
                  {player.games_played || 0}
                </span>
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-1">APP</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
