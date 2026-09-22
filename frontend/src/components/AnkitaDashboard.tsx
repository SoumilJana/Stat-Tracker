import { Heart, Star, Flame, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export default function AnkitaDashboard() {
  const { data: soumilData, isLoading } = useQuery({
    queryKey: ['soumilStatsForAnkita'],
    queryFn: async () => {
      // 1. Get Soumil's profile/stats
      const { data: soumil } = await supabase
        .from('player_stats')
        .select('*')
        .ilike('username', 'soumil')
        .single();

      if (!soumil) return null;

      // Ensure we get the correct ID whether the view uses id or player_id
      const soumilId = soumil.player_id || soumil.id;

      // 2. Get latest completed match
      const { data: latestSession } = await supabase
        .from('sessions')
        .select('id, date')
        .eq('status', 'COMPLETED')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      let latestGoals = 0;

      if (latestSession) {
        // 3. Count his goals in that specific match
        const { count } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', latestSession.id)
          .eq('player_id', soumilId)
          .eq('event_type', 'GOAL');
          
        latestGoals = count || 0;
      }

      return {
        ...soumil,
        latestGoals
      };
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-rose-400 animate-pulse">
        <Heart className="w-12 h-12" fill="currentColor" />
        <p className="font-bold tracking-widest uppercase">Checking up on Soumil...</p>
      </div>
    );
  }

  if (!soumilData) {
    return (
      <div className="text-center text-rose-400 mt-10">
        <p>Couldn't find Soumil's data! 🥺</p>
      </div>
    );
  }

  const { total_goals, games_played, total_wins, latestGoals } = soumilData;
  const winRate = games_played > 0 ? Math.round((total_wins / games_played) * 100) : 0;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col items-center justify-center text-center mt-10">
        <Heart className="w-16 h-16 text-rose-500 mb-4 animate-pulse" fill="currentColor" />
        <h2 className="text-4xl font-black text-white mb-2">
          Hi <span className="text-rose-400">Ankita!</span> 🌸
        </h2>
        <p className="text-lg text-neutral-400">Here is how your favorite player is doing...</p>
      </div>

      {/* Latest Match Card */}
      <div className="bg-[#1a0f14] border border-rose-500/30 rounded-3xl p-8 relative overflow-hidden group shadow-[0_0_30px_rgba(244,63,94,0.1)]">
        <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-rose-900/20 to-transparent z-0" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <Flame className="w-10 h-10 text-rose-400 mb-4" />
          <h3 className="text-sm font-bold tracking-widest text-rose-300 uppercase mb-4">Latest Match Performance</h3>
          
          {latestGoals > 0 ? (
            <>
              <div className="text-4xl font-black text-white mb-2">
                Your boyfriend scored <span className="text-rose-500">{latestGoals}</span> {latestGoals === 1 ? 'goal' : 'goals'}! 🔥
              </div>
              <p className="text-rose-200/80 font-medium text-lg">So proud of him!</p>
            </>
          ) : (
            <>
              <div className="text-2xl font-black text-white mb-2">
                He didn't score this time... 🥺
              </div>
              <p className="text-rose-200/80 font-medium text-lg">But he's saving all his energy for the next match!</p>
            </>
          )}
        </div>
      </div>

      {/* Special Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Total Goals */}
        <div className="bg-[#1a0f14] border border-rose-500/20 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-rose-900/10 to-transparent z-0" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <Star className="w-10 h-10 text-rose-400 mb-4" fill="currentColor" />
            <div className="text-5xl font-black text-white mb-2">{total_goals || 0}</div>
            <div className="text-sm font-bold tracking-widest text-neutral-400 uppercase mb-4">Total Goals ⚽</div>
            <p className="text-rose-200/60 italic text-sm">"He's basically the Messi of the turf."</p>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-[#1a0f14] border border-rose-500/20 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-rose-900/10 to-transparent z-0" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <Trophy className="w-10 h-10 text-rose-400 mb-4" />
            <div className="text-5xl font-black text-white mb-2">{winRate}%</div>
            <div className="text-sm font-bold tracking-widest text-neutral-400 uppercase mb-4">
              Win Rate ({games_played || 0} Matches) 🏆
            </div>
            <p className="text-rose-200/60 italic text-sm">"Winning on the pitch, and winning in life with you."</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-500/20 rounded-3xl p-6 text-center mt-8">
        <p className="text-rose-200 italic font-medium text-lg">"No matter what the stats say, you are the real MVP of his heart. ❤️"</p>
      </div>
    </div>
  );
}
