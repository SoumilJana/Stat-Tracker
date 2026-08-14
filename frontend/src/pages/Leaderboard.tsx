import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, type Variants } from 'framer-motion';

export default function Leaderboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await supabase
        .from('player_stats')
        .select('*')
        .order('total_goals', { ascending: false })
        .order('total_assists', { ascending: false })
        .order('games_played', { ascending: false })
        .order('username', { ascending: true });
      
      if (data) setStats(data);
      setLoading(false);
    };

    fetchLeaderboard();
  }, []);

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
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 overflow-x-hidden">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center sm:text-left"
      >
        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase">Leaderboard</h2>
        <p className="mt-2 text-xs sm:text-sm font-bold text-neutral-500 tracking-widest uppercase">Top goal scorers of all time</p>
      </motion.div>

      {stats.length === 0 ? (
        <div className="p-12 text-center text-neutral-500 bg-neutral-900/50 border border-white/5 rounded-3xl">
          No stats available yet. Play some matches!
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
              className="relative overflow-hidden rounded-2xl bg-neutral-950 border border-white/5 group transition-all duration-500 hover:border-white/20"
            >
              {/* Row Background Image */}
              {player.photo_url && (
                <div className="absolute inset-0 pointer-events-none">
                  <img src={player.photo_url} alt="" className="w-full h-full object-cover opacity-40 group-hover:scale-105 group-hover:opacity-60 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/40 to-neutral-950" />
                </div>
              )}

              {/* Content */}
              <div className="relative z-10 flex items-center justify-between p-5 sm:p-6">
                <div className="flex items-center gap-5 sm:gap-8">
                   {/* Rank */}
                   <span className={`text-4xl sm:text-6xl font-black italic tracking-tighter w-12 sm:w-16 text-center transition-colors ${index === 0 ? 'text-white' : 'text-white/10 group-hover:text-white/30'}`}>
                     {index + 1}
                   </span>
                   
                   {/* Player Info */}
                   <div>
                     <h3 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wider drop-shadow-md">
                       {player.username}
                     </h3>
                     <div className="flex items-center gap-3 mt-1">
                       <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                         {player.games_played || 0} MATCHES
                       </span>
                     </div>
                   </div>
                </div>

                {/* Goals & Assists */}
                <div className="flex gap-4 sm:gap-6 text-right pr-2 sm:pr-4">
                  <div className="flex flex-col items-end justify-center">
                    <span className="text-3xl sm:text-5xl font-black text-blue-400 tabular-nums leading-none tracking-tighter drop-shadow-lg">
                      {player.total_assists || 0}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">
                      Assists
                    </span>
                  </div>
                  <div className="flex flex-col items-end justify-center">
                    <span className="text-4xl sm:text-6xl font-black text-white tabular-nums leading-none tracking-tighter drop-shadow-lg">
                      {player.total_goals}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">
                      Goals
                    </span>
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
