import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { motion, type Variants } from 'framer-motion';
import { enrichPlayersWithRatings, type PlayerWithRating } from '../lib/playerRating';
import { getOnFirePlayers } from '../lib/streaks';
import PlayerRatingBadge from '../components/PlayerRatingBadge';
import { ChevronDown } from 'lucide-react';

import { buildSeasons, getCurrentSeason } from '../lib/seasons';

function LeaderboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-10 w-44 bg-neutral-800/70 rounded-2xl skeleton-shimmer" />
          <div className="h-4 w-32 bg-neutral-800/40 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-11 w-40 bg-neutral-800/50 rounded-xl skeleton-shimmer" />
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-neutral-900/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between skeleton-shimmer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-800/60 rounded-full" />
              <div className="space-y-1.5">
                <div className="h-5 w-28 bg-neutral-800/60 rounded" />
                <div className="h-3 w-16 bg-neutral-800/40 rounded" />
              </div>
            </div>
            <div className="h-8 w-20 bg-neutral-800/50 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const seasons = useMemo(() => buildSeasons(), []);
  
  const [stats, setStats] = useState<PlayerWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Start on the currently active season
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(() => getCurrentSeason(seasons).number);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      const selectedSeason = seasons.find(s => s.number === selectedSeasonNum) || seasons[0];

      const [rpcRes, profilesRes, firePlayers] = await Promise.all([
        supabase.rpc('get_player_stats_in_range', {
          p_start_date: selectedSeason.startDate,
          p_end_date: selectedSeason.endDate
        }),
        supabase.from('profiles').select('id, username, photo_url, ranking_image_url'),
        getOnFirePlayers()
      ]);
        
      if (rpcRes.error) {
        setErrorMsg(rpcRes.error.message || 'Error fetching stats');
        setLoading(false);
        return;
      }
        
      let processedData: any[] = [];
        
      if (rpcRes.data) {
        const profiles = profilesRes.data || [];
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        
        processedData = rpcRes.data.map((row: any) => {
          const prof = profileMap.get(row.player_id);
          return {
            player_id: row.player_id,
            username: prof?.username || 'Unknown',
            photo_url: prof?.photo_url || '',
            ranking_image_url: prof?.ranking_image_url || null,
            games_played: row.matches_played,
            total_goals: row.goals,
            total_assists: row.assists,
            wins: row.wins,
            losses: row.losses,
            draws: row.draws,
            best_defender_awards: row.best_defender_awards || 0,
            best_gk_awards: row.best_gk_awards || 0,
            motm_awards: row.motm_awards || 0
          };
        });
        
        processedData.sort((a, b) => {
          if (b.total_goals !== a.total_goals) return b.total_goals - a.total_goals;
          if (b.total_assists !== a.total_assists) return b.total_assists - a.total_assists;
          if (b.games_played !== a.games_played) return b.games_played - a.games_played;
          return a.username.localeCompare(b.username);
        });
      }
      
      setStats(enrichPlayersWithRatings(processedData, firePlayers));
      setLoading(false);
    };

    fetchLeaderboard();
  }, [selectedSeasonNum, seasons]);

  if (errorMsg) return (
    <div className="p-8 text-center text-red-400 bg-red-950/20 border border-red-500/30 rounded-3xl">
      Error: {errorMsg}
    </div>
  );

  if (loading) return <LeaderboardSkeleton />;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 overflow-x-hidden">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center sm:text-left flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tighter uppercase">Leaderboard</h2>
          <p className="mt-1 text-xs sm:text-sm font-bold text-neutral-500 tracking-widest uppercase">Monthly Seasons</p>
        </div>
        
        <div className="relative inline-block w-full sm:w-auto">
          <select 
            value={selectedSeasonNum}
            onChange={(e) => setSelectedSeasonNum(parseInt(e.target.value))}
            className="w-full sm:w-auto appearance-none bg-neutral-900 border border-white/10 hover:border-white/25 text-white rounded-xl pl-4 pr-10 py-3 sm:py-2.5 text-sm font-bold outline-none focus:border-primary-500 transition-colors cursor-pointer shadow-sm active:scale-[0.98]"
          >
            {seasons.map(s => (
               <option key={s.number} value={s.number} className="bg-neutral-900 text-white">{s.label}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </motion.div>

      {stats.length === 0 ? (
        <div className="p-12 text-center text-neutral-500 bg-neutral-900/50 border border-white/5 rounded-3xl">
          No stats available for this month. Play some matches!
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-3 sm:space-y-4"
        >
          {/* Column Legend */}
          <div className="flex justify-between items-center px-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest pb-1 select-none">
            <span>Rank & Player</span>
            <span>Goals / Assists</span>
          </div>

          {stats.map((player, index) => (
            <motion.div 
              variants={itemVariants}
              key={player.player_id} 
              className={`relative overflow-hidden rounded-2xl bg-neutral-950 border group transition-all duration-300 active:scale-[0.99] select-none ${
                player.onFire 
                  ? 'border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:shadow-[0_0_25px_rgba(249,115,22,0.6)]' 
                  : 'border-white/5 hover:border-white/20'
              }`}
            >
              {/* Row Background Image (Ranking Banner with fallback to Portrait) */}
              {(() => {
                const bgImage = player.ranking_image_url || player.photo_url;
                if (!bgImage) return null;
                return (
                  <div className="absolute inset-0 pointer-events-none">
                    <img 
                      src={bgImage} 
                      alt="" 
                      loading="lazy" 
                      decoding="async" 
                      className="w-full h-full object-cover object-[center_20%] opacity-40 group-hover:scale-105 group-hover:opacity-60 transition-all duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/50 to-neutral-950" />
                  </div>
                );
              })()}

              {/* Content */}
              <div className="relative z-10 flex items-center justify-between py-4 sm:py-6 pl-2.5 sm:pl-4 pr-3.5 sm:pr-6">
                <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                   {/* Rank */}
                   <span className={`text-3xl sm:text-5xl font-black italic tracking-tighter w-8 sm:w-14 text-center shrink-0 transition-colors ${index === 0 ? 'text-white' : 'text-white/20 group-hover:text-white/40'}`}>
                     {index + 1}
                   </span>
                   
                   {/* Player Info */}
                   <div className="min-w-0">
                     <h3 className="text-base sm:text-2xl font-black text-white uppercase tracking-wider drop-shadow-md truncate">
                        {player.username}
                      </h3>
                     <div className="flex items-center gap-2 mt-0.5">
                       <PlayerRatingBadge rating={player.rating} variant="boxed" />
                       <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest whitespace-nowrap">
                         {player.games_played || 0} GP
                       </span>
                     </div>
                   </div>
                </div>

                {/* Goals, Assists & Defensive Awards */}
                <div className="flex items-center text-right shrink-0">
                  
                  {/* Awards Group */}
                  <div className="flex items-center gap-2 sm:gap-3 mr-3 sm:mr-8">
                    {player.best_defender_awards && player.best_defender_awards > 0 ? (
                      <div className="flex items-center justify-center">
                        <span className="text-base sm:text-2xl font-black text-amber-500 tabular-nums leading-none tracking-tighter drop-shadow-lg flex items-center">
                          <span className="text-sm sm:text-xl mr-0.5">🛡️</span>
                          <span className="text-[10px] sm:text-sm text-amber-500/60">x</span>
                          <span className="ml-0.5">{player.best_defender_awards}</span>
                        </span>
                      </div>
                    ) : null}
                    
                    {player.best_gk_awards && player.best_gk_awards > 0 ? (
                      <div className="flex items-center justify-center">
                        <span className="text-base sm:text-2xl font-black text-purple-400 tabular-nums leading-none tracking-tighter drop-shadow-lg flex items-center">
                          <span className="text-sm sm:text-xl mr-0.5">🧤</span>
                          <span className="text-[10px] sm:text-sm text-purple-400/60">x</span>
                          <span className="ml-0.5">{player.best_gk_awards}</span>
                        </span>
                      </div>
                    ) : null}

                    {player.motm_awards && player.motm_awards > 0 ? (
                      <div className="flex items-center justify-center">
                        <span className="text-base sm:text-2xl font-black text-yellow-400 tabular-nums leading-none tracking-tighter drop-shadow-lg flex items-center">
                          <span className="text-sm sm:text-xl mr-0.5">⭐</span>
                          <span className="text-[10px] sm:text-sm text-yellow-400/60">x</span>
                          <span className="ml-0.5">{player.motm_awards}</span>
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end justify-center">
                    <div className="flex items-baseline">
                      <span className="text-3xl sm:text-5xl font-black text-white tabular-nums leading-none tracking-tighter drop-shadow-lg">
                        {player.total_goals}
                      </span>
                      <span className="text-xl sm:text-3xl text-neutral-600 font-black mx-1 sm:mx-1.5 leading-none">/</span>
                      <span className="text-2xl sm:text-4xl font-black text-blue-400 tabular-nums leading-none tracking-tighter drop-shadow-lg">
                        {player.total_assists || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
