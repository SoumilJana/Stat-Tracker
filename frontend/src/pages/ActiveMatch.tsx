import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, Undo2, SkipForward, Share2, Check, Copy, CloudOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function ActiveMatch() {
  const { profile } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [pendingGoal, setPendingGoal] = useState<{playerId: string, teamId: string, teamPlayers: any[]} | null>(null);
  const [copied, setCopied] = useState(false);
  const [statsCopied, setStatsCopied] = useState(false);  
  // Engine State
  const [onPitch, setOnPitch] = useState<any[]>([]); // Up to 2 teams
  const [waiting, setWaiting] = useState<any[]>([]); // Any waiting teams
  const [teamScores, setTeamScores] = useState<Record<string, number>>({});
  const [teamPlayers, setTeamPlayers] = useState<Record<string, any[]>>({});
  const [goalAnim, setGoalAnim] = useState<{teamId: string, id: number} | null>(null);
  
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncOfflineEvents = async () => {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem(`offline_events_${id}`) || '[]');
    if (queue.length === 0) return;
    
    setIsSyncing(true);
    let remainingQueue = [...queue];
    
    for (let i = 0; i < queue.length; i++) {
      const action = queue[i];
      let error = null;
      if (action.type === 'INSERT') {
        const { tempId, ...eventData } = action.payload;
        const { error: err } = await supabase.from('events').insert(eventData);
        error = err;
      } else if (action.type === 'DELETE') {
        const { error: err } = await supabase.from('events').delete().eq('id', action.payload);
        error = err;
      }
      
      if (!error) {
        remainingQueue = remainingQueue.filter(a => a.tempId !== action.tempId);
      }
    }
    
    if (remainingQueue.length === 0) {
      localStorage.removeItem(`offline_events_${id}`);
    } else {
      localStorage.setItem(`offline_events_${id}`, JSON.stringify(remainingQueue));
    }
    
    fetchMatchData();
    setIsSyncing(false);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineEvents();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (navigator.onLine) syncOfflineEvents();

    fetchMatchData();
    
    // Set up realtime subscription for events
    const subscription = supabase
      .channel(`public:events:session_id=eq.${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `session_id=eq.${id}` }, (payload) => {
        console.log('Event received', payload);
        fetchMatchData();
      })
      .subscribe();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(subscription);
    };
  }, [id]);

  const fetchMatchData = async () => {
    // Fetch session
    const { data: sData } = await supabase.from('sessions').select('*').eq('id', id).single();
    if (sData) setSession(sData);

    // Fetch teams
    const { data: tData } = await supabase.from('teams').select('*').eq('session_id', id).order('name');
    
    if (tData && tData.length >= 2) {
      // Fetch players
      const { data: tpData } = await supabase
        .from('team_players')
        .select('*, profiles(*)')
        .in('team_id', tData.map(t => t.id));

      const tpMap: Record<string, any[]> = {};
      tData.forEach(t => tpMap[t.id] = []);
      if (tpData) {
        tpData.forEach(tp => {
          if (tpMap[tp.team_id]) tpMap[tp.team_id].push(tp.profiles);
        });
      }
      setTeamPlayers(tpMap);

      // Fetch events
      const { data: eData } = await supabase
        .from('events')
        .select('*, player:profiles!events_player_id_fkey(username), assister:profiles!events_assisted_by_fkey(username)')
        .eq('session_id', id)
        .order('timestamp', { ascending: false });
      
      const offlineQueue = JSON.parse(localStorage.getItem(`offline_events_${id}`) || '[]');
      const offlineInserts = offlineQueue
        .filter((a: any) => a.type === 'INSERT')
        .map((a: any) => {
          const tPlayers = tpMap[a.payload.team_id] || [];
          return {
            ...a.payload,
            id: a.tempId,
            player: { username: tPlayers.find((p: any) => p.id === a.payload.player_id)?.username },
            assister: a.payload.assisted_by ? { username: Object.values(tpMap).flat().find((p: any) => p.id === a.payload.assisted_by)?.username } : null
          };
        });
      
      const deletedIds = offlineQueue.filter((a: any) => a.type === 'DELETE').map((a: any) => a.payload);
      
      let allEvents = (eData || []).filter(e => !deletedIds.includes(e.id));
      allEvents = [...offlineInserts, ...allEvents];
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setEvents(allEvents);

      // --- RUN STATE ENGINE ---
      let currentPitch = [tData[0], tData[1]].filter(Boolean);
      let currentWaiting = tData.slice(2);
      let scores: Record<string, number> = {};
      let timeOnPitch: Record<string, number> = {};
      
      tData.forEach(t => { scores[t.id] = 0; timeOnPitch[t.id] = 1; });
      if (currentWaiting.length > 0) timeOnPitch[currentWaiting[0].id] = 0;

      const sortedEvents = [...allEvents].reverse();

      sortedEvents.forEach(ev => {
        if (ev.event_type === 'GOAL') {
          scores[ev.team_id] = (scores[ev.team_id] || 0) + 1;
          
          if (sData?.mode === 'WINNER_STAYS' && currentWaiting.length > 0) {
            const winner = currentPitch.find(t => t.id === ev.team_id) || currentPitch[0];
            const loser = currentPitch.find(t => t.id !== winner.id) || currentPitch[1];
            
            currentPitch = [winner, currentWaiting[0]];
            currentWaiting = [loser];
            
            timeOnPitch[winner.id] += 1;
            timeOnPitch[currentPitch[1].id] = 1; // new team
            timeOnPitch[loser.id] = 0;
          }
        } else if (ev.event_type === 'NO_GOAL_TIME_UP') {
          if (sData?.mode === 'WINNER_STAYS' && currentWaiting.length > 0) {
            // WINNER STAYS: In a draw, the incumbent (winner of previous match, which is always currentPitch[0]) stays.
            // The challenger (currentPitch[1]) rotates out.
            const winner = currentPitch[0];
            const loser = currentPitch[1];
            
            currentPitch = [winner, currentWaiting[0]];
            currentWaiting = [loser];
            
            timeOnPitch[winner.id] += 1;
            timeOnPitch[currentPitch[1].id] = 1;
            timeOnPitch[loser.id] = 0;
          }
        }
      });

      setOnPitch(currentPitch);
      setWaiting(currentWaiting);
      
      setTeamScores(prev => {
        let newGoalTeam = null;
        if (Object.keys(prev).length > 0) {
          Object.entries(scores).forEach(([tId, score]) => {
            if (prev[tId] !== undefined && score > prev[tId]) {
              newGoalTeam = tId;
            }
          });
        }
        if (newGoalTeam) {
          setGoalAnim({ teamId: newGoalTeam, id: Date.now() });
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
        return scores;
      });
    }
    
    setLoading(false);
  };

  const initiateGoal = (playerId: string, teamId: string, playersList: any[]) => {
    setPendingGoal({ playerId, teamId, teamPlayers: playersList });
  };

  const confirmGoal = async (assistedBy: string | null) => {
    if (!pendingGoal) return;
    
    const eventData = {
      session_id: id,
      event_type: 'GOAL',
      player_id: pendingGoal.playerId,
      team_id: pendingGoal.teamId,
      assisted_by: assistedBy,
      timestamp: new Date().toISOString()
    };
    
    setPendingGoal(null);

    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem(`offline_events_${id}`) || '[]');
      const tempId = `temp_${Date.now()}`;
      queue.push({ type: 'INSERT', tempId, payload: { ...eventData, tempId } });
      localStorage.setItem(`offline_events_${id}`, JSON.stringify(queue));
      fetchMatchData();
      return;
    }
    
    const { error } = await supabase.from('events').insert(eventData);
    if (error) console.error("Error recording goal:", error);
    else fetchMatchData();
  };

  const recordTimeUp = async () => {
    const eventData = {
      session_id: id,
      event_type: 'NO_GOAL_TIME_UP',
      timestamp: new Date().toISOString()
    };
    
    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem(`offline_events_${id}`) || '[]');
      const tempId = `temp_${Date.now()}`;
      queue.push({ type: 'INSERT', tempId, payload: { ...eventData, tempId } });
      localStorage.setItem(`offline_events_${id}`, JSON.stringify(queue));
      fetchMatchData();
      return;
    }

    const { error } = await supabase.from('events').insert(eventData);
    if (error) console.error("Error recording time up:", error);
    else fetchMatchData();
  };

  const undoEvent = async (eventId: string) => {
    if (eventId.toString().startsWith('temp_')) {
      const queue = JSON.parse(localStorage.getItem(`offline_events_${id}`) || '[]');
      const newQueue = queue.filter((a: any) => a.tempId !== eventId);
      localStorage.setItem(`offline_events_${id}`, JSON.stringify(newQueue));
      fetchMatchData();
      return;
    }

    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem(`offline_events_${id}`) || '[]');
      queue.push({ type: 'DELETE', tempId: `temp_del_${Date.now()}`, payload: eventId });
      localStorage.setItem(`offline_events_${id}`, JSON.stringify(queue));
      fetchMatchData();
      return;
    }

    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) console.error("Error undoing event:", error);
    else fetchMatchData();
  };

  const endSession = async () => {
    if (window.confirm("Are you sure you want to end this match day? All recorded goals will be added to the players' total stats permanently.")) {
      await supabase.from('sessions').update({ status: 'COMPLETED' }).eq('id', id);
      navigate('/matches');
    }
  };

  const copyStats = () => {
    if (!session) return;
    let text = `Match Day Stats - ${new Date(session.date).toLocaleDateString()}\n`;
    if (session.location) text += `Location: ${session.location}\n`;
    text += `\n--- Match Day Tally ---\n`;
    
    Object.entries(teamScores).forEach(([tId, score]) => {
      const t = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
      if (t) {
        text += `${t.name.replace('Team ', '')}: ${score}\n`;
      }
    });

    text += `\n--- Player Stats ---\n`;
    Object.entries(teamPlayers).forEach(([tId, players]) => {
      const team = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
      if (!team) return;
      
      let hasStats = false;
      let teamText = `\n${team.name}:\n`;
      players.forEach(player => {
        const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
        const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;
        
        if (pGoals > 0 || pAssists > 0) {
          hasStats = true;
          teamText += `- ${player.username}: `;
          const stats = [];
          if (pGoals > 0) stats.push(`${pGoals} G`);
          if (pAssists > 0) stats.push(`${pAssists} A`);
          teamText += stats.join(', ') + '\n';
        }
      });
      if (hasStats) {
        text += teamText;
      }
    });

    navigator.clipboard.writeText(text);
    setStatsCopied(true);
    setTimeout(() => setStatsCopied(false), 2000);
  };

  if (loading) return <div className="text-primary-500 p-8 flex justify-center"><Activity className="w-8 h-8 animate-spin" /></div>;
  if (!session || onPitch.length < 2) return <div className="text-red-400 p-8 text-center">Match not found or invalid teams.</div>;

  const teamA = onPitch[0];
  const teamB = onPitch[1];
  const teamAPlayersList = teamPlayers[teamA.id] || [];
  const teamBPlayersList = teamPlayers[teamB.id] || [];

  let winnerOfTheDay: any = null;
  let maxScore = -1;
  if (session?.status === 'COMPLETED') {
    Object.entries(teamScores).forEach(([tId, score]) => {
      if (score > maxScore) {
        maxScore = score;
        winnerOfTheDay = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 md:pb-8">
      {/* Offline Indicators */}
      {isOffline && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-6 animate-pulse">
          <CloudOff className="w-5 h-5" />
          Offline Mode. Goals will be saved locally and synced later.
        </div>
      )}
      {isSyncing && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-6">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Syncing offline goals to database...
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link to="/matches" className="text-neutral-400 hover:text-white flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back to Matches</span>
        </Link>
        <div className="flex items-center gap-3">
          <button 
            onClick={copyStats}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 border border-primary-500/20 transition-colors"
            title="Copy Match Stats"
          >
            {statsCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{statsCopied ? 'Copied!' : 'Copy Stats'}</span>
          </button>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary-500" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
            session.status === 'IN_PROGRESS' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 
            session.status === 'SCHEDULED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
            'bg-neutral-800 text-neutral-400 border border-neutral-700'
          }`}>
            {session.status.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Match Day Tallies Header */}
      <div className="flex justify-center mb-6">
        <div className="bg-black border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 text-sm shadow-lg">
          <span className="text-neutral-500 font-bold tracking-widest uppercase">Match Day Tally:</span>
          {Object.entries(teamScores).map(([tId, score]) => {
            const t = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
            return t ? (
              <div key={tId} className="flex items-center gap-1 font-bold">
                <span className={onPitch.find(p => p.id === tId) ? "text-primary-400" : "text-neutral-500"}>{t.name.replace('Team ', '')}</span>
                <span className="text-white">{score}</span>
              </div>
            ) : null;
          })}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="bg-black border border-white/5 rounded-3xl p-6 md:p-10 mb-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-primary-500/5 blur-[100px] rounded-full pointer-events-none" />
        
        {session.status === 'COMPLETED' ? (
          <div className="flex flex-col items-center justify-center relative z-10 py-4">
            <h2 className="text-xl md:text-2xl font-bold text-neutral-400 mb-2 tracking-widest uppercase">Match Day Winner</h2>
            <div className="text-5xl md:text-7xl font-black text-primary-400 tracking-tighter drop-shadow-lg mb-4 uppercase text-center">
              {winnerOfTheDay?.name}
            </div>
            <div className="text-lg text-white font-bold bg-neutral-800 px-6 py-2 rounded-full border border-neutral-700">
              {maxScore} {session.mode === 'WINNER_STAYS' ? 'Wins' : 'Goals'}
            </div>
          </div>
        ) : (
          <div className="flex flex-row items-center justify-between relative z-10 gap-2 md:gap-8">
            {/* Team A Score */}
            <div className="flex flex-col items-center flex-1 w-full overflow-hidden relative">
              <h3 className="text-lg md:text-2xl font-bold text-primary-400 mb-2 truncate max-w-full px-2 text-center tracking-widest uppercase">{teamA?.name}</h3>
              <div className="text-6xl md:text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg relative">
                {teamScores[teamA.id] || 0}
                {goalAnim?.teamId === teamA.id && (
                  <span key={goalAnim?.id} className="absolute -top-4 -right-12 md:-right-16 text-3xl md:text-5xl font-black text-primary-400 animate-float-up pointer-events-none drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] z-50">+1</span>
                )}
              </div>
            </div>
            
            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center px-2 md:px-4 flex-shrink-0">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 shadow-inner">
                <span className="text-neutral-400 font-bold text-xs md:text-sm">VS</span>
              </div>
              {session.location && (
                <span className="mt-4 text-[10px] md:text-xs font-medium text-neutral-500 uppercase tracking-widest text-center hidden sm:block">
                  {session.location}
                </span>
              )}
            </div>
            
            {/* Team B Score */}
            <div className="flex flex-col items-center flex-1 w-full overflow-hidden relative">
              <h3 className="text-lg md:text-2xl font-bold text-blue-400 mb-2 truncate max-w-full px-2 text-center tracking-widest uppercase">{teamB?.name}</h3>
              <div className="text-6xl md:text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg relative">
                {teamScores[teamB.id] || 0}
                {goalAnim?.teamId === teamB.id && (
                  <span key={goalAnim?.id} className="absolute -top-4 -right-12 md:-right-16 text-3xl md:text-5xl font-black text-blue-400 animate-float-up pointer-events-none drop-shadow-[0_0_15px_rgba(96,165,250,0.8)] z-50">+1</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {session.status === 'IN_PROGRESS' && waiting.length > 0 && (
        <div className="flex justify-center mb-8">
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse">
            <Clock className="w-4 h-4" />
            Waiting: {waiting[0]?.name}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Action Area */}
        <div className="lg:col-span-2 space-y-8">
          {session.status === 'COMPLETED' ? (
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 ${Object.keys(teamPlayers).length === 3 ? 'lg:grid-cols-3' : ''}`}>
              {Object.entries(teamPlayers).map(([tId, players]) => {
                const team = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
                if (!team) return null;
                
                return (
                  <div key={tId} className="bg-black border border-white/5 rounded-2xl p-5 shadow-lg shadow-black/50">
                    <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm flex items-center justify-between">
                      <span>{team.name}</span>
                    </h4>
                    <div className="space-y-3">
                      {players.map(player => {
                        const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
                        const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;
                        return (
                          <div
                            key={player.id}
                            className="w-full flex items-center justify-between p-3 md:p-4 bg-neutral-900/50 border border-white/5 rounded-xl shadow-sm"
                          >
                            <span className="text-white font-medium text-left truncate pr-2">{player.username}</span>
                            <div className="flex gap-3">
                              {pGoals > 0 && (
                                <span className="text-primary-400 font-bold flex items-center gap-1">
                                  {pGoals} <span className="text-xs text-neutral-500">G</span>
                                </span>
                              )}
                              {pAssists > 0 && (
                                <span className="text-blue-400 font-bold flex items-center gap-1">
                                  {pAssists} <span className="text-xs text-neutral-500">A</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Team A Players */}
              <div className="bg-black border border-primary-500/20 rounded-2xl p-5 shadow-lg shadow-primary-900/10 relative overflow-hidden">
                <h4 className="text-primary-400 font-bold mb-4 uppercase tracking-wider text-sm flex items-center justify-between">
                  <span>{teamA?.name} Goal</span>
                  <span className="bg-primary-500/20 px-2 py-0.5 rounded text-xs">Active</span>
                </h4>
                <div className="space-y-3 relative z-10">
                  {teamAPlayersList.map(player => (
                    <button
                      key={player.id}
                      disabled={session.status !== 'IN_PROGRESS' || profile?.role !== 'admin'}
                      onClick={() => initiateGoal(player.id, teamA.id, teamAPlayersList)}
                      className={`w-full flex items-center justify-between p-3 md:p-4 bg-neutral-900/50 border border-white/5 rounded-xl transition-all shadow-sm ${session.status === 'IN_PROGRESS' && profile?.role === 'admin' ? 'hover:bg-primary-900/40 hover:border-primary-500/50 group active:scale-95' : 'disabled:opacity-75 disabled:cursor-default'}`}
                    >
                      <span className="text-white font-medium text-left truncate pr-2">{player.username}</span>
                      {profile?.role === 'admin' && session.status === 'IN_PROGRESS' && (
                        <span className="bg-primary-500 text-black text-xs font-bold px-2 py-1 rounded md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                          + GOAL
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team B Players */}
              <div className="bg-black border border-blue-500/20 rounded-2xl p-5 shadow-lg shadow-blue-900/10 relative overflow-hidden">
                <h4 className="text-blue-400 font-bold mb-4 uppercase tracking-wider text-sm flex items-center justify-between">
                  <span>{teamB?.name} Goal</span>
                  <span className="bg-blue-500/20 px-2 py-0.5 rounded text-xs">Active</span>
                </h4>
                <div className="space-y-3 relative z-10">
                  {teamBPlayersList.map(player => (
                    <button
                      key={player.id}
                      disabled={session.status !== 'IN_PROGRESS' || profile?.role !== 'admin'}
                      onClick={() => initiateGoal(player.id, teamB.id, teamBPlayersList)}
                      className={`w-full flex items-center justify-between p-3 md:p-4 bg-neutral-900/50 border border-white/5 rounded-xl transition-all shadow-sm ${session.status === 'IN_PROGRESS' && profile?.role === 'admin' ? 'hover:bg-blue-900/40 hover:border-blue-500/50 group active:scale-95' : 'disabled:opacity-75 disabled:cursor-default'}`}
                    >
                      <span className="text-white font-medium text-left truncate pr-2">{player.username}</span>
                      {profile?.role === 'admin' && session.status === 'IN_PROGRESS' && (
                        <span className="bg-blue-500 text-black text-xs font-bold px-2 py-1 rounded md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                          + GOAL
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {session.status === 'IN_PROGRESS' && profile?.role === 'admin' && (
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-neutral-800">
              {session.mode === 'WINNER_STAYS' && waiting.length > 0 && (
                <button 
                  onClick={recordTimeUp}
                  className="bg-neutral-800 text-white border border-neutral-700 px-6 py-3 rounded-xl font-medium hover:bg-neutral-700 hover:border-neutral-500 transition-colors w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-5 h-5" />
                  No Goal / Time Up
                </button>
              )}
              
              <button 
                onClick={endSession}
                className="bg-red-500/10 text-red-400 border border-red-500/30 px-8 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-colors w-full sm:w-auto sm:ml-auto"
              >
                END MATCH DAY
              </button>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-black border border-white/5 rounded-3xl flex flex-col h-[400px] lg:h-[600px] shadow-xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <Clock className="w-5 h-5 text-neutral-400" />
            <h3 className="font-bold text-white tracking-widest uppercase">Match Events</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-2">
                <Activity className="w-8 h-8 opacity-20" />
                <p className="text-sm font-medium tracking-wide">No events recorded yet.</p>
              </div>
            ) : (
              events.map((event, idx) => (
                <div key={event.id} className="flex items-start justify-between group p-3 hover:bg-white/5 rounded-2xl transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-1">
                      {event.event_type === 'GOAL' && (
                        <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)] ${event.team_id === teamA?.id ? 'bg-primary-500 shadow-primary-500/50' : event.team_id === teamB?.id ? 'bg-blue-500 shadow-blue-500/50' : 'bg-white'}`} />
                      )}
                      {event.event_type === 'NO_GOAL_TIME_UP' && (
                        <SkipForward className="w-3 h-3 text-neutral-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white">
                        {event.event_type === 'GOAL' ? (
                          <><span className="font-bold">{event.player?.username || event.profiles?.username}</span> scored for <span className="font-medium text-neutral-400">{Object.values(onPitch).concat(waiting).find(t => t.id === event.team_id)?.name}</span>
                          {event.assister?.username && <span className="text-neutral-500 ml-1">(Ast: {event.assister.username})</span>}</>
                        ) : event.event_type === 'NO_GOAL_TIME_UP' ? (
                          <span className="italic text-neutral-400">Time up / No goals (Teams rotated)</span>
                        ) : (
                          <span className="italic text-neutral-400">Match ended</span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {idx === 0 && session.status === 'IN_PROGRESS' && profile?.role === 'admin' && (
                    <button 
                      onClick={() => undoEvent(event.id)}
                      className="text-neutral-500 hover:text-red-400 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      title="Undo Event"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* Pending Goal / Assist Modal */}
      {pendingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-bold text-white mb-2 text-center">Who assisted?</h3>
            <p className="text-neutral-400 text-sm mb-6 text-center">
              Goal by {pendingGoal.teamPlayers.find(p => p.id === pendingGoal.playerId)?.username}
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => confirmGoal(null)}
                className="w-full py-4 px-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl border border-white/5 transition-colors"
              >
                No Assist
              </button>
              
              {pendingGoal.teamPlayers
                .filter(p => p.id !== pendingGoal.playerId)
                .map(player => (
                  <button
                    key={player.id}
                    onClick={() => confirmGoal(player.id)}
                    className="w-full py-4 px-4 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 font-bold rounded-xl border border-primary-500/20 transition-colors"
                  >
                    {player.username}
                  </button>
                ))
              }
            </div>

            <button
              onClick={() => setPendingGoal(null)}
              className="mt-6 w-full py-3 text-neutral-500 hover:text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
