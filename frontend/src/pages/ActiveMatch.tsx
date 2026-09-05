import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, Undo2, SkipForward, Share2, Check, Copy, CloudOff, RefreshCw, Trash2, Edit } from 'lucide-react';
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
  const [bibColors, setBibColors] = useState<Record<string, string>>({});

  const [isEditingMatch, setIsEditingMatch] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  // Engine State
  const [onPitch, setOnPitch] = useState<any[]>([]); // Up to 2 teams
  const [waiting, setWaiting] = useState<any[]>([]); // Any waiting teams
  const [teamScores, setTeamScores] = useState<Record<string, number>>({});
  const [teamPlayers, setTeamPlayers] = useState<Record<string, any[]>>({});
  const [goalAnim, setGoalAnim] = useState<{teamId: string, id: number} | null>(null);
  
  const [events, setEvents] = useState<any[]>([]);
  const [timeOnPitch, setTimeOnPitch] = useState<Record<string, number>>({});
  const [goalsConceded, setGoalsConceded] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pollVotes, setPollVotes] = useState<any[]>([]);
  const [votingAward, setVotingAward] = useState<'BEST_DEFENDER' | 'BEST_GK' | null>(null);

  const [isManagingQueue, setIsManagingQueue] = useState(false);
  const [managedPitch, setManagedPitch] = useState<any[]>([]);
  const [managedWaiting, setManagedWaiting] = useState<any[]>([]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `session_id=eq.${id}` }, (payload) => {
        console.log('Vote received', payload);
        fetchPollVotes();
      })
      .subscribe();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(subscription);
    };
  }, [id]);

  const fetchPollVotes = async () => {
    const { data } = await supabase.from('poll_votes').select('*, voter:profiles!poll_votes_voter_id_fkey(username)').eq('session_id', id);
    if (data) setPollVotes(data);
  };

  const fetchMatchData = async () => {
    // Fetch session
    const { data: sData } = await supabase.from('sessions').select('*').eq('id', id).single();
    if (sData) setSession(sData);
    
    fetchPollVotes();

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
      let timeOnPitchLocal: Record<string, number> = {};
      let goalsConcededLocal: Record<string, number> = {};
      
      tData.forEach(t => { scores[t.id] = 0; timeOnPitchLocal[t.id] = 0; goalsConcededLocal[t.id] = 0; });
      currentPitch.forEach(t => timeOnPitchLocal[t.id] = 1);

      const sortedEvents = [...allEvents].reverse();

      sortedEvents.forEach(ev => {
        if (ev.event_type === 'SET_PITCH_STATE' && ev.metadata) {
          const { onPitch: pitchIds, waiting: waitingIds } = ev.metadata;
          currentPitch = pitchIds.map((pid: string) => tData.find(t => t.id === pid)).filter(Boolean);
          currentWaiting = waitingIds.map((wid: string) => tData.find(t => t.id === wid)).filter(Boolean);
          // When a manual state override happens, we reset the time on pitch for current teams
          currentPitch.forEach(t => timeOnPitchLocal[t.id] += 1);
        } else if (ev.event_type === 'GOAL') {
          scores[ev.team_id] = (scores[ev.team_id] || 0) + 1;
          
          const concedingTeam = currentPitch.find(t => t.id !== ev.team_id) || currentPitch[1];
          if (concedingTeam) {
            goalsConcededLocal[concedingTeam.id] = (goalsConcededLocal[concedingTeam.id] || 0) + 1;
          }

          if (sData?.mode === 'WINNER_STAYS' && currentWaiting.length > 0) {
            const winner = currentPitch.find(t => t.id === ev.team_id) || currentPitch[0];
            const loser = concedingTeam;
            
            currentPitch = [winner, currentWaiting[0]];
            currentWaiting = [...currentWaiting.slice(1), loser];
            
            timeOnPitchLocal[winner.id] += 1;
            timeOnPitchLocal[currentPitch[1].id] = (timeOnPitchLocal[currentPitch[1].id] || 0) + 1; // new team
          }
        } else if (ev.event_type === 'NO_GOAL_TIME_UP') {
          if (sData?.mode === 'WINNER_STAYS' && currentWaiting.length > 0) {
            // WINNER STAYS: In a draw, the incumbent (winner of previous match, which is always currentPitch[0]) stays.
            // The challenger (currentPitch[1]) rotates out.
            const winner = currentPitch[0];
            const loser = currentPitch[1];
            
            currentPitch = [winner, currentWaiting[0]];
            currentWaiting = [...currentWaiting.slice(1), loser];
            
            timeOnPitchLocal[winner.id] += 1;
            timeOnPitchLocal[currentPitch[1].id] = (timeOnPitchLocal[currentPitch[1].id] || 0) + 1;
          }
        } else if (ev.event_type === 'UNDO') {
          // We use 'UNDO' as a MANUAL_SWAP event to avoid schema changes
          if (currentWaiting.length > 0) {
            const teamOutId = ev.team_id;
            const teamOutIndex = currentPitch.findIndex(t => t.id === teamOutId);
            if (teamOutIndex !== -1) {
              const teamOut = currentPitch[teamOutIndex];
              const teamIn = currentWaiting[0];
              currentPitch[teamOutIndex] = teamIn;
              
              // Add the old team to the end of the waiting list
              currentWaiting = [...currentWaiting.slice(1), teamOut];
              
              timeOnPitchLocal[teamIn.id] = (timeOnPitchLocal[teamIn.id] || 0) + 1;
            }
          }
        }
      });

      setOnPitch(currentPitch);
      setWaiting(currentWaiting);
      setTimeOnPitch(timeOnPitchLocal);
      setGoalsConceded(goalsConcededLocal);
      
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

  const saveQueueOrder = async (newPitch: any[], newWaiting: any[]) => {
    const eventData = {
      session_id: id,
      event_type: 'SET_PITCH_STATE',
      metadata: {
        onPitch: newPitch.map(t => t.id),
        waiting: newWaiting.map(t => t.id)
      },
      timestamp: new Date().toISOString()
    };
    
    if (!navigator.onLine) {
      alert("Queue ordering is currently only supported when online.");
      return;
    }
    
    setIsManagingQueue(false);
    const { error } = await supabase.from('events').insert(eventData);
    if (error) console.error("Error updating queue order:", error);
    else fetchMatchData();
  };

  const swapTeam = async (teamId: string) => {
    const eventData = {
      session_id: id,
      event_type: 'UNDO', // Re-using UNDO for manual swap
      team_id: teamId,
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
    if (error) console.error("Error swapping team:", error);
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
      // Save the final team stats to the database
      const teamStatsInserts = Object.keys(timeOnPitch).map(tId => ({
        session_id: id,
        team_id: tId,
        wins: teamScores[tId] || 0,
        matches_played: timeOnPitch[tId] || 0,
        goals_conceded: goalsConceded[tId] || 0,
      }));
      
      if (teamStatsInserts.length > 0) {
        const { error: statsError } = await supabase.from('session_team_stats').insert(teamStatsInserts);
        if (statsError) console.error("Error saving team stats:", statsError);
      }

      await supabase.from('sessions').update({ status: 'COMPLETED' }).eq('id', id);
      navigate('/matches');
    }
  };

  const castPollVote = async (awardType: 'BEST_DEFENDER' | 'BEST_GK', candidateId: string) => {
    if (!profile?.id) return alert("You must be logged in to vote.");
    
    // Check if user already voted
    const existingVote = pollVotes.find(v => v.voter_id === profile.id && v.award_type === awardType);
    
    if (existingVote) {
      await supabase.from('poll_votes').update({ candidate_id: candidateId }).eq('id', existingVote.id);
    } else {
      await supabase.from('poll_votes').insert({
        session_id: id,
        award_type: awardType,
        voter_id: profile.id,
        candidate_id: candidateId
      });
    }
    setVotingAward(null);
    fetchPollVotes();
  };

  const copyStats = () => {
    if (!session) return;
    
    if (session.status !== 'COMPLETED') {
      let text = `Match - ${new Date(session.date).toLocaleDateString()}\n`;
      if (session.location) text += `Location: ${session.location}\n`;
      text += `Time: ${new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n`;
      
      const allTeams = [...Object.values(onPitch), ...waiting];
      
      allTeams.sort((a, b) => a.name.localeCompare(b.name)).forEach(team => {
        const players = teamPlayers[team.id];
        if (!players || players.length === 0) return;
        
        const bibColor = bibColors[team.id] ? ` (${bibColors[team.id]})` : '';
        text += `\n${team.name}${bibColor}\n`;
        text += `Captain: ${players[0].username}\n`;
        if (players.length > 1) {
          players.slice(1).forEach((p, index) => {
            text += `${index + 1}. ${p.username}\n`;
          });
        }
      });

      navigator.clipboard.writeText(text);
      setStatsCopied(true);
      setTimeout(() => setStatsCopied(false), 2000);
      return;
    }

    let text = `Match Day Stats - ${new Date(session.date).toLocaleDateString()}\n`;
    if (session.location) text += `Location: ${session.location}\n`;
    text += `\n--- Match Day Tally ---\n`;
    
    let matchWinner: any = null;
    let maxScore = -1;
    Object.entries(teamScores).forEach(([tId, score]) => {
      if (score > maxScore) {
        maxScore = score;
        matchWinner = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
      }
    });

    Object.entries(teamScores).forEach(([tId, score]) => {
      const t = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
      if (t) {
        text += `${t.name.replace('Team ', '')}: ${score}\n`;
      }
    });

    text += `\n--- Player Stats ---\n`;
    const teams = Object.keys(teamPlayers).map(tId => Object.values(onPitch).concat(waiting).find(t => t.id === tId)).filter(Boolean);
    teams.sort((a, b) => {
      if (matchWinner && a?.id === matchWinner.id) return -1;
      if (matchWinner && b?.id === matchWinner.id) return 1;
      return 0;
    });

    teams.forEach(team => {
      if (!team) return;
      const players = teamPlayers[team.id];
      if (!players) return;
      
      const isWinner = matchWinner && team.id === matchWinner.id;
      let hasStats = false;
      let teamText = isWinner ? `\n🏆 WINNER: ${team.name} 🏆\n` : `\n${team.name}:\n`;
      
      players.forEach(player => {
        const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
        const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;
        
        if (pGoals > 0 || pAssists > 0 || isWinner) {
          hasStats = true;
          teamText += `- ${player.username}`;
          const stats = [];
          if (pGoals > 0) stats.push(`${pGoals} G`);
          if (pAssists > 0) stats.push(`${pAssists} A`);
          if (stats.length > 0) {
            teamText += `: ${stats.join(', ')}`;
          }
          teamText += '\n';
        }
      });
      if (hasStats) {
        text += teamText;
      }
    });

    let topScorerName = 'N/A';
    let topScorerGoals = 0;
    let topScorerAssists = 0;
    
    let topAssisterName = 'N/A';
    let topAssisterAssists = 0;
    let topAssisterGoals = 0;

    Object.values(teamPlayers).flat().forEach(player => {
      const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
      const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;
      
      if (pGoals > topScorerGoals || (pGoals === topScorerGoals && pGoals > 0 && pAssists > topScorerAssists)) {
        topScorerGoals = pGoals;
        topScorerAssists = pAssists;
        topScorerName = player.username;
      }
      
      if (pAssists > topAssisterAssists || (pAssists === topAssisterAssists && pAssists > 0 && pGoals > topAssisterGoals)) {
        topAssisterAssists = pAssists;
        topAssisterGoals = pGoals;
        topAssisterName = player.username;
      }
    });

    const getAwardWinner = (awardType: string) => {
      const votes = pollVotes.filter(v => v.award_type === awardType);
      const counts: Record<string, number> = {};
      votes.forEach(v => counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1);
      let maxId: string | null = null;
      let maxVotes = 0;
      Object.entries(counts).forEach(([id, c]) => {
        if (c > maxVotes) { maxVotes = c; maxId = id; }
      });
      if (!maxId) return null;
      return Object.values(teamPlayers).flat().find(p => p.id === maxId)?.username;
    };

    const bestGk = getAwardWinner('BEST_GK');
    const bestDef = getAwardWinner('BEST_DEFENDER');

    text += `\n--- Highlights ---\n`;
    if (topScorerGoals > 0) text += `Top Scorer: ${topScorerName} (${topScorerGoals}G)\n`;
    if (topAssisterAssists > 0) text += `Top Assister: ${topAssisterName} (${topAssisterAssists}A)\n`;
    if (bestGk) text += `Best GK: ${bestGk}\n`;
    if (bestDef) text += `Best Defender: ${bestDef}\n`;

    navigator.clipboard.writeText(text);
    setStatsCopied(true);
    setTimeout(() => setStatsCopied(false), 2000);
  };

  const openEditModal = () => {
    if (session?.date) {
      const dateObj = new Date(session.date);
      const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
      setEditDate(localDate.toISOString().split('T')[0]);
      setEditTime(localDate.toISOString().split('T')[1].slice(0, 5));
    }
    setEditLocation(session?.location || '');
    setIsEditingMatch(true);
  };

  const saveMatchDetails = async () => {
    try {
      const d = new Date(`${editDate}T${editTime}`);
      const { error } = await supabase.from('sessions').update({ 
        date: d.toISOString(), 
        location: editLocation 
      }).eq('id', session?.id);
      if (error) throw error;
      setIsEditingMatch(false);
      fetchMatchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteMatch = async () => {
    if (!window.confirm("Are you sure you want to delete this match completely? This cannot be undone.")) return;
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (!error) {
      navigate('/matches');
    } else {
      alert(error.message);
    }
  };

  if (loading) return <div className="text-primary-500 p-8 flex justify-center"><Activity className="w-8 h-8 animate-spin" /></div>;
  if (!session || onPitch.length < 2) return <div className="text-red-400 p-8 text-center">Match not found or invalid teams.</div>;

  const teamA = onPitch[0];
  const teamB = onPitch[1];
  const teamAPlayersList = teamPlayers[teamA.id] || [];
  const teamBPlayersList = teamPlayers[teamB.id] || [];

  let winnersOfTheDay: any[] = [];
  let maxScore = -1;
  if (session?.status === 'COMPLETED') {
    Object.entries(teamScores).forEach(([tId, score]) => {
      if (score > maxScore) {
        maxScore = score;
        const winner = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
        winnersOfTheDay = winner ? [winner] : [];
      } else if (score === maxScore && maxScore !== -1) {
        const winner = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
        if (winner) winnersOfTheDay.push(winner);
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
          {profile?.role === 'admin' && (
            <>
              <button 
                onClick={openEditModal}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20 border border-neutral-500/20 transition-colors"
                title="Edit Match"
              >
                <Edit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button 
                onClick={deleteMatch}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                title="Delete Match"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </>
          )}
          <button 
            onClick={copyStats}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 border border-primary-500/20 transition-colors"
            title={session?.status === 'COMPLETED' ? "Copy Match Stats" : "Copy Teams"}
          >
            {statsCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {statsCopied ? 'Copied!' : (session?.status === 'COMPLETED' ? 'Copy Stats' : 'Copy Teams')}
            </span>
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
            <h2 className="text-xl md:text-2xl font-bold text-neutral-400 mb-2 tracking-widest uppercase">
              {winnersOfTheDay.length > 1 ? 'Match Day Winners (Draw)' : 'Match Day Winner'}
            </h2>
            <div className="text-5xl md:text-7xl font-black text-primary-400 tracking-tighter drop-shadow-lg mb-4 uppercase text-center flex flex-col md:flex-row gap-4 items-center justify-center">
              {winnersOfTheDay.map((winner, idx) => (
                <span key={winner?.id || idx}>
                  {winner?.name}
                  {idx < winnersOfTheDay.length - 1 && <span className="text-3xl text-neutral-500 mx-4 hidden md:inline">&</span>}
                </span>
              ))}
            </div>
            <div className="text-lg text-white font-bold bg-neutral-800 px-6 py-2 rounded-full border border-neutral-700 mb-8">
              {maxScore} {session.mode === 'WINNER_STAYS' ? 'Wins' : 'Goals'}
            </div>

            {/* Poll Results */}
            <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {['BEST_DEFENDER', 'BEST_GK'].map(award => {
                const awardName = award === 'BEST_DEFENDER' ? '🛡️ Best Defender' : '🧤 Best Goalkeeper';
                const votesForAward = pollVotes.filter(v => v.award_type === award);
                const voteCounts: Record<string, number> = {};
                votesForAward.forEach(v => {
                  voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] || 0) + 1;
                });
                
                let leadingCandidateIds: string[] = [];
                let maxVotes = 0;
                Object.entries(voteCounts).forEach(([cId, count]) => {
                  if (count > maxVotes) {
                    maxVotes = count;
                    leadingCandidateIds = [cId];
                  } else if (count === maxVotes && maxVotes > 0) {
                    leadingCandidateIds.push(cId);
                  }
                });

                const leadingPlayers = leadingCandidateIds.map(id => Object.values(teamPlayers).flat().find(p => p.id === id)).filter(Boolean);
                const hasVoted = pollVotes.some(v => v.voter_id === profile?.id && v.award_type === award);

                return (
                  <div key={award} className="bg-neutral-900/80 border border-white/10 rounded-2xl p-5 text-left relative overflow-hidden">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                      {awardName}
                      {hasVoted && <span className="bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded text-[10px]">VOTED</span>}
                    </h3>
                    
                    {leadingPlayers.length > 0 ? (
                      <div className="flex flex-col gap-2 mb-4">
                        {leadingPlayers.map(player => (
                          <div key={player?.id} className="flex items-center justify-between">
                            <div className="text-2xl font-black text-white">{player?.username}</div>
                            <div className="text-sm font-bold bg-white/10 px-3 py-1 rounded-full text-white">{maxVotes} {maxVotes === 1 ? 'vote' : 'votes'}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-neutral-500 italic mb-4">No votes yet</div>
                    )}
                    
                    <button 
                      onClick={() => setVotingAward(award as 'BEST_DEFENDER' | 'BEST_GK')}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-colors"
                    >
                      {hasVoted ? 'Change Vote' : 'Cast Vote'}
                    </button>
                    
                    {profile?.role === 'admin' && votesForAward.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Admin: Vote Details</div>
                        <ul className="text-xs text-neutral-400 space-y-1 max-h-32 overflow-y-auto pr-1">
                          {votesForAward.map(v => {
                            const candidate = Object.values(teamPlayers).flat().find(p => p.id === v.candidate_id);
                            return (
                              <li key={v.id} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                                <span className="truncate pr-2">{v.voter?.username || 'Unknown'}</span>
                                <span className="text-white whitespace-nowrap text-[10px] bg-white/10 px-2 py-0.5 rounded-full">voted {candidate?.username || 'Unknown'}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
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
        <div className="flex flex-col items-center justify-center mb-8 gap-3">
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse">
            <Clock className="w-4 h-4" />
            Waiting: {waiting.map(t => t.name).join(', ')}
          </div>
          {profile?.role === 'admin' && Object.values(timeOnPitch).some(t => t === 0) && (
            <button
              onClick={() => {
                setManagedPitch([...onPitch]);
                setManagedWaiting([...waiting]);
                setIsManagingQueue(true);
              }}
              className="text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors underline"
            >
              Manage Match Order
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Action Area */}
        <div className="lg:col-span-2 space-y-8">
          {session.status !== 'IN_PROGRESS' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(teamPlayers).map(([tId, players]) => {
                const team = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
                if (!team) return null;
                
                return (
                  <div key={tId} className="bg-black border border-white/5 rounded-2xl p-5 shadow-lg shadow-black/50">
                    <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm flex items-center justify-between">
                      <span>{team.name}</span>
                      {session.status === 'SCHEDULED' && profile?.role === 'admin' && (
                        <select 
                          className="bg-neutral-800 text-xs font-normal border border-white/10 rounded px-2 py-1 outline-none text-neutral-300 ml-2"
                          value={bibColors[tId] || ''}
                          onChange={(e) => setBibColors(prev => ({...prev, [tId]: e.target.value}))}
                        >
                          <option value="">No Color</option>
                          <option value="Red">Red</option>
                          <option value="Blue">Blue</option>
                          <option value="Green">Green</option>
                          <option value="Black">Black</option>
                          <option value="White">White</option>
                        </select>
                      )}
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
                  <div className="flex items-center gap-2">
                    <span>{teamA?.name} Goal</span>
                    <span className="bg-primary-500/20 px-2 py-0.5 rounded text-xs">Active</span>
                  </div>
                  {waiting.length > 0 && profile?.role === 'admin' && session.status === 'IN_PROGRESS' && (
                    <button 
                      onClick={() => swapTeam(teamA.id)}
                      className="text-xs bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-1 rounded transition-colors"
                      title="Swap this team out for the next waiting team"
                    >
                      Swap Out
                    </button>
                  )}
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
                  <div className="flex items-center gap-2">
                    <span>{teamB?.name} Goal</span>
                    <span className="bg-blue-500/20 px-2 py-0.5 rounded text-xs">Active</span>
                  </div>
                  {waiting.length > 0 && profile?.role === 'admin' && session.status === 'IN_PROGRESS' && (
                    <button 
                      onClick={() => swapTeam(teamB.id)}
                      className="text-xs bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-1 rounded transition-colors"
                      title="Swap this team out for the next waiting team"
                    >
                      Swap Out
                    </button>
                  )}
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

      {/* Cast Poll Vote Modal */}
      {votingAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
            <h3 className="text-xl font-bold text-white mb-2 text-center">
              {votingAward === 'BEST_DEFENDER' ? '🛡️ Best Defender' : '🧤 Best Goalkeeper'}
            </h3>
            <p className="text-neutral-400 text-sm mb-6 text-center">
              Vote for a player from this matchday
            </p>
            
            <div className="space-y-2 overflow-y-auto pr-2 flex-1">
              {Object.values(teamPlayers).flat()
                // Ensure distinct players (as they might appear multiple times if they played for multiple teams, though unlikely)
                .filter((p, i, self) => i === self.findIndex(t => t.id === p.id))
                .sort((a, b) => a.username.localeCompare(b.username))
                .map(player => {
                  const isCurrentVote = pollVotes.some(v => v.voter_id === profile?.id && v.award_type === votingAward && v.candidate_id === player.id);
                  return (
                    <button
                      key={player.id}
                      onClick={() => castPollVote(votingAward, player.id)}
                      className={`w-full py-3 px-4 font-bold rounded-xl border transition-colors flex justify-between items-center ${
                        isCurrentVote 
                          ? 'bg-primary-500/20 text-primary-400 border-primary-500/30' 
                          : 'bg-neutral-800 hover:bg-neutral-700 text-white border-white/5'
                      }`}
                    >
                      <span>{player.username}</span>
                      {isCurrentVote && <Check className="w-4 h-4" />}
                    </button>
                  );
                })
              }
            </div>

            <button
              onClick={() => setVotingAward(null)}
              className="mt-6 w-full py-3 text-neutral-500 hover:text-white text-sm font-medium transition-colors border-t border-neutral-800 pt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Match Modal */}
      {isEditingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6">
              Edit Match Details
            </h3>
            
            <div className="space-y-4 mb-8 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Time</label>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Location</label>
                <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="e.g. Turf 1" className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none" />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsEditingMatch(false)}
                className="flex-1 py-3 text-neutral-400 hover:text-white font-bold transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={saveMatchDetails}
                className="flex-1 py-3 bg-primary-500 text-black font-black uppercase tracking-widest hover:bg-primary-400 transition-all rounded-xl"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Manager Modal */}
      {isManagingQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">
              Manage Match Order
            </h3>
            <p className="text-sm text-neutral-400 mb-6">Select the two teams playing right now, and order the waiting queue below.</p>
            
            <div className="space-y-6 mb-8 flex-1 overflow-y-auto pr-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">On Pitch (Select 2)</label>
                <div className="space-y-2">
                  {[...managedPitch, ...managedWaiting].map(team => {
                    const isSelected = managedPitch.find(t => t.id === team.id);
                    return (
                      <button
                        key={`pitch-${team.id}`}
                        onClick={() => {
                          if (isSelected) {
                            if (managedPitch.length > 1) {
                              setManagedPitch(managedPitch.filter(t => t.id !== team.id));
                              setManagedWaiting([...managedWaiting, team]);
                            }
                          } else if (managedPitch.length < 2) {
                            setManagedWaiting(managedWaiting.filter(t => t.id !== team.id));
                            setManagedPitch([...managedPitch, team]);
                          }
                        }}
                        className={`w-full py-3 px-4 font-bold rounded-xl border transition-colors flex justify-between items-center ${
                          isSelected 
                            ? 'bg-primary-500/20 text-primary-400 border-primary-500/30' 
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white border-white/5 opacity-50'
                        } ${!isSelected && managedPitch.length >= 2 ? 'cursor-not-allowed opacity-30' : ''}`}
                      >
                        <span>{team.name}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {managedWaiting.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Waiting Queue (Order matters)</label>
                  <div className="space-y-2">
                    {managedWaiting.map((team, idx) => (
                      <div
                        key={`waiting-${team.id}`}
                        className="w-full py-3 px-4 font-bold rounded-xl border bg-neutral-800 text-white border-white/5 flex justify-between items-center"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-neutral-500 w-4">{idx + 1}.</span>
                          <span>{team.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            disabled={idx === 0}
                            onClick={() => {
                              const newW = [...managedWaiting];
                              [newW[idx - 1], newW[idx]] = [newW[idx], newW[idx - 1]];
                              setManagedWaiting(newW);
                            }}
                            className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button 
                            disabled={idx === managedWaiting.length - 1}
                            onClick={() => {
                              const newW = [...managedWaiting];
                              [newW[idx + 1], newW[idx]] = [newW[idx], newW[idx + 1]];
                              setManagedWaiting(newW);
                            }}
                            className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsManagingQueue(false)}
                className="flex-1 py-3 text-neutral-400 hover:text-white font-bold transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={managedPitch.length !== 2}
                onClick={() => saveQueueOrder(managedPitch, managedWaiting)}
                className="flex-1 py-3 bg-primary-500 text-black font-black uppercase tracking-widest hover:bg-primary-400 transition-all rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
