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
        .select(`
          id, date, status, mode, location,
          teams ( id, name ),
          events ( team_id, event_type )
        `)
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
        <div className="md:col-span-2 bg-black border border-white/5 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl group flex flex-col justify-end min-h-[240px]">
          {topScorer?.photo_url && (
            <div className="absolute inset-0 z-0">
              <img src={topScorer.photo_url} alt="Top Scorer" className="w-full h-full object-cover opacity-40 group-hover:opacity-50 group-hover:scale-105 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
            </div>
          )}
          
          <div className="relative z-10 flex flex-col h-full justify-between">
            <h3 className="text-primary-500 font-bold uppercase tracking-widest text-xs mb-8 flex items-center gap-2 drop-shadow-md">
              <Trophy className="w-4 h-4" /> Current Golden Boot
            </h3>
            
            {topScorer ? (
              <div className="flex items-end justify-between gap-6 mt-auto">
                <div>
                  <h4 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-0 drop-shadow-lg">{topScorer.username}</h4>
                </div>
                <div className="text-right">
                  <div className="text-5xl sm:text-6xl font-black text-primary-500 tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] leading-none">
                    {topScorer.total_goals}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-2">
                    Goals Scored
                  </div>
                </div>
              </div>
            ) : (
               <p className="text-neutral-500 font-medium">No goals recorded yet.</p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="bg-black border border-white/5 rounded-2xl p-6 flex-1 flex flex-col justify-center relative overflow-hidden shadow-xl hover:border-white/10 transition-colors">
            <div className="absolute right-0 top-0 opacity-[0.03] transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
              <Activity className="w-32 h-32 text-primary-500" />
            </div>
            <h3 className="text-primary-500/70 font-bold uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2">
              <Activity className="w-3 h-3" /> Matches
            </h3>
            <p className="text-5xl font-black text-white drop-shadow-md">{totalMatches}</p>
          </div>
          <div className="bg-black border border-white/5 rounded-2xl p-6 flex-1 flex flex-col justify-center relative overflow-hidden shadow-xl hover:border-white/10 transition-colors">
            <div className="absolute right-0 top-0 opacity-[0.03] transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
              <Users className="w-32 h-32 text-primary-500" />
            </div>
            <h3 className="text-primary-500/70 font-bold uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2">
              <Users className="w-3 h-3" /> Goals
            </h3>
            <p className="text-5xl font-black text-white drop-shadow-md">{totalGoals}</p>
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
          {recentMatches.map(match => {
            // Calculate Scores for COMPLETED matches
            const teamScores: Record<string, number> = {};
            if (match.teams) {
              match.teams.forEach((t: any) => teamScores[t.id] = 0);
            }
            if (match.events) {
              match.events.forEach((ev: any) => {
                if (ev.event_type === 'GOAL' && teamScores[ev.team_id] !== undefined) {
                  teamScores[ev.team_id] += 1;
                }
              });
            }

            // Sort teams A, B, C for consistent display
            const sortedTeams = match.teams?.sort((a: any, b: any) => a.name.localeCompare(b.name)) || [];
            const teamNames = sortedTeams.map((t: any) => t.name.replace('Team ', ''));
            const scores = sortedTeams.map((t: any) => teamScores[t.id]);

            return (
              <Link key={match.id} to={`/matches/${match.id}`} className="bg-black border border-white/5 rounded-2xl p-6 hover:border-primary-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] shadow-xl transition-all duration-300 block group relative">
                <div className="flex justify-between items-start mb-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    match.status === 'IN_PROGRESS' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 
                    match.status === 'SCHEDULED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    'bg-white/5 text-neutral-400 border border-white/10'
                  }`}>
                    {match.status.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1 rounded-full">
                    <Calendar className="w-3 h-3" />
                    {new Date(match.date).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex justify-center items-center text-lg font-bold text-white mb-2 h-16">
                  {match.status === 'COMPLETED' ? (
                    <div className="flex flex-col items-center">
                      <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-[0.2em] mb-2">{teamNames.join(' | ')}</div>
                      <div className="text-4xl text-primary-500 tracking-widest font-black drop-shadow-md">{scores.join(' - ')}</div>
                    </div>
                  ) : (
                    <div className="flex items-center w-full justify-between">
                      <span className="truncate flex-1 text-center text-primary-400 text-xl">{sortedTeams[0]?.name.replace('Team ', '') || 'A'}</span>
                      <span className="text-neutral-700 px-4 text-sm font-black italic">VS</span>
                      <span className="truncate flex-1 text-center text-blue-400 text-xl">{sortedTeams[1]?.name.replace('Team ', '') || 'B'}</span>
                      {match.mode === 'WINNER_STAYS' && (
                        <>
                          <span className="text-neutral-700 px-4 text-sm font-black italic">VS</span>
                          <span className="truncate flex-1 text-center text-orange-400 text-xl">{sortedTeams[2]?.name.replace('Team ', '') || 'C'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          
          {recentMatches.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-500 bg-black/50 border border-dashed border-white/10 rounded-3xl font-medium tracking-wide">
              No matches found.
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Actions */}
      {profile?.role === 'admin' && (
        <div className="fixed bottom-16 md:bottom-auto md:mt-12 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/5 md:relative md:bg-transparent md:border-0 md:p-0 z-40 flex justify-center">
          <Link 
            to="/matches/new"
            className="flex items-center justify-center gap-3 w-full md:w-auto bg-primary-500 text-black px-8 py-4 rounded-full font-black hover:bg-primary-400 hover:scale-105 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] tracking-widest uppercase text-sm"
          >
            <PlayCircle className="w-5 h-5" />
            Start New Match
          </Link>
        </div>
      )}
    </div>
  );
}
