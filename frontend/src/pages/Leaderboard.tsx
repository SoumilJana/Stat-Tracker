import { useEffect, useState } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Leaderboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await supabase
        .from('player_stats')
        .select('*')
        .order('total_goals', { ascending: false });
      
      if (data) setStats(data);
      setLoading(false);
    };

    fetchLeaderboard();
  }, []);

  if (loading) return <div className="text-primary-500">Loading leaderboard...</div>;

  const renderRankIcon = (index: number) => {
    switch(index) {
      case 0: return <Trophy className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />;
      case 1: return <Medal className="w-8 h-8 text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.5)]" />;
      case 2: return <Award className="w-8 h-8 text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]" />;
      default: return <span className="font-bold text-neutral-500 w-8 text-center text-xl">{index + 1}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-8 h-8 text-primary-500" />
        <div>
          <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">Leaderboard</h2>
          <p className="mt-1 text-sm text-neutral-400">Top goal scorers across all matches</p>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        {stats.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            No stats available yet. Play some matches!
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/50">
            {stats.map((player, index) => (
              <div 
                key={player.player_id} 
                className={`flex items-center p-4 sm:p-6 transition-colors hover:bg-neutral-800/50 ${
                  index === 0 ? 'bg-primary-900/10' : ''
                }`}
              >
                <div className="flex items-center justify-center w-12 h-12 shrink-0 mr-4">
                  {renderRankIcon(index)}
                </div>
                
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-neutral-800 flex items-center justify-center border-2 border-neutral-700 shrink-0 mr-4 overflow-hidden">
                  {player.photo_url ? (
                    <img src={player.photo_url} alt={player.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-neutral-400">
                      {player.username.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`text-lg sm:text-xl font-bold truncate ${index === 0 ? 'text-primary-400' : 'text-white'}`}>
                    {player.username}
                  </h3>
                  {index === 0 && (
                    <span className="text-xs font-medium text-yellow-500 uppercase tracking-widest">
                      Golden Boot
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col items-end justify-center pl-4 border-l border-neutral-800 ml-4">
                  <span className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight">
                    {player.total_goals}
                  </span>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                    Goals
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
