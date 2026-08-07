import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar as CalendarIcon, MapPin, PlayCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Matches() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    await supabase.from('sessions').update({ status: 'IN_PROGRESS' }).eq('id', id);
    navigate(`/matches/${id}`);
  };

  if (loading) return <div className="text-primary-500">Loading matches...</div>;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">Matches</h2>
          <p className="mt-1 text-sm text-neutral-400">Match history and active sessions</p>
        </div>
        {profile?.role === 'admin' && (
          <Link
            to="/matches/new"
            className="flex items-center gap-2 bg-primary-500 text-black px-4 py-2 rounded-xl font-bold hover:bg-primary-600 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">New Match</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map(session => {
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
            <Link key={session.id} to={`/matches/${session.id}`} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-primary-500/50 transition-colors block group relative">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  session.status === 'IN_PROGRESS' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 
                  session.status === 'SCHEDULED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}>
                  {session.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-neutral-500 flex items-center gap-1 font-medium bg-neutral-950 px-2 py-1 rounded-md">
                  <CalendarIcon className="w-3 h-3" />
                  {new Date(session.date).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex justify-center items-center text-lg font-bold text-white mb-2 h-16">
                {session.status === 'COMPLETED' ? (
                  <div className="flex flex-col items-center">
                    <div className="text-neutral-500 text-sm mb-1 tracking-widest">{teamNames.join(' | ')}</div>
                    <div className="text-2xl text-primary-500 tracking-widest font-black">{scores.join(' | ')}</div>
                  </div>
                ) : (
                  <div className="flex items-center w-full justify-between">
                    <span className="truncate flex-1 text-center text-primary-400">{sortedTeams[0]?.name.replace('Team ', '') || 'A'}</span>
                    <span className="text-neutral-700 px-2 text-sm font-normal">v</span>
                    <span className="truncate flex-1 text-center text-blue-400">{sortedTeams[1]?.name.replace('Team ', '') || 'B'}</span>
                    {session.mode === 'WINNER_STAYS' && (
                      <>
                        <span className="text-neutral-700 px-2 text-sm font-normal">v</span>
                        <span className="truncate flex-1 text-center text-orange-400">{sortedTeams[2]?.name.replace('Team ', '') || 'C'}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800 text-sm text-neutral-400">
                <span className="flex items-center gap-1 truncate max-w-[50%]">
                  {session.location ? (
                    <><MapPin className="w-4 h-4 flex-shrink-0 text-neutral-500" /> <span className="truncate">{session.location}</span></>
                  ) : (
                    <span className="text-neutral-600 italic">No location</span>
                  )}
                </span>
                <div className="flex items-center gap-4">
                  {profile?.role === 'admin' && (
                    <>
                      <button onClick={(e) => deleteMatch(e, session.id)} className="text-neutral-600 hover:text-red-500 transition-colors p-1" title="Delete Match">
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {session.status === 'SCHEDULED' && (
                        <button onClick={(e) => startMatch(e, session.id)} className="text-primary-400 flex items-center gap-1 font-bold hover:text-primary-300">
                          <PlayCircle className="w-4 h-4" />
                          Start
                        </button>
                      )}
                    </>
                  )}
                  {session.status === 'IN_PROGRESS' && (
                    <span className="text-primary-400 flex items-center gap-1 font-bold group-hover:translate-x-1 transition-transform">
                      <PlayCircle className="w-4 h-4" />
                      Resume
                    </span>
                  )}
                  {session.status === 'COMPLETED' && (
                    <span className="text-neutral-500 flex items-center gap-1 font-medium group-hover:text-white transition-colors">
                      Details
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
        {sessions.length === 0 && (
          <div className="col-span-full py-20 text-center text-neutral-500 bg-neutral-900 border border-dashed border-neutral-800 rounded-xl">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-neutral-950 rounded-full flex items-center justify-center mb-4">
                <PlayCircle className="w-8 h-8 text-neutral-700" />
              </div>
              <p className="text-lg font-medium text-neutral-400">No matches recorded yet</p>
              <p className="text-sm mt-1">Schedule your first match to get started.</p>
              {profile?.role === 'admin' && (
                <Link to="/matches/new" className="mt-6 text-primary-500 font-bold hover:text-primary-400 transition-colors">
                  + Create Match
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
