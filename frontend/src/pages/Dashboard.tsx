import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Activity, Users, PlayCircle, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { profile } = useAuth();
  const [topScorer, setTopScorer] = useState<any>(null);
  const [totalGoals, setTotalGoals] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch Leaderboard (Golden Boot)
      const { data: stats } = await supabase
        .from('player_stats')
        .select('*')
        .order('total_goals', { ascending: false })
        .limit(1);
      
      if (stats && stats.length > 0) {
        setTopScorer(stats[0]);
      }

      // Fetch Total Goals directly from events to be accurate
      const { count: goalCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'GOAL');
      
      if (goalCount !== null) setTotalGoals(goalCount);

      // Fetch Total Matches
      const { count: matchCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'COMPLETED');
      
      if (matchCount !== null) setTotalMatches(matchCount);

      // Fetch Recent Matches
      const { data: recent } = await supabase
        .from('sessions')
        .select('id, date, status, teams(name)')
        .order('date', { ascending: false })
        .limit(3);
      
      if (recent) setRecentMatches(recent);

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  if (loading) return <div className="text-primary-500">Loading dashboard...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">Welcome back!</h2>
        <p className="mt-1 text-sm text-neutral-400">Here's the latest from the pitch.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Golden Boot Card */}
        <div className="md:col-span-2 bg-gradient-to-br from-primary-900/40 to-neutral-900 border border-primary-900/50 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10 pointer-events-none">
            <Trophy className="w-64 h-64 text-primary-500" />
          </div>
          
          <h3 className="text-primary-400 font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Current Golden Boot
          </h3>
          
          {topScorer ? (
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-neutral-900 border-4 border-primary-500 flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {topScorer.photo_url ? (
                  <img src={topScorer.photo_url} alt="Top Scorer" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary-500">
                    {topScorer.username.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-1">{topScorer.username}</h4>
                <p className="text-lg text-neutral-300">
                  <span className="font-bold text-primary-400">{topScorer.total_goals}</span> Goals Scored
                </p>
              </div>
            </div>
          ) : (
             <p className="text-neutral-400">No goals recorded yet.</p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="flex flex-col gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex-1 flex flex-col justify-center">
            <h3 className="text-neutral-400 font-medium text-sm mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-500" /> Total Matches
            </h3>
            <p className="text-5xl font-black text-white">{totalMatches}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex-1 flex flex-col justify-center">
            <h3 className="text-neutral-400 font-medium text-sm mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" /> Total Goals
            </h3>
            <p className="text-5xl font-black text-white">{totalGoals}</p>
          </div>
        </div>
      </div>

      {/* Recent Matches */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Recent Matches</h3>
          <Link to="/matches" className="text-sm font-medium text-primary-400 hover:text-primary-300 flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recentMatches.map(match => (
            <Link key={match.id} to={`/matches/${match.id}`} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-primary-500/50 transition-colors group">
              <div className="flex justify-between items-center mb-3">
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  match.status === 'IN_PROGRESS' ? 'bg-primary-500 text-black' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {match.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-neutral-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(match.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 py-2">
                <span className="font-bold text-white truncate flex-1 text-right">{match.teams?.[0]?.name || 'Team A'}</span>
                <span className="text-xs text-neutral-600 font-bold px-1">VS</span>
                <span className="font-bold text-white truncate flex-1 text-left">{match.teams?.[1]?.name || 'Team B'}</span>
              </div>
            </Link>
          ))}
          
          {recentMatches.length === 0 && (
            <div className="col-span-full py-8 text-center text-neutral-500 bg-neutral-900 border border-dashed border-neutral-800 rounded-xl">
              No matches found.
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Actions */}
      {profile?.role === 'admin' && (
        <div className="fixed bottom-16 md:bottom-auto md:mt-8 left-0 right-0 p-4 bg-neutral-900/80 backdrop-blur-lg border-t border-neutral-800 md:relative md:bg-transparent md:border-0 md:p-0 z-40">
          <Link 
            to="/matches/new"
            className="flex items-center justify-center gap-2 w-full md:w-auto bg-primary-500 text-black px-6 py-4 rounded-xl font-bold hover:bg-primary-600 transition-colors shadow-lg"
          >
            <PlayCircle className="w-5 h-5" />
            Start New Match
          </Link>
        </div>
      )}
    </div>
  );
}
