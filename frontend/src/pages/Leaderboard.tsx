import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { motion, type Variants } from 'framer-motion';
import { enrichPlayersWithRatings, type PlayerWithRating } from '../lib/playerRating';
import { getOnFirePlayers } from '../lib/streaks';
import PlayerRatingBadge from '../components/PlayerRatingBadge';

import { buildSeasons, getCurrentSeason } from '../lib/seasons';

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

      const { data: rpcData, error } = await supabase
        .rpc('get_player_stats_in_range', {
          p_start_date: selectedSeason.startDate,
          p_end_date: selectedSeason.endDate
        });
        
      if (error) {
        setErrorMsg(error.message || 'Error fetching stats');
        setLoading(false);
        return;
      }
        
      let processedData: any[] = [];
        
      if (rpcData) {
        const { data: profiles } = await supabase.from('profiles').select('id, username, photo_url');
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        
        processedData = rpcData.map((row: any) => {
          const prof = profileMap.get(row.player_id);
          return {
            player_id: row.player_id,
            username: prof?.username || 'Unknown',
            photo_url: prof?.photo_url || '',
            games_played: row.matches_played,
            total_goals: row.goals,
            total_assists: row.assists,
            wins: row.wins,
            losses: row.losses,
            draws: row.draws,
            best_defender_awards: row.best_defender_awards || 0,
            best_gk_awards: row.best_gk_awards || 0
          };
        });
        
        processedData.sort((a, b) => {
          if (b.total_goals !== a.total_goals) return b.total_goals - a.total_goals;
          if (b.total_assists !== a.total_assists) return b.total_assists - a.total_assists;
          if (b.games_played !== a.games_played) return b.games_played - a.games_played;
          return a.username.localeCompare(b.username);
        });
      }
      
      const firePlayers = await getOnFirePlayers();
      setStats(enrichPlayersWithRatings(processedData, firePlayers));
      setLoading(false);
    };

    fetchLeaderboard();
  }, [selectedSeasonNum]);

  if (errorMsg) return (
    <div className="p-12 text-center text-red-500 bg-red-900/20 border border-red-500/50 rounded-3xl">
      Error: {errorMsg}
    </div>
  );

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500"></div>
    </div>
  );

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
        className="mb-10 text-center sm:text-left flex flex-col sm:flex-row sm:items-end justify-between gap-6"
      >
        <div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase">Leaderboard</h2>
          <p className="mt-2 text-xs sm:text-sm font-bold text-neutral-500 tracking-widest uppercase">Monthly Seasons</p>
        </div>
        
        <select 
          value={selectedSeasonNum}
          onChange={(e) => setSelectedSeasonNum(parseInt(e.target.value))}
          className="bg-neutral-900 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary-500 cursor-pointer"
        >
          {seasons.map(s => (
             <option key={s.number} value={s.number}>{s.label}</option>
          ))}
        </select>
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
          className="space-y-4"
        >
          {stats.map((player, index) => (
            <motion.div 
              variants={itemVariants}
              key={player.player_id} 
              className={`relative overflow-hidden rounded-2xl bg-neutral-950 border group transition-all duration-500 ${
                player.onFire 
                  ? 'border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:shadow-[0_0_25px_rgba(249,115,22,0.6)]' 
                  : 'border-white/5 hover:border-white/20'
              }`}
            >
              {/* Row Background Image */}
              {player.photo_url && (
                <div className="absolute inset-0 pointer-events-none">
                  <img src={player.photo_url} alt="" className="w-full h-full object-cover opacity-40 group-hover:scale-105 group-hover:opacity-60 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/40 to-neutral-950" />
                </div>
              )}

              {/* Content */}
              <div className="relative z-10 flex items-center justify-between py-5 sm:py-6 pl-3 sm:pl-4 pr-5 sm:pr-6">
                <div className="flex items-center gap-3 sm:gap-4">
                   {/* Rank */}
                   <span className={`text-4xl sm:text-6xl font-black italic tracking-tighter w-12 sm:w-16 text-center transition-colors ${index === 0 ? 'text-white' : 'text-white/10 group-hover:text-white/30'}`}>
                     {index + 1}
                   </span>
                   
                   {/* Player Info */}
                   <div>
                     <h3 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wider drop-shadow-md flex items-baseline gap-1">
                        {player.username}
                      </h3>
                     <div className="flex items-center gap-3 mt-1">
                       <PlayerRatingBadge rating={player.rating} variant="boxed" />
                       <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                         {player.games_played || 0} MATCHES
                       </span>
                     </div>
                   </div>
                </div>

                {/* Goals, Assists & Defensive Awards */}
                <div className="flex items-center text-right pr-2 sm:pr-4">
                  
                  {/* Awards Group */}
                  <div className="flex items-center gap-3 sm:gap-4 mr-5 sm:mr-8">
                    {player.best_defender_awards && player.best_defender_awards > 0 ? (
                      <div className="flex items-center justify-center">
                        <span className="text-xl sm:text-3xl font-black text-amber-500 tabular-nums leading-none tracking-tighter drop-shadow-lg flex items-center">
                          <span className="text-lg sm:text-2xl mr-0.5">🛡️</span>
                          <span className="text-xs sm:text-lg text-amber-500/50">x</span>
                          <span className="ml-0.5">{player.best_defender_awards}</span>
                        </span>
                      </div>
                    ) : null}
                    
                    {player.best_gk_awards && player.best_gk_awards > 0 ? (
                      <div className="flex items-center justify-center">
                        <span className="text-xl sm:text-3xl font-black text-purple-400 tabular-nums leading-none tracking-tighter drop-shadow-lg flex items-center">
                          <span className="text-lg sm:text-2xl mr-0.5">🧤</span>
                          <span className="text-xs sm:text-lg text-purple-400/50">x</span>
                          <span className="ml-0.5">{player.best_gk_awards}</span>
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end justify-center">
                    <div className="flex items-baseline">
                      <span className="text-4xl sm:text-6xl font-black text-white tabular-nums leading-none tracking-tighter drop-shadow-lg">
                        {player.total_goals}
                      </span>
                      <span className="text-2xl sm:text-4xl text-neutral-600 font-black mx-1 sm:mx-2 leading-none">/</span>
                      <span className="text-3xl sm:text-5xl font-black text-blue-400 tabular-nums leading-none tracking-tighter drop-shadow-lg">
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
