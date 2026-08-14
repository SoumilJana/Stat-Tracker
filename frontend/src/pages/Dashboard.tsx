import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Activity, Users, Plus, Calendar, ArrowRight, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { enrichPlayersWithRatings, type PlayerWithRating } from '../lib/playerRating';
import PlayerRatingBadge from '../components/PlayerRatingBadge';

import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { profile } = useAuth();
  const [topScorer, setTopScorer] = useState<PlayerWithRating | null>(null);
  const [topAssister, setTopAssister] = useState<PlayerWithRating | null>(null);
  const [totalGoals, setTotalGoals] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [upcomingMatch, setUpcomingMatch] = useState<any>(null);
  const [completedMatch, setCompletedMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch all player stats and enrich with ratings
      const { data: allStats } = await supabase
        .from('player_stats')
        .select('*');
      
      if (allStats && allStats.length > 0) {
        const enriched = enrichPlayersWithRatings(allStats);
        
        // Golden Boot: top scorer
        const sortedByGoals = [...enriched].sort((a, b) =>
          b.total_goals - a.total_goals || b.total_assists - a.total_assists || b.games_played - a.games_played || a.username.localeCompare(b.username)
        );
        setTopScorer(sortedByGoals[0]);
        
        // Playmaker: top assister
        const sortedByAssists = [...enriched].sort((a, b) =>
          b.total_assists - a.total_assists || b.total_goals - a.total_goals || b.games_played - a.games_played || a.username.localeCompare(b.username)
        );
        setTopAssister(sortedByAssists[0]);
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

      // Fetch Most Recent Completed Match
      const { data: completed } = await supabase
        .from('sessions')
        .select(`
          id, date, status, mode, location,
          teams ( id, name ),
          events ( team_id, event_type )
        `)
        .eq('status', 'COMPLETED')
        .order('date', { ascending: false })
        .limit(1);
      
      if (completed && completed.length > 0) setCompletedMatch(completed[0]);

      // Fetch Next Upcoming Match
      const { data: upcoming } = await supabase
        .from('sessions')
        .select(`
          id, date, status, mode, location,
          teams ( id, name ),
          events ( team_id, event_type )
        `)
        .in('status', ['SCHEDULED', 'IN_PROGRESS'])
        .order('date', { ascending: false })
        .limit(1);
      
      if (upcoming && upcoming.length > 0) setUpcomingMatch(upcoming[0]);

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

      {/* Hero Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Golden Boot Card */}
        <div className="bg-[#0a0a0a] border border-white/[0.03] rounded-3xl p-6 sm:p-10 relative overflow-hidden group flex flex-col justify-end min-h-[280px]">
          {topScorer?.photo_url && (
            <div className="absolute inset-0 z-0">
              <img src={topScorer.photo_url} alt="Top Scorer" className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
            </div>
          )}
          
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center gap-3 mb-8 opacity-80">
              <Trophy className="w-4 h-4 text-primary-500" />
              <h3 className="text-white font-bold uppercase tracking-[0.2em] text-[10px]">Golden Boot</h3>
            </div>
            
            {topScorer ? (
              <div className="flex items-end justify-between gap-6 mt-auto">
                <div>
                  <h4 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
                    {topScorer.username}
                    <PlayerRatingBadge rating={topScorer.rating} size="sm" />
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-6xl sm:text-7xl font-black text-primary-500 tracking-tighter leading-none mb-1">
                    {topScorer.total_goals}
                  </div>
                  <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em]">
                    Goals
                  </div>
                </div>
              </div>
            ) : (
               <p className="text-neutral-600 font-medium tracking-wide">No goals recorded yet.</p>
            )}
          </div>
        </div>

        {/* Playmaker Card */}
        <div className="bg-[#0a0a0a] border border-white/[0.03] rounded-3xl p-6 sm:p-10 relative overflow-hidden group flex flex-col justify-end min-h-[280px]">
          {topAssister?.photo_url && (
            <div className="absolute inset-0 z-0">
              <img src={topAssister.photo_url} alt="Top Assister" className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
            </div>
          )}
          
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center gap-3 mb-8 opacity-80">
              <Target className="w-4 h-4 text-blue-500" />
              <h3 className="text-white font-bold uppercase tracking-[0.2em] text-[10px]">Playmaker</h3>
            </div>
            
            {topAssister ? (
              <div className="flex items-end justify-between gap-4 mt-auto">
                <div>
                  <h4 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
                    {topAssister.username}
                    <PlayerRatingBadge rating={topAssister.rating} size="sm" />
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-6xl sm:text-7xl font-black text-blue-500 tracking-tighter leading-none mb-1">
                    {topAssister.total_assists}
                  </div>
                  <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em]">
                    Assists
                  </div>
                </div>
              </div>
            ) : (
               <p className="text-neutral-600 font-medium tracking-wide">No assists yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Sleek Global Stats Strip */}
      <div className="bg-white/[0.02] border border-white/[0.03] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-around gap-8 sm:gap-4 backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          <div className="text-neutral-500 flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] mb-2">
            <Activity className="w-3 h-3" /> Matches Played
          </div>
          <div className="text-4xl font-black text-white tracking-tighter">{totalMatches}</div>
        </div>
        
        <div className="hidden sm:block w-px h-12 bg-white/[0.05]" />
        
        <div className="flex flex-col items-center text-center">
          <div className="text-neutral-500 flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] mb-2">
            <Users className="w-3 h-3" /> Total Goals
          </div>
          <div className="text-4xl font-black text-white tracking-tighter">{totalGoals}</div>
        </div>
        
        <div className="hidden sm:block w-px h-12 bg-white/[0.05]" />

        <div className="flex flex-col items-center text-center">
          <div className="text-neutral-500 flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] mb-2">
            <Trophy className="w-3 h-3" /> Avg Goals / Match
          </div>
          <div className="text-4xl font-black text-white tracking-tighter">
            {totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0.0'}
          </div>
        </div>
      </div>

      {/* Matches Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Upcoming Match */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Upcoming</h3>
            <Link to="/matches" className="text-sm font-medium text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {upcomingMatch ? (
            <Link key={upcomingMatch.id} to={`/matches/${upcomingMatch.id}`} className="bg-[#0a0a0a] border border-white/[0.03] rounded-3xl p-6 hover:bg-white/[0.02] hover:border-white/[0.05] transition-all duration-300 block group relative">
              <div className="flex justify-between items-start mb-8">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] ${
                  upcomingMatch.status === 'IN_PROGRESS' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 
                  'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {upcomingMatch.status.replace('_', ' ')}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {new Date(upcomingMatch.date).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex justify-center items-center text-lg font-bold text-white mb-2 h-16">
                <div className="flex items-center w-full justify-between">
                  {(() => {
                    const sortedTeams = upcomingMatch.teams?.sort((a: any, b: any) => a.name.localeCompare(b.name)) || [];
                    return (
                      <>
                        <span className="truncate flex-1 text-center text-primary-400 text-xl">{sortedTeams[0]?.name.replace('Team ', '') || 'A'}</span>
                        <span className="text-neutral-700 px-4 text-sm font-black italic">VS</span>
                        <span className="truncate flex-1 text-center text-blue-400 text-xl">{sortedTeams[1]?.name.replace('Team ', '') || 'B'}</span>
                        {upcomingMatch.mode === 'WINNER_STAYS' && (
                          <>
                            <span className="text-neutral-700 px-4 text-sm font-black italic">VS</span>
                            <span className="truncate flex-1 text-center text-orange-400 text-xl">{sortedTeams[2]?.name.replace('Team ', '') || 'C'}</span>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </Link>
          ) : (
            <div className="py-12 text-center text-neutral-500 bg-black/50 border border-dashed border-white/10 rounded-2xl font-medium tracking-wide">
              No upcoming matches.
            </div>
          )}
        </div>

        {/* Last Completed Match */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Last Result</h3>
            <Link to="/matches" className="text-sm font-medium text-primary-400 hover:text-primary-300 flex items-center gap-1">
              History <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {completedMatch ? (
            <Link key={completedMatch.id} to={`/matches/${completedMatch.id}`} className="bg-[#0a0a0a] border border-white/[0.03] rounded-3xl p-6 hover:bg-white/[0.02] hover:border-white/[0.05] transition-all duration-300 block group relative">
              <div className="flex justify-between items-start mb-8">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] bg-white/[0.02] text-neutral-500 border border-white/[0.03]">
                  COMPLETED
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {new Date(completedMatch.date).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex justify-center items-center text-lg font-bold text-white mb-2 h-16">
                <div className="flex flex-col items-center">
                  {(() => {
                    const sortedTeams = completedMatch.teams?.sort((a: any, b: any) => a.name.localeCompare(b.name)) || [];
                    const teamNames = sortedTeams.map((t: any) => t.name.replace('Team ', ''));
                    
                    const teamScores: Record<string, number> = {};
                    sortedTeams.forEach((t: any) => teamScores[t.id] = 0);
                    if (completedMatch.events) {
                      completedMatch.events.forEach((ev: any) => {
                        if (ev.event_type === 'GOAL' && teamScores[ev.team_id] !== undefined) {
                          teamScores[ev.team_id] += 1;
                        }
                      });
                    }
                    const scores = sortedTeams.map((t: any) => teamScores[t.id]);

                    return (
                      <>
                        <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-[0.2em] mb-2">{teamNames.join(' | ')}</div>
                        <div className="text-4xl text-primary-500 tracking-widest font-black drop-shadow-md">{scores.join(' - ')}</div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </Link>
          ) : (
            <div className="py-12 text-center text-neutral-500 bg-black/50 border border-dashed border-white/10 rounded-2xl font-medium tracking-wide">
              No completed matches yet.
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
            <Plus className="w-5 h-5" strokeWidth={3} />
            New Match
          </Link>
        </div>
      )}
    </div>
  );
}
