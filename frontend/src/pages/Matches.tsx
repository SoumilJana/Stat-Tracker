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
    await supabase.from('sessions').update({ status: 'IN_PROGRESS' }).eq('id', id);
    navigate(`/matches/${id}`);
  };

  if (loading) return <div className="text-primary-500">Loading matches...</div>;

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
      <Link key={session.id} to={`/matches/${session.id}`} className="bg-black border border-white/5 rounded-2xl p-6 hover:border-primary-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] shadow-xl transition-all duration-300 block group relative">
        <div className="flex justify-between items-start mb-6">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
            session.status === 'IN_PROGRESS' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 
            session.status === 'SCHEDULED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
            'bg-white/5 text-neutral-400 border border-white/10'
          }`}>
            {session.status.replace('_', ' ')}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1 rounded-full">
            <CalendarIcon className="w-3 h-3" />
            {new Date(session.date).toLocaleDateString()}
          </span>
        </div>
        
        <div className="flex justify-center items-center text-lg font-bold text-white mb-2 h-16">
          {session.status === 'COMPLETED' ? (
            <div className="flex flex-col items-center">
              <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-[0.2em] mb-2">{teamNames.join(' | ')}</div>
              <div className="text-4xl text-primary-500 tracking-widest font-black drop-shadow-md">{scores.join(' - ')}</div>
            </div>
          ) : (
            <div className="flex items-center w-full justify-between">
              <span className="truncate flex-1 text-center text-primary-400 text-xl">{sortedTeams[0]?.name.replace('Team ', '') || 'A'}</span>
              <span className="text-neutral-700 px-4 text-sm font-black italic">VS</span>
              <span className="truncate flex-1 text-center text-blue-400 text-xl">{sortedTeams[1]?.name.replace('Team ', '') || 'B'}</span>
              {session.mode === 'WINNER_STAYS' && (
                <>
                  <span className="text-neutral-700 px-4 text-sm font-black italic">VS</span>
                  <span className="truncate flex-1 text-center text-orange-400 text-xl">{sortedTeams[2]?.name.replace('Team ', '') || 'C'}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/5 text-sm text-neutral-400">
          <span className="flex items-center gap-1.5 truncate max-w-[50%] text-[11px] font-bold uppercase tracking-wider">
            {session.location ? (
              <><MapPin className="w-3.5 h-3.5 flex-shrink-0 text-neutral-500" /> <span className="truncate">{session.location}</span></>
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
                  <button onClick={(e) => startMatch(e, session.id)} className="text-primary-400 flex items-center gap-1.5 font-bold hover:text-primary-300 text-xs tracking-wider uppercase">
                    <PlayCircle className="w-4 h-4" />
                    Start
                  </button>
                )}
              </>
            )}
            {session.status === 'IN_PROGRESS' && (
              <span className="text-primary-400 flex items-center gap-1.5 font-bold group-hover:translate-x-1 transition-transform text-xs tracking-wider uppercase">
                <PlayCircle className="w-4 h-4" />
                Resume
              </span>
            )}
            {session.status === 'COMPLETED' && (
              <span className="text-neutral-500 flex items-center gap-1.5 font-bold group-hover:text-white transition-colors text-xs tracking-wider uppercase">
                Details
              </span>
            )}
          </div>
        </div>
      </Link>
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
