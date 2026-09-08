import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NotificationsSetup from '../components/NotificationsSetup';

import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { profile } = useAuth();
  const [totalGoals, setTotalGoals] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [upcomingMatch, setUpcomingMatch] = useState<any>(null);
  const [completedMatch, setCompletedMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
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

  if (loading) return <div className="text-emerald-500">Loading dashboard...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black leading-7 text-white sm:text-4xl sm:truncate mb-2">Welcome <span className="text-emerald-400">back!</span></h2>
          <p className="mt-1 text-sm text-neutral-400">Here's the latest from the pitch.</p>
        </div>
        <NotificationsSetup />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sleek Global Stats Strip - Updated to match the design */}
        <div className="bg-[#051410] border border-emerald-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden group">
          {/* Decorative background gradient */}
          <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-emerald-900/10 to-transparent z-0 pointer-events-none" />
          
          {/* Subtle geometric shape instead of heavy image */}
          <div className="absolute -right-20 -top-20 w-64 h-64 border-[40px] border-emerald-500/5 rounded-full z-0 pointer-events-none" />

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1">SEASON 1 (AUGUST)</h3>
              </div>
              <Link to="/seasons" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex flex-row items-center justify-between sm:justify-around text-center">
              <div className="flex flex-col items-center flex-1">
                <div className="mb-3 text-emerald-400">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 16v-2.5C4 12 5.5 11 7 11h2l2-3h3l2.5 3H19a2 2 0 0 1 2 2v1c0 1.5-1 2-2 2H6c-1.5 0-2-.5-2-2z" />
                    <path d="M6 16v2" />
                    <path d="M10 16v2" />
                    <path d="M14 16v2" />
                    <path d="M18 16v2" />
                  </svg>
                </div>
                <div className="text-4xl font-black text-white mb-1">{totalMatches}</div>
                <div className="text-xs text-neutral-400">Matches</div>
              </div>
              
              <div className="w-px h-16 bg-white/[0.05]" />
              
              <div className="flex flex-col items-center flex-1">
                <div className="mb-3 text-emerald-400">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="12 6 15.5 8.5 14 12.5 10 12.5 8.5 8.5 12 6" />
                    <path d="M12 6V2" />
                    <path d="M15.5 8.5l4-2" />
                    <path d="M14 12.5l2 4" />
                    <path d="M10 12.5l-2 4" />
                    <path d="M8.5 8.5l-4-2" />
                  </svg>
                </div>
                <div className="text-4xl font-black text-white mb-1">{totalGoals}</div>
                <div className="text-xs text-neutral-400">Goals</div>
              </div>
              
              <div className="w-px h-16 bg-white/[0.05]" />

              <div className="flex flex-col items-center flex-1">
                <div className="mb-3 text-emerald-400">
                  <Users className="w-8 h-8" strokeWidth={1.5} />
                </div>
                <div className="text-4xl font-black text-white mb-1">
                  {totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0.0'}
                </div>
                <div className="text-xs text-neutral-400 text-center leading-tight">Avg Goals<br/>per Match</div>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="bg-[#051410] border border-emerald-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-emerald-900/10 to-transparent z-0 pointer-events-none" />
          <div className="absolute -right-20 -top-20 w-64 h-64 border-[40px] border-emerald-500/5 rounded-full z-0 pointer-events-none" />

          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1">OVERALL STATS</h3>
              </div>
            </div>

            <div className="flex flex-row items-center justify-around text-center">
              <div className="flex flex-col items-center flex-1">
                <div className="mb-3 text-emerald-400">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 16v-2.5C4 12 5.5 11 7 11h2l2-3h3l2.5 3H19a2 2 0 0 1 2 2v1c0 1.5-1 2-2 2H6c-1.5 0-2-.5-2-2z" />
                    <path d="M6 16v2" />
                    <path d="M10 16v2" />
                    <path d="M14 16v2" />
                    <path d="M18 16v2" />
                  </svg>
                </div>
                <div className="text-4xl font-black text-white mb-1">{totalMatches}</div>
                <div className="text-xs text-neutral-400 text-center leading-tight">Total Matches<br/>Played</div>
              </div>
              
              <div className="w-px h-16 bg-white/[0.05]" />
              
              <div className="flex flex-col items-center flex-1">
                <div className="mb-3 text-emerald-400">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="12 6 15.5 8.5 14 12.5 10 12.5 8.5 8.5 12 6" />
                    <path d="M12 6V2" />
                    <path d="M15.5 8.5l4-2" />
                    <path d="M14 12.5l2 4" />
                    <path d="M10 12.5l-2 4" />
                    <path d="M8.5 8.5l-4-2" />
                  </svg>
                </div>
                <div className="text-4xl font-black text-white mb-1">{totalGoals}</div>
                <div className="text-xs text-neutral-400 text-center leading-tight">Total Goals<br/>Scored</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Matches Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Upcoming Match */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Upcoming</h3>
            <Link to="/matches" className="text-sm font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {upcomingMatch ? (
            <Link key={upcomingMatch.id} to={`/matches/${upcomingMatch.id}`} className="bg-[#051410] border border-emerald-500/20 rounded-3xl p-6 hover:bg-[#071c17] hover:border-emerald-500/30 transition-all duration-300 block group relative overflow-hidden">
              <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-emerald-900/10 to-transparent z-0 pointer-events-none" />
              <div className="absolute -right-20 -top-20 w-64 h-64 border-[40px] border-emerald-500/5 rounded-full z-0 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] ${
                    upcomingMatch.status === 'IN_PROGRESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
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
                        {sortedTeams.length > 0 ? (
                          sortedTeams.map((team: any, index: number) => {
                            const colors = ['text-emerald-400', 'text-blue-400', 'text-orange-400', 'text-purple-400', 'text-pink-400', 'text-yellow-400'];
                            const colorClass = colors[index % colors.length];
                            return (
                              <React.Fragment key={team.id || index}>
                                {index > 0 && (
                                  <span className="text-neutral-700 px-2 sm:px-4 text-xs sm:text-sm font-black italic">VS</span>
                                )}
                                <span className={`truncate flex-1 text-center text-xl ${colorClass}`}>
                                  {team.name.replace('Team ', '')}
                                </span>
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <>
                            <span className="truncate flex-1 text-center text-emerald-400 text-xl">A</span>
                            <span className="text-neutral-700 px-4 text-sm font-black italic">VS</span>
                            <span className="truncate flex-1 text-center text-blue-400 text-xl">B</span>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
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
            <Link to="/matches" className="text-sm font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              History <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {completedMatch ? (
            <Link key={completedMatch.id} to={`/matches/${completedMatch.id}`} className="bg-[#051410] border border-emerald-500/20 rounded-3xl p-6 hover:bg-[#071c17] hover:border-emerald-500/30 transition-all duration-300 block group relative overflow-hidden">
              <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-emerald-900/10 to-transparent z-0 pointer-events-none" />
              <div className="absolute -right-20 -top-20 w-64 h-64 border-[40px] border-emerald-500/5 rounded-full z-0 pointer-events-none" />
              <div className="relative z-10">
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
                        <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-[0.2em] mb-2">{teamNames.join(' vs ')}</div>
                        <div className="text-4xl text-emerald-500 tracking-widest font-black drop-shadow-md">{scores.join(' - ')}</div>
                      </>
                    );
                  })()}
                </div>
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
            className="flex items-center justify-center gap-3 w-full md:w-auto bg-emerald-500 text-black px-8 py-4 rounded-full font-black hover:bg-emerald-400 hover:scale-105 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] tracking-widest uppercase text-sm"
          >
            <Plus className="w-5 h-5" strokeWidth={3} />
            New Match
          </Link>
        </div>
      )}
    </div>
  );
}
