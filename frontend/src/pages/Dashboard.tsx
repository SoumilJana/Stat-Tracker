import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NotificationsSetup from '../components/NotificationsSetup';
import AnkitaDashboard from '../components/AnkitaDashboard';

import { useAuth } from '../contexts/AuthContext';
import { buildSeasons, getCurrentSeason } from '../lib/seasons';

import { useQuery } from '@tanstack/react-query';

function DashboardSkeleton() {
  return (
    <div className="space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-9 w-48 bg-neutral-800/70 rounded-2xl skeleton-shimmer" />
          <div className="h-4 w-36 bg-neutral-800/40 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-10 w-24 bg-neutral-800/50 rounded-xl skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#051410]/60 border border-emerald-500/10 rounded-3xl p-6 sm:p-8 h-52 flex flex-col justify-between skeleton-shimmer">
          <div className="h-3 w-28 bg-emerald-900/40 rounded" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 bg-neutral-800/30 rounded-2xl" />
            <div className="h-16 bg-neutral-800/30 rounded-2xl" />
            <div className="h-16 bg-neutral-800/30 rounded-2xl" />
          </div>
        </div>
        <div className="bg-[#051410]/60 border border-emerald-500/10 rounded-3xl p-6 sm:p-8 h-52 flex flex-col justify-between skeleton-shimmer">
          <div className="h-3 w-28 bg-emerald-900/40 rounded" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 bg-neutral-800/30 rounded-2xl" />
            <div className="h-16 bg-neutral-800/30 rounded-2xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-44 bg-neutral-900/60 border border-white/5 rounded-3xl p-6 skeleton-shimmer" />
        <div className="h-44 bg-neutral-900/60 border border-white/5 rounded-3xl p-6 skeleton-shimmer" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();

  const seasons = React.useMemo(() => buildSeasons(), []);
  const currentSeason = getCurrentSeason(seasons);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', currentSeason.startDate, currentSeason.endDate],
    queryFn: async () => {
      const [
        { count: goalCount },
        { count: matchCount },
        { count: sGoalCount },
        { count: sMatchCount },
        { data: completed },
        { data: upcoming }
      ] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('event_type', 'GOAL'),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('event_type', 'GOAL').gte('timestamp', currentSeason.startDate).lt('timestamp', currentSeason.endDate),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'COMPLETED').gte('date', currentSeason.startDate).lt('date', currentSeason.endDate),
        supabase.from('sessions').select(`id, date, status, mode, location, teams ( id, name ), events ( team_id, event_type )`).eq('status', 'COMPLETED').order('date', { ascending: false }).limit(1),
        supabase.from('sessions').select(`id, date, status, mode, location, teams ( id, name ), events ( team_id, event_type )`).in('status', ['SCHEDULED', 'IN_PROGRESS']).order('date', { ascending: false }).limit(1)
      ]);

      return {
        totalGoals: goalCount || 0,
        totalMatches: matchCount || 0,
        seasonGoals: sGoalCount || 0,
        seasonMatches: sMatchCount || 0,
        completedMatch: completed && completed.length > 0 ? completed[0] : null,
        upcomingMatch: upcoming && upcoming.length > 0 ? upcoming[0] : null
      };
    }
  });

  if (isLoading || !data) return <DashboardSkeleton />;

  const isAnkita = profile?.username?.toLowerCase() === 'ankita' || profile?.full_name?.toLowerCase() === 'ankita' || profile?.name?.toLowerCase() === 'ankita';

  if (isAnkita) {
    return <AnkitaDashboard />;
  }

  const { totalGoals, totalMatches, seasonGoals, seasonMatches, completedMatch, upcomingMatch } = data;

  return (
    <div className="space-y-6 sm:space-y-8 pb-32 sm:pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black leading-tight text-white tracking-tight mb-1">Welcome <span className="text-emerald-400">back!</span></h2>
          <p className="text-xs sm:text-sm text-neutral-400">Here's the latest from the pitch.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/rules" className="bg-[#051410] hover:bg-emerald-900/20 active:scale-95 text-emerald-400 p-2 sm:px-3 sm:py-2 rounded-xl border border-emerald-500/20 transition-all shadow-sm hidden sm:flex items-center gap-2" title="Rules & Guidelines">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span className="text-sm font-bold">Rules</span>
          </Link>
          <Link to="/rules" className="bg-[#051410] hover:bg-emerald-900/20 active:scale-95 text-emerald-400 p-2 rounded-xl border border-emerald-500/20 transition-all shadow-sm sm:hidden" title="Rules & Guidelines">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </Link>
          <NotificationsSetup />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Sleek Global Stats Strip */}
        <div className="bg-[#051410] border border-emerald-500/20 rounded-3xl p-5 sm:p-8 relative overflow-hidden group hover:border-emerald-500/35 transition-all duration-300">
          {/* Decorative background gradient */}
          <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-emerald-900/10 to-transparent z-0 pointer-events-none" />
          
          {/* Subtle geometric shape */}
          <div className="absolute -right-20 -top-20 w-64 h-64 border-[40px] border-emerald-500/5 rounded-full z-0 pointer-events-none" />

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6 sm:mb-8">
              <div>
                <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1">{currentSeason.label.toUpperCase()}</h3>
              </div>
              <Link to="/seasons" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors active:scale-95">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex flex-row items-center justify-between sm:justify-around text-center">
              <div className="flex flex-col items-center flex-1">
                <div className="mb-2 sm:mb-3 text-emerald-400">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 16v-2.5C4 12 5.5 11 7 11h2l2-3h3l2.5 3H19a2 2 0 0 1 2 2v1c0 1.5-1 2-2 2H6c-1.5 0-2-.5-2-2z" />
                    <path d="M6 16v2" />
                    <path d="M10 16v2" />
                    <path d="M14 16v2" />
                    <path d="M18 16v2" />
                  </svg>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white mb-1 tabular-nums">{seasonMatches}</div>
                <div className="text-[11px] sm:text-xs text-neutral-400">Matches</div>
              </div>
              
              <div className="w-px h-14 sm:h-16 bg-white/[0.06]" />
              
              <div className="flex flex-col items-center flex-1">
                <div className="mb-2 sm:mb-3 text-emerald-400">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="12 6 15.5 8.5 14 12.5 10 12.5 8.5 8.5 12 6" />
                    <path d="M12 6V2" />
                    <path d="M15.5 8.5l4-2" />
                    <path d="M14 12.5l2 4" />
                    <path d="M10 12.5l-2 4" />
                    <path d="M8.5 8.5l-4-2" />
                  </svg>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white mb-1 tabular-nums">{seasonGoals}</div>
                <div className="text-[11px] sm:text-xs text-neutral-400">Goals</div>
              </div>
              
              <div className="w-px h-14 sm:h-16 bg-white/[0.06]" />

              <div className="flex flex-col items-center flex-1">
                <div className="mb-2 sm:mb-3 text-emerald-400">
                  <Users className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white mb-1 tabular-nums">
                  {seasonMatches > 0 ? (seasonGoals / seasonMatches).toFixed(1) : '0.0'}
                </div>
                <div className="text-[11px] sm:text-xs text-neutral-400 text-center leading-tight">Avg Goals<br/>per Match</div>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="bg-[#051410] border border-emerald-500/20 rounded-3xl p-5 sm:p-8 relative overflow-hidden group hover:border-emerald-500/35 transition-all duration-300">
          <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-emerald-900/10 to-transparent z-0 pointer-events-none" />
          <div className="absolute -right-20 -top-20 w-64 h-64 border-[40px] border-emerald-500/5 rounded-full z-0 pointer-events-none" />

          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6 sm:mb-8">
              <div>
                <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1">OVERALL STATS</h3>
              </div>
            </div>

            <div className="flex flex-row items-center justify-around text-center">
              <div className="flex flex-col items-center flex-1">
                <div className="mb-2 sm:mb-3 text-emerald-400">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 16v-2.5C4 12 5.5 11 7 11h2l2-3h3l2.5 3H19a2 2 0 0 1 2 2v1c0 1.5-1 2-2 2H6c-1.5 0-2-.5-2-2z" />
                    <path d="M6 16v2" />
                    <path d="M10 16v2" />
                    <path d="M14 16v2" />
                    <path d="M18 16v2" />
                  </svg>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white mb-1 tabular-nums">{totalMatches}</div>
                <div className="text-[11px] sm:text-xs text-neutral-400 text-center leading-tight">Total Matches<br/>Played</div>
              </div>
              
              <div className="w-px h-14 sm:h-16 bg-white/[0.06]" />
              
              <div className="flex flex-col items-center flex-1">
                <div className="mb-2 sm:mb-3 text-emerald-400">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="12 6 15.5 8.5 14 12.5 10 12.5 8.5 8.5 12 6" />
                    <path d="M12 6V2" />
                    <path d="M15.5 8.5l4-2" />
                    <path d="M14 12.5l2 4" />
                    <path d="M10 12.5l-2 4" />
                    <path d="M8.5 8.5l-4-2" />
                  </svg>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white mb-1 tabular-nums">{totalGoals}</div>
                <div className="text-[11px] sm:text-xs text-neutral-400 text-center leading-tight">Total Goals<br/>Scored</div>
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
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-auto md:mt-12 left-0 right-0 px-4 md:relative md:bg-transparent md:border-0 md:p-0 z-40 flex justify-center pointer-events-none">
          <Link 
            to="/matches/new"
            className="pointer-events-auto flex items-center justify-center gap-2.5 w-full sm:w-auto bg-emerald-500 text-black px-7 py-3 sm:py-3.5 rounded-full font-black hover:bg-emerald-400 active:scale-95 transition-all shadow-[0_8px_25px_rgba(16,185,129,0.35)] tracking-widest uppercase text-xs sm:text-sm select-none"
          >
            <Plus className="w-5 h-5" strokeWidth={3} />
            New Match
          </Link>
        </div>
      )}
    </div>
  );
}
