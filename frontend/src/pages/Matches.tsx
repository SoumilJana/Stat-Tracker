import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar as CalendarIcon, MapPin, PlayCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function MatchesSkeleton() {
  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-neutral-800/70 rounded-xl skeleton-shimmer" />
          <div className="h-4 w-48 bg-neutral-800/40 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-10 w-28 bg-neutral-800/50 rounded-full skeleton-shimmer" />
      </div>

      <div className="space-y-4">
        <div className="h-5 w-28 bg-neutral-800/60 rounded skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-neutral-900/60 border border-white/5 rounded-2xl p-6 flex flex-col justify-between skeleton-shimmer">
              <div className="flex justify-between items-center">
                <div className="h-5 w-20 bg-neutral-800/60 rounded-full" />
                <div className="h-5 w-24 bg-neutral-800/40 rounded-full" />
              </div>
              <div className="h-10 w-32 mx-auto bg-neutral-800/50 rounded-xl" />
              <div className="h-4 w-full bg-neutral-800/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Matches() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingMatchId, setStartingMatchId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('sessions')
      .select(`
        id, date, location, mode, status,
        teams ( id, name ),
        events ( team_id, event_type )
      `)
      .order('date', { ascending: false });
    
    if (data) setSessions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const deleteMatch = async (e: any, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this match completely? This cannot be undone.")) return;
    
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== id));
    } else {
      alert(error.message);
    }
  };

  const startMatch = async (e: any, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (startingMatchId === id) return;
    
    setStartingMatchId(id);
    try {
      const { error } = await supabase.from('sessions').update({ status: 'IN_PROGRESS' }).eq('id', id);
      if (error) {
        alert("Failed to start match: " + error.message);
        setStartingMatchId(null);
        return;
      }
      navigate(`/matches/${id}`);
    } catch (err: any) {
      alert("Error starting match: " + err.message);
      setStartingMatchId(null);
    }
  };

  if (loading) return <MatchesSkeleton />;

  const upcomingSessions = sessions.filter(s => s.status !== 'COMPLETED');
  const completedSessions = sessions.filter(s => s.status === 'COMPLETED');

  const renderSessionCard = (session: any) => {
    // Calculate Scores for COMPLETED matches
    const teamScores: Record<string, number> = {};
    if (session.teams) {
      session.teams.forEach((t: any) => teamScores[t.id] = 0);
    }
    if (session.events) {
      session.events.forEach((ev: any) => {
        if (ev.event_type === 'GOAL' && teamScores[ev.team_id] !== undefined) {
          teamScores[ev.team_id] += 1;
        }
      });
    }

    // Sort teams A, B, C for consistent display
    const sortedTeams = session.teams?.sort((a: any, b: any) => a.name.localeCompare(b.name)) || [];
    const teamNames = sortedTeams.map((t: any) => t.name.replace('Team ', ''));
    const scores = sortedTeams.map((t: any) => teamScores[t.id]);

    return (
      <div 
        key={session.id} 
        onClick={() => navigate(`/matches/${session.id}`)} 
        className="bg-neutral-900/90 border border-white/5 rounded-2xl p-5 sm:p-6 hover:border-primary-500/35 hover:shadow-[0_4px_24px_rgba(16,185,129,0.12)] shadow-lg transition-all duration-200 block group relative cursor-pointer active:scale-[0.99]"
      >
        <div className="flex justify-between items-start mb-6">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center ${
            session.status === 'IN_PROGRESS' ? 'bg-primary-500/15 text-primary-400 border border-primary-500/30' : 
            session.status === 'SCHEDULED' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
            'bg-neutral-800 text-neutral-300 border border-neutral-700/60'
          }`}>
            {session.status === 'IN_PROGRESS' && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse mr-1.5 inline-block" />
            )}
            {session.status === 'SCHEDULED' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 inline-block" />
            )}
            {session.status.replace('_', ' ')}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5 bg-neutral-800/80 border border-neutral-700/50 px-2.5 py-1 rounded-full">
            <CalendarIcon className="w-3 h-3 text-neutral-400" />
            {new Date(session.date).toLocaleDateString()}
          </span>
        </div>
        
        <div className="flex justify-center items-center text-lg font-bold text-white mb-2 h-16">
          {session.status === 'COMPLETED' ? (
            <div className="flex flex-col items-center">
              <div className="text-neutral-400 text-[10px] uppercase font-bold tracking-[0.2em] mb-1.5">{teamNames.join(' vs ')}</div>
              <div className="text-4xl text-primary-400 tracking-widest font-black drop-shadow-md">{scores.join(' - ')}</div>
            </div>
          ) : (
            <div className="flex items-center w-full justify-between">
              {sortedTeams.length > 0 ? (
                sortedTeams.map((team: any, index: number) => {
                  const colors = ['text-primary-400', 'text-blue-400', 'text-orange-400', 'text-purple-400', 'text-pink-400', 'text-yellow-400'];
                  const colorClass = colors[index % colors.length];
                  return (
                    <React.Fragment key={team.id || index}>
                      {index > 0 && (
                        <span className="text-neutral-700 px-2 sm:px-4 text-xs sm:text-sm font-black italic">VS</span>
                      )}
                      <span className={`truncate flex-1 text-center text-xl font-black ${colorClass}`}>
                        {team.name.replace('Team ', '')}
                      </span>
                    </React.Fragment>
                  );
                })
              ) : (
                <>
                  <span className="truncate flex-1 text-center text-primary-400 text-xl font-black">A</span>
                  <span className="text-neutral-700 px-4 text-sm font-black italic">VS</span>
                  <span className="truncate flex-1 text-center text-blue-400 text-xl font-black">B</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5 text-sm text-neutral-400">
          <span className="flex items-center gap-1.5 truncate max-w-[50%] text-[11px] font-bold uppercase tracking-wider">
            {session.location ? (
              <><MapPin className="w-3.5 h-3.5 flex-shrink-0 text-neutral-500" /> <span className="truncate">{session.location}</span></>
            ) : (
              <span className="text-neutral-600 italic">No location</span>
            )}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {profile?.role === 'admin' && (
              <>
                <button 
                  onClick={(e) => deleteMatch(e, session.id)} 
                  className="text-neutral-500 hover:text-red-400 active:scale-90 transition-all p-1.5 rounded-lg hover:bg-neutral-800" 
                  title="Delete Match"
                  aria-label="Delete Match"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {session.status === 'SCHEDULED' && (
                  <button 
                    onClick={(e) => startMatch(e, session.id)} 
                    disabled={startingMatchId === session.id}
                    className="text-primary-400 flex items-center gap-1.5 font-bold hover:text-primary-300 active:scale-95 text-xs tracking-wider uppercase px-2 py-1 rounded-lg hover:bg-primary-950/40 border border-primary-500/20 transition-all disabled:opacity-50"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {startingMatchId === session.id ? 'Starting...' : 'Start'}
                  </button>
                )}
              </>
            )}
            {session.status === 'IN_PROGRESS' && (
              <span className="text-primary-400 flex items-center gap-1.5 font-bold group-hover:translate-x-0.5 transition-transform text-xs tracking-wider uppercase">
                <PlayCircle className="w-4 h-4" />
                Resume
              </span>
            )}
            {session.status === 'COMPLETED' && (
              <span className="text-neutral-400 flex items-center gap-1.5 font-bold group-hover:text-white transition-colors text-xs tracking-wider uppercase">
                Details
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">Matches</h2>
          <p className="mt-1 text-sm text-neutral-400">Manage your tournament sessions</p>
        </div>
        {profile?.role === 'admin' && (
          <Link
            to="/matches/new"
            className="flex items-center gap-2 bg-primary-500 text-black px-5 py-2.5 rounded-full font-bold hover:bg-primary-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">New Match</span>
          </Link>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="py-24 text-center text-neutral-500 bg-black/50 border border-dashed border-white/10 rounded-3xl">
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-black border border-white/5 shadow-xl rounded-full flex items-center justify-center mb-6">
              <PlayCircle className="w-10 h-10 text-neutral-700" />
            </div>
            <p className="text-lg font-bold tracking-widest text-neutral-400 uppercase">No matches recorded yet</p>
            <p className="text-sm mt-2">Schedule your first match to get started.</p>
            {profile?.role === 'admin' && (
              <Link to="/matches/new" className="mt-8 text-primary-500 font-bold hover:text-primary-400 transition-colors tracking-widest uppercase text-sm border border-primary-500/20 px-6 py-2 rounded-full hover:bg-primary-500/10">
                + Create Match
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {upcomingSessions.length > 0 && (
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white uppercase tracking-wider">Upcoming</h3>
                <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest font-bold">Scheduled matches & active sessions</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingSessions.map(renderSessionCard)}
              </div>
            </div>
          )}

          {completedSessions.length > 0 && (
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white uppercase tracking-wider">Completed</h3>
                <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest font-bold">Match history</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedSessions.map(renderSessionCard)}
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
