import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';

export interface OverlayEvent {
  type: 'GOAL' | 'ROTATE';
  title: string;
  subtitle: string;
  color: string;
  id: number;
}

export function useActiveMatchData(id: string | undefined, currentProfile: any) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Record<string, any[]>>({});
  const [events, setEvents] = useState<any[]>([]);
  const [pollVotes, setPollVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [overlayEvent, setOverlayEvent] = useState<OverlayEvent | null>(null);

  const prevLatestEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (overlayEvent) {
      const timer = setTimeout(() => setOverlayEvent(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [overlayEvent]);

  const fetchPollVotes = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('poll_votes')
      .select('*, voter:profiles!poll_votes_voter_id_fkey(username)')
      .eq('session_id', id);
    if (data) setPollVotes(data);
  }, [id]);

  const fetchMatchData = useCallback(async () => {
    if (!id) return;

    const [sRes, tRes, eRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').eq('session_id', id).order('name'),
      supabase.from('events')
        .select('*, player:profiles!events_player_id_fkey(username), assister:profiles!events_assisted_by_fkey(username)')
        .eq('session_id', id)
        .order('timestamp', { ascending: false })
    ]);

    const sData = sRes.data;
    if (sData) setSession(sData);

    fetchPollVotes();

    const tData = tRes.data || [];
    setTeams(tData);

    if (tData.length >= 2) {
      const { data: tpData } = await supabase
        .from('team_players')
        .select('*, profiles(*)')
        .in('team_id', tData.map(t => t.id));

      const tpMap: Record<string, any[]> = {};
      tData.forEach(t => (tpMap[t.id] = []));
      if (tpData) {
        tpData.forEach(tp => {
          if (tpMap[tp.team_id]) tpMap[tp.team_id].push(tp.profiles);
        });
      }
      setTeamPlayers(tpMap);

      const eData = eRes.data;
      const offlineQueue = JSON.parse(localStorage.getItem(`offline_events_${id}`) || '[]');
      const offlineInserts = offlineQueue
        .filter((a: any) => a.type === 'INSERT')
        .map((a: any) => {
          const tPlayers = tpMap[a.payload.team_id] || [];
          return {
            ...a.payload,
            id: a.tempId,
            player: { username: tPlayers.find((p: any) => p.id === a.payload.player_id)?.username },
            assister: a.payload.assisted_by
              ? { username: Object.values(tpMap).flat().find((p: any) => p.id === a.payload.assisted_by)?.username }
              : null
          };
        });

      const deletedIds = offlineQueue.filter((a: any) => a.type === 'DELETE').map((a: any) => a.payload);

      let allEvents = (eData || []).filter(e => !deletedIds.includes(e.id));
      allEvents = [...offlineInserts, ...allEvents];
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setEvents(allEvents);

      if (allEvents.length > 0) {
        const latestEvent = allEvents[0];
        if (prevLatestEventIdRef.current !== null && prevLatestEventIdRef.current !== latestEvent.id) {
          if (latestEvent.event_type === 'GOAL') {
            const tName = tData.find(t => t.id === latestEvent.team_id)?.name || 'Team';
            const pName = latestEvent.player?.username || 'Player';
            setOverlayEvent({
              type: 'GOAL',
              title: 'GOAL!',
              subtitle: `${pName} (${tName})`,
              color: 'text-primary-400',
              id: Date.now()
            });
          } else if (latestEvent.event_type === 'NO_GOAL_TIME_UP') {
            setOverlayEvent({
              type: 'ROTATE',
              title: 'TIME UP',
              subtitle: 'Teams Rotating',
              color: 'text-orange-400',
              id: Date.now()
            });
          } else if (latestEvent.event_type === 'UNDO') {
            setOverlayEvent({
              type: 'ROTATE',
              title: 'SWAPPED',
              subtitle: 'Manual Swap',
              color: 'text-purple-400',
              id: Date.now()
            });
          }
        }
        prevLatestEventIdRef.current = latestEvent.id;
      }
    }

    setLoading(false);
  }, [id, fetchPollVotes]);

  const syncOfflineEvents = useCallback(async () => {
    if (!id || !navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem(`offline_events_${id}`) || '[]');
    if (queue.length === 0) return;

    setIsSyncing(true);
    let remainingQueue = [...queue];

    for (let i = 0; i < queue.length; i++) {
      const action = queue[i];
      let error = null;
      if (action.type === 'INSERT') {
        const { tempId: _tempId, ...eventData } = action.payload;
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
  }, [id, fetchMatchData]);

  useEffect(() => {
    if (!id) return;

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineEvents();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) syncOfflineEvents();

    fetchMatchData();

    const subscription = supabase
      .channel(`public:events:session_id=eq.${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `session_id=eq.${id}` }, () => {
        fetchMatchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `session_id=eq.${id}` }, () => {
        fetchPollVotes();
      })
      .subscribe();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(subscription);
    };
  }, [id, syncOfflineEvents, fetchMatchData, fetchPollVotes]);

  const recordGoal = async (playerId: string, teamId: string, assistedBy: string | null) => {
    if (!id) return;
    const eventData = {
      session_id: id,
      event_type: 'GOAL',
      player_id: playerId,
      team_id: teamId,
      assisted_by: assistedBy,
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
    if (error) console.error('Error recording goal:', error);
    else fetchMatchData();
  };

  const recordSwapTeam = async (teamId: string) => {
    if (!id) return;
    const eventData = {
      session_id: id,
      event_type: 'UNDO',
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
    if (error) console.error('Error swapping team:', error);
    else fetchMatchData();
  };

  const recordTimeUp = async () => {
    if (!id) return;
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
    if (error) console.error('Error recording time up:', error);
    else fetchMatchData();
  };

  const undoEvent = async (eventId: string) => {
    if (!id) return;
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
    if (error) console.error('Error undoing event:', error);
    else fetchMatchData();
  };

  const saveQueueOrder = async (newPitch: any[], newWaiting: any[]) => {
    if (!id) return;
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
      toast.warning('Queue ordering is currently only supported when online.');
      return;
    }

    const { error } = await supabase.from('events').insert(eventData);
    if (error) console.error('Error updating queue order:', error);
    else fetchMatchData();
  };

  const castPollVote = async (awardType: 'BEST_DEFENDER' | 'BEST_GK' | 'MOTM', candidateId: string) => {
    if (!id) return;
    if (!currentProfile?.id) {
      toast.info('You must be logged in to vote.');
      return;
    }

    const existingVote = pollVotes.find(v => v.voter_id === currentProfile.id && v.award_type === awardType);

    if (existingVote) {
      const { error } = await supabase.from('poll_votes').update({ candidate_id: candidateId }).eq('id', existingVote.id);
      if (error) {
        console.error('Vote update error:', error);
        toast.error('Failed to update vote: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('poll_votes').insert({
        session_id: id,
        award_type: awardType,
        voter_id: currentProfile.id,
        candidate_id: candidateId
      });
      if (error) {
        console.error('Vote insert error:', error);
        toast.error('Failed to cast vote: ' + error.message);
      }
    }
    fetchPollVotes();
  };

  const submitBulkStats = async (bulkPreview: any[]) => {
    if (!id) return;
    if (bulkPreview.some(p => !p.found)) {
      toast.warning('Please fix unrecognized players before importing.');
      return;
    }

    const goalsList: any[] = [];
    const assistsList: any[] = [];

    for (const p of bulkPreview) {
      for (let i = 0; i < p.goals; i++) {
        goalsList.push({ player_id: p.player_id, team_id: p.team_id });
      }
      for (let i = 0; i < p.assists; i++) {
        assistsList.push({ player_id: p.player_id });
      }
    }

    const maxLen = Math.max(goalsList.length, assistsList.length);
    const newEvents = [];

    for (let i = 0; i < maxLen; i++) {
      const g = goalsList[i] || { player_id: null, team_id: null };
      const a = assistsList[i] || { player_id: null };

      let team_id = g.team_id;
      if (!team_id && a.player_id) {
        const p = bulkPreview.find(x => x.player_id === a.player_id);
        team_id = p ? p.team_id : null;
      }
      if (!team_id) {
        team_id = Object.keys(teamPlayers)[0];
      }

      newEvents.push({
        session_id: id,
        event_type: 'GOAL',
        player_id: g.player_id,
        team_id: team_id,
        assisted_by: a.player_id
      });
    }

    if (newEvents.length > 0) {
      const { error } = await supabase.from('events').insert(newEvents);
      if (error) {
        toast.error('Failed to import stats: ' + error.message);
        return;
      }
      fetchMatchData();
    }
  };

  const saveMatchDetails = async (editDate: string, editTime: string, editLocation: string) => {
    if (!session?.id) return;
    try {
      const d = new Date(`${editDate}T${editTime}`);
      const { error } = await supabase.from('sessions').update({
        date: d.toISOString(),
        location: editLocation
      }).eq('id', session.id);
      if (error) throw error;
      fetchMatchData();
    } catch (err: any) {
      toast.error('Failed to update match details: ' + err.message);
    }
  };

  const deleteMatch = async () => {
    if (!id) return;
    const ok = await confirm({
      title: 'Delete Match Completely?',
      description: 'Are you sure you want to delete this match completely? This cannot be undone.',
      confirmText: 'Delete Match',
      variant: 'danger',
      isDestructive: true
    });
    if (!ok) return;

    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (!error) {
      navigate('/matches');
    } else {
      toast.error('Failed to delete match: ' + error.message);
    }
  };

  const endSession = async (
    teamScores: Record<string, number>,
    timeOnPitch: Record<string, number>,
    goalsConceded: Record<string, number>
  ) => {
    if (!id) return;
    const ok = await confirm({
      title: 'End Match Day?',
      description: "Are you sure you want to end this match day? All recorded goals will be added to the players' total stats permanently.",
      confirmText: 'End Match Day',
      variant: 'warning',
      isDestructive: false
    });
    if (!ok) return;

    let maxGoals = -1;
    let winningTeamId: string | null = null;
    let isDraw = false;

    if (session?.mode === 'STANDARD') {
      Object.entries(teamScores).forEach(([tId, goals]) => {
        if (goals > maxGoals) {
          maxGoals = goals;
          winningTeamId = tId;
          isDraw = false;
        } else if (goals === maxGoals) {
          isDraw = true;
        }
      });
    }

    const teamStatsInserts = Object.keys(timeOnPitch).map(tId => {
      let teamWins = 0;
      if (session?.mode === 'STANDARD') {
        teamWins = !isDraw && winningTeamId === tId ? 1 : 0;
      } else {
        teamWins = teamScores[tId] || 0;
      }

      return {
        session_id: id,
        team_id: tId,
        wins: teamWins,
        matches_played: timeOnPitch[tId] || 0,
        goals_conceded: goalsConceded[tId] || 0
      };
    });

    if (teamStatsInserts.length > 0) {
      const { error: statsError } = await supabase.from('session_team_stats').insert(teamStatsInserts);
      if (statsError) console.error('Error saving team stats:', statsError);
    }

    await supabase.from('sessions').update({ status: 'COMPLETED' }).eq('id', id);

    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          notificationType: 'POST_MATCH',
          sessionId: id
        }
      });
    } catch (err) {
      console.error('Failed to send post match notification', err);
    }

    navigate('/matches');
  };

  return {
    session,
    teams,
    teamPlayers,
    events,
    pollVotes,
    loading,
    isOffline,
    isSyncing,
    overlayEvent,
    fetchMatchData,
    fetchPollVotes,
    recordGoal,
    recordSwapTeam,
    recordTimeUp,
    undoEvent,
    saveQueueOrder,
    castPollVote,
    submitBulkStats,
    saveMatchDetails,
    deleteMatch,
    endSession
  };
}
