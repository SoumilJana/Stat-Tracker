import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, Shuffle, CheckCircle2, Clock, X, Plus, RotateCcw, EyeOff, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Profile = { id: string; username: string; photo_url: string; role: string; jersey_number: number };
type DraftCaptain = { id: string; player_id: string; pick_order: number; profile?: Profile };
type DraftPick = { id: string; captain_id: string; player_id: string; pick_number: number; profile?: Profile };
type Draft = { 
  id: string; 
  status: 'SETUP' | 'IN_PROGRESS' | 'COMPLETED'; 
  single_device_mode: boolean; 
  current_pick_index: number; 
  mode: string; 
  location: string; 
  match_date: string;
};

export default function Drafts() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [draft, setDraft] = useState<Draft | null>(null);
  const [captains, setCaptains] = useState<DraftCaptain[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  
  // Setup state
  const [setupMode, setSetupMode] = useState('STANDARD');
  const [setupNumTeams, setSetupNumTeams] = useState(3);
  const [setupLocation, setSetupLocation] = useState('');
  const [setupDate, setSetupDate] = useState(new Date().toISOString().split('T')[0]);
  const [setupTime, setSetupTime] = useState('19:00');
  const [selectedCaptainIds, setSelectedCaptainIds] = useState<string[]>([]);
  const [singleDeviceMode, setSingleDeviceMode] = useState(false);
  const [pendingPickId, setPendingPickId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [hiddenPlayerIds, setHiddenPlayerIds] = useState<string[]>([]);

  useEffect(() => {
    fetchActiveDraft();
    fetchPlayers();
  }, []);

  useEffect(() => {
    const maxCaptains = setupMode === 'WINNER_STAYS' ? setupNumTeams : 2;
    if (selectedCaptainIds.length > maxCaptains) {
      setSelectedCaptainIds(prev => prev.slice(0, maxCaptains));
    }
  }, [setupMode, setupNumTeams]);

  useEffect(() => {
    if (!draft?.id) return;

    const draftSub = supabase.channel(`draft_${draft.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drafts', filter: `id=eq.${draft.id}` }, payload => {
        if (payload.new) setDraft(payload.new as Draft);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_picks', filter: `draft_id=eq.${draft.id}` }, () => {
        fetchPicks(draft.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(draftSub);
    };
  }, [draft?.id]);


  const fetchPlayers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('username');
    if (data) setPlayers(data);
  };

  const fetchActiveDraft = async () => {
    const { data } = await supabase.from('drafts')
      .select('*')
      .in('status', ['SETUP', 'IN_PROGRESS'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); 
    
    if (data) {
      setDraft(data);
      const capPromise = supabase.from('draft_captains').select('*, profile:profiles(*)').eq('draft_id', data.id).order('pick_order');
      const pickPromise = supabase.from('draft_picks').select('*, profile:profiles(*)').eq('draft_id', data.id).order('pick_number');
      const [capRes, pickRes] = await Promise.all([capPromise, pickPromise]);
      
      if (capRes.data) setCaptains(capRes.data);
      if (pickRes.data) setPicks(pickRes.data);
    }
  };

  const fetchCaptains = async (draftId: string) => {
    const { data } = await supabase.from('draft_captains').select('*, profile:profiles(*)').eq('draft_id', draftId).order('pick_order');
    if (data) setCaptains(data);
  };

  const fetchPicks = async (draftId: string) => {
    const { data } = await supabase.from('draft_picks').select('*, profile:profiles(*)').eq('draft_id', draftId).order('pick_number');
    if (data) setPicks(data);
  };

  const toggleCaptain = (playerId: string) => {
    if (selectedCaptainIds.includes(playerId)) {
      setSelectedCaptainIds(prev => prev.filter(id => id !== playerId));
    } else {
      const maxCaptains = setupMode === 'WINNER_STAYS' ? setupNumTeams : 2;
      if (selectedCaptainIds.length >= maxCaptains) {
        alert(`You can only select ${maxCaptains} captains for this mode.`);
        return;
      }
      setSelectedCaptainIds(prev => [...prev, playerId]);
    }
  };

  const startDraft = async () => {
    const maxCaptains = setupMode === 'WINNER_STAYS' ? setupNumTeams : 2;
    if (selectedCaptainIds.length !== maxCaptains) return alert(`Select exactly ${maxCaptains} captains.`);
    
    setIsStarting(true);
    
    try {
      const { data: newDraft, error: draftError } = await supabase.from('drafts').insert({
        status: 'IN_PROGRESS',
        single_device_mode: singleDeviceMode,
        mode: setupMode,
        location: setupLocation,
        match_date: new Date(`${setupDate}T${setupTime}:00`).toISOString()
      }).select().single();

      if (draftError) throw draftError;

      const shuffled = [...selectedCaptainIds].sort(() => 0.5 - Math.random());
      const captainsToInsert = shuffled.map((playerId, index) => ({
        draft_id: newDraft.id,
        player_id: playerId,
        pick_order: index
      }));

      const { error: capError } = await supabase.from('draft_captains').insert(captainsToInsert);
      if (capError) throw capError;

      setDraft(newDraft);
      fetchCaptains(newDraft.id);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsStarting(false);
    }
  };

  const mulberry32 = (a: number) => {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  };

  const getSeedFromString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return hash;
  };

  const numCaptains = captains.length;
  const pickNumber = draft?.current_pick_index || 0;
  const round = numCaptains > 0 ? Math.floor(pickNumber / numCaptains) : 0;
  
  let activePickOrder = 0;
  if (numCaptains > 0 && draft) {
    const roundSeed = getSeedFromString(`${draft.id}-round-${round}`);
    const random = mulberry32(roundSeed);
    
    // Warm up the PRNG so that the first numbers are well distributed
    for(let i = 0; i < 15; i++) random();
    
    const roundOrder = Array.from({length: numCaptains}, (_, i) => i);
    
    for (let i = roundOrder.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [roundOrder[i], roundOrder[j]] = [roundOrder[j], roundOrder[i]];
    }
    
    const pickIndexInRound = pickNumber % numCaptains;
    activePickOrder = roundOrder[pickIndexInRound];
  }
  
  const activeCaptain = captains.find(c => c.pick_order === activePickOrder);
  // Allow the active captain to pick, or allow admins to pick for anyone (useful for testing/overriding or single device mode)
  const isMyTurn = (profile?.role === 'admin') || (activeCaptain?.player_id === profile?.id);

  useEffect(() => {
    setPendingPickId(null);
  }, [draft?.current_pick_index]);

  const makePick = async (playerId: string) => {
    if (!draft || !activeCaptain || !isMyTurn || pendingPickId) return;
    
    setPendingPickId(playerId);
    try {
      const { error } = await supabase.from('draft_picks').insert({
        draft_id: draft.id,
        captain_id: activeCaptain.id,
        player_id: playerId,
        pick_number: pickNumber
      });
      if (error) throw error;

      const { error: updateError } = await supabase.from('drafts').update({ current_pick_index: pickNumber + 1 }).eq('id', draft.id);
      if (updateError) throw updateError;
      
      setDraft(prev => prev ? { ...prev, current_pick_index: pickNumber + 1 } : null);
      fetchPicks(draft.id);
      
    } catch (e: any) {
      alert(e.message);
      setPendingPickId(null);
    }
  };

  const removePick = async (pickId: string, pickNum: number) => {
    if (!draft || profile?.role !== 'admin') return;
    if (!window.confirm("Are you sure you want to remove this pick?")) return;
    
    try {
      const isLastPick = pickNum === draft.current_pick_index - 1;
      const { error } = await supabase.from('draft_picks').delete().eq('id', pickId);
      if (error) throw error;
      
      if (isLastPick) {
        const { error: updateError } = await supabase.from('drafts').update({ current_pick_index: draft.current_pick_index - 1 }).eq('id', draft.id);
        if (updateError) throw updateError;
        setDraft(prev => prev ? { ...prev, current_pick_index: draft.current_pick_index - 1 } : null);
      }
      
      fetchPicks(draft.id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const cancelDraft = async () => {
    if (!draft || profile?.role !== 'admin') return;
    if (!window.confirm("Are you sure you want to reset the draft? This will clear all picks and progress.")) return;
    try {
      const { error } = await supabase.from('drafts').update({ status: 'COMPLETED' }).eq('id', draft.id);
      if (error) throw error;
      
      setSetupMode(draft.mode || 'STANDARD');
      setSetupLocation(draft.location || '');
      if (draft.match_date) {
        const dateObj = new Date(draft.match_date);
        const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
        setSetupDate(localDate.toISOString().split('T')[0]);
        setSetupTime(localDate.toISOString().split('T')[1].slice(0, 5));
      }
      setSelectedCaptainIds(captains.map(c => c.player_id));
      setSingleDeviceMode(draft.single_device_mode || false);

      setDraft(null);
      setCaptains([]);
      setPicks([]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const finishDraft = async () => {
    if (!draft) return;
    if (!window.confirm("Are you sure you want to finish the draft and create the match?")) return;

    try {
      await supabase.from('drafts').update({ status: 'COMPLETED' }).eq('id', draft.id);
      
      const { data: session, error: sessionError } = await supabase.from('sessions').insert({ 
        location: draft.location, 
        mode: draft.mode as any, 
        status: 'SCHEDULED',
        date: draft.match_date 
      }).select().single();
      
      if (sessionError) throw sessionError;

      const teamNames = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'];
      const teamsToInsert = captains.map((_, index) => ({
        session_id: session.id,
        name: teamNames[index] || `Team ${String.fromCharCode(65 + index)}`
      }));

      const { data: teams, error: teamsError } = await supabase.from('teams').insert(teamsToInsert).select();
      if (teamsError) throw teamsError;

      const teamPlayersData: any[] = [];
      captains.forEach((cap, index) => {
        const teamId = teams[index].id;
        teamPlayersData.push({ team_id: teamId, player_id: cap.player_id });
        const captainPicks = picks.filter(p => p.captain_id === cap.id);
        captainPicks.forEach(p => {
          teamPlayersData.push({ team_id: teamId, player_id: p.player_id });
        });
      });

      const { error: tpError } = await supabase.from('team_players').insert(teamPlayersData);
      if (tpError) throw tpError;

      navigate(`/matches/${session.id}`);

    } catch (e: any) {
      alert(e.message);
    }
  };

  const draftedPlayerIds = [...captains.map(c => c.player_id), ...picks.map(p => p.player_id)];
  const availablePlayers = players.filter(p => !draftedPlayerIds.includes(p.id) && !hiddenPlayerIds.includes(p.id));
  const hiddenPlayers = players.filter(p => !draftedPlayerIds.includes(p.id) && hiddenPlayerIds.includes(p.id));
  const isDraftComplete = availablePlayers.length === 0 || (numCaptains > 0 && picks.length >= numCaptains * 4);

  if (!draft) {
    if (profile?.role !== 'admin') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
          <div className="w-20 h-20 bg-neutral-900 border border-white/5 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-neutral-500" />
          </div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">No Active Draft</h2>
          <p className="text-neutral-400 max-w-sm">Waiting for an admin to start a new draft session.</p>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto pb-24 space-y-8 animate-in fade-in zoom-in duration-500">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-widest">Draft Setup</h2>
          <p className="text-neutral-400 mt-2">Configure match details and select captains to begin.</p>
        </div>

        <div className="bg-black border border-white/5 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Date</label>
              <input type="date" value={setupDate} onChange={e => setSetupDate(e.target.value)} className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Time</label>
              <input type="time" value={setupTime} onChange={e => setSetupTime(e.target.value)} className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Location</label>
              <input type="text" value={setupLocation} onChange={e => setSetupLocation(e.target.value)} placeholder="e.g. Arena" className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none placeholder-neutral-600" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Mode</label>
              <select value={setupMode} onChange={e => setSetupMode(e.target.value)} className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-primary-500">
                <option value="STANDARD">Standard Match</option>
                <option value="WINNER_STAYS">Winner Stays</option>
              </select>
            </div>
            {setupMode === 'WINNER_STAYS' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Number of Teams</label>
                <select value={setupNumTeams} onChange={e => setSetupNumTeams(parseInt(e.target.value))} className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-primary-500">
                  <option value={3}>3 Teams</option>
                  <option value={4}>4 Teams</option>
                  <option value={5}>5 Teams</option>
                </select>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-white/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Select Captains</h3>
              <div className="flex items-center gap-2 bg-neutral-900/50 px-4 py-2 rounded-xl border border-white/5">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">Single Device Mode (Admin Picks)</label>
                <input type="checkbox" checked={singleDeviceMode} onChange={e => setSingleDeviceMode(e.target.checked)} className="w-5 h-5 rounded bg-neutral-900 border-white/10 text-primary-500 focus:ring-primary-500" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {players.map(p => {
                const isSelected = selectedCaptainIds.includes(p.id);
                return (
                  <button 
                    key={p.id}
                    onClick={() => toggleCaptain(p.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all border ${isSelected ? 'bg-primary-500/20 border-primary-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-neutral-900/50 border-white/5 text-neutral-400 hover:border-white/20'}`}
                  >
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.username} className="w-12 h-12 rounded-full mb-3 object-cover shadow-lg" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-3 shadow-lg">
                        <Users className="w-5 h-5 opacity-50" />
                      </div>
                    )}
                    <span className="text-xs font-bold truncate w-full text-center">{p.username}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          <button 
            onClick={startDraft}
            disabled={isStarting}
            className="w-full bg-primary-500 text-black px-8 py-5 rounded-2xl font-black text-sm tracking-widest uppercase hover:bg-primary-400 transition-all hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <Shuffle className="w-5 h-5" />
            {isStarting ? 'Starting...' : 'Randomize Order & Start Draft'}
          </button>
        </div>
      </div>
    );
  }

  const teamColors = [
    { border: 'border-primary-500', bg: 'bg-primary-500/10', text: 'text-primary-400', shadow: 'shadow-primary-500/20' },
    { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', shadow: 'shadow-blue-500/20' },
    { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400', shadow: 'shadow-orange-500/20' },
    { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400', shadow: 'shadow-purple-500/20' },
    { border: 'border-pink-500', bg: 'bg-pink-500/10', text: 'text-pink-400', shadow: 'shadow-pink-500/20' }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6 h-full flex flex-col">
      {/* TOP ACTIVE CAPTAIN SECTION */}
      <div className="flex items-center justify-between bg-[#111111] p-3 md:p-4 rounded-2xl border border-white/5 relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative flex flex-col items-center">
            <div className="relative">
              {activeCaptain?.profile?.photo_url ? (
                <img src={activeCaptain.profile.photo_url} alt="Active" className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-black ring-2 ring-orange-500" />
              ) : (
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-neutral-800 border-2 border-black ring-2 ring-orange-500 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 bg-orange-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider">
              Pick {pickNumber + 1}
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-none">On The Clock</p>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-white leading-tight">
              {activeCaptain?.profile?.username || 'Loading...'}
            </h2>
            <p className="text-neutral-500 text-[10px] mt-1.5 leading-none">
              Team {['A','B','C','D','E'][captains.findIndex(c => c.id === activeCaptain?.id)]}
            </p>
          </div>
        </div>

        {profile?.role === 'admin' && (
          <div className="flex flex-col gap-1.5 items-end relative z-10 shrink-0">
            <button onClick={finishDraft} className="bg-transparent border border-white/10 hover:bg-white/5 text-white px-2.5 py-1.5 rounded-lg text-[11px] md:text-xs transition-colors flex items-center justify-center gap-1.5 w-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> <span className="font-bold whitespace-nowrap">Finish Draft</span>
            </button>
            <button onClick={cancelDraft} className="bg-transparent border border-red-500/20 hover:bg-red-500/10 text-red-400 px-2.5 py-1.5 rounded-lg text-[10px] md:text-[11px] transition-colors flex items-center justify-center gap-1.5 w-full">
              <RotateCcw className="w-3 h-3" /> <span className="font-bold whitespace-nowrap">Reset Draft</span>
            </button>
          </div>
        )}
      </div>

      {/* PROGRESS BAR */}
      <div className="px-1 lg:hidden">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">
          <span className="text-primary-500">Pick {pickNumber + 1} of {numCaptains * 4}</span>
          <span>{numCaptains * 4 - pickNumber} Picks Left</span>
        </div>
        <div className="flex gap-1 h-1">
          {Array.from({ length: numCaptains * 4 }).map((_, i) => (
            <div key={i} className={`flex-1 rounded-full ${i < pickNumber ? 'bg-primary-500' : 'bg-neutral-800'}`} />
          ))}
        </div>
      </div>

      {/* TEAMS GRID (MOBILE ONLY) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:hidden gap-2 pb-2">
        {captains.map((cap, index) => {
          const teamPicks = picks.filter(p => p.captain_id === cap.id);
          const isActive = activeCaptain?.id === cap.id;
          const letter = ['A','B','C','D','E'][index];
          
          let titleColor = '';
          if (letter === 'A') titleColor = 'text-primary-500';
          else if (letter === 'B') titleColor = 'text-blue-500';
          else if (letter === 'C') titleColor = 'text-orange-500';
          else if (letter === 'D') titleColor = 'text-purple-500';
          else if (letter === 'E') titleColor = 'text-pink-500';
          return (
            <div key={cap.id} className={`bg-[#0a0a0a] rounded-xl flex flex-col border transition-all ${isActive ? 'border-orange-500/50 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-white/5'}`}>
              <div className="p-2 sm:p-3 flex flex-col items-center">
                <div className="relative mb-2">
                   <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden border border-white/5">
                     {cap.profile?.photo_url ? <img src={cap.profile.photo_url} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-neutral-500" />}
                   </div>
                </div>
                <span className={`text-[10px] font-bold tracking-widest uppercase mb-0.5 ${titleColor}`}>Team {letter}</span>
                <p className="text-white text-xs font-bold flex items-center gap-1">
                  {cap.profile?.username}
                  {isActive && <span className="text-primary-500 text-[8px] font-bold tracking-wider uppercase ml-0.5">- Active</span>}
                </p>
              </div>
              
              <div className="h-px bg-white/5 w-full"></div>
              
              <div className="p-2 space-y-1.5 flex-1 bg-black/20 rounded-b-xl min-h-[120px]">
                {teamPicks.map((pick) => (
                  <div key={pick.id} className="flex items-center justify-between gap-1.5 p-1.5 px-2.5 bg-[#1a1a1a] rounded-lg">
                    <span className="text-[11px] text-neutral-300 font-medium truncate flex-1">{pick.profile?.username}</span>
                    {profile?.role === 'admin' && (
                      <button 
                        onClick={() => removePick(pick.id, pick.pick_number)}
                        className="p-1 -m-1 text-neutral-600 hover:text-red-400 rounded-md transition-colors shrink-0"
                        title="Remove Pick"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* DESKTOP DRAFT ROOM SIDEBAR */}
        <div className="hidden lg:block lg:col-span-1 space-y-6 overflow-y-auto p-4 -m-4 custom-scrollbar">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Draft Room</h1>
              <p className="text-xs sm:text-sm text-neutral-400">Match on {new Date(draft.match_date!).toLocaleDateString()} at {draft.location}</p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm font-medium text-neutral-400 bg-neutral-800/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap">
                Pick {pickNumber + 1}
              </span>
              {profile?.role === 'admin' && (
                <button
                  onClick={cancelDraft}
                  className="bg-neutral-800 hover:bg-red-500/20 text-neutral-300 hover:text-red-400 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all border border-neutral-700/50 hover:border-red-500/50 whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-6">
            {captains.map((cap, index) => {
              const teamPicks = picks.filter(p => p.captain_id === cap.id);
              const color = teamColors[index];
              const isActive = activeCaptain?.id === cap.id;

              return (
                <div key={cap.id} className={`p-3 lg:p-5 rounded-xl lg:rounded-2xl border transition-all duration-300 ${isActive ? `${color.border} ${color.bg} shadow-[0_0_15px_rgba(0,0,0,0.5)] ${color.shadow} scale-[1.02]` : 'bg-black border-white/5 hover:border-white/10'}`}>
                  <div className="flex flex-col xl:flex-row items-center xl:items-start gap-2 lg:gap-3 mb-3 lg:mb-4 pb-3 lg:pb-4 border-b border-white/5 text-center xl:text-left">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 mx-auto xl:mx-0">
                      {cap.profile?.photo_url ? <img src={cap.profile.photo_url} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 lg:w-5 lg:h-5 m-2 lg:m-2.5 text-neutral-500" />}
                    </div>
                    <div className="truncate w-full">
                      <p className={`text-[10px] lg:text-xs font-bold uppercase tracking-widest ${color.text}`}>Team {['A','B','C','D','E'][index]}</p>
                      <p className="text-sm lg:text-base text-white font-bold truncate">{cap.profile?.username} <span className="text-neutral-500 text-[10px] lg:text-xs font-normal">(C)</span></p>
                    </div>
                  </div>
                  <div className="space-y-1.5 lg:space-y-2 min-h-[120px]">
                    <AnimatePresence>
                      {teamPicks.map((pick, pIndex) => (
                        <motion.div 
                          key={pick.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-1.5 lg:gap-2 p-1.5 lg:p-2 bg-neutral-900/50 rounded-lg"
                        >
                          <span className="text-[9px] lg:text-[10px] text-neutral-600 font-black w-3 lg:w-4 text-center shrink-0">{pIndex + 1}</span>
                          {pick.profile?.photo_url ? (
                            <img src={pick.profile.photo_url} className="w-5 h-5 lg:w-6 lg:h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                              <Users className="w-3 h-3 text-neutral-500" />
                            </div>
                          )}
                          <span className="text-xs lg:text-sm text-neutral-300 font-medium truncate flex-1">{pick.profile?.username}</span>
                          {profile?.role === 'admin' && (
                            <button 
                              onClick={() => removePick(pick.id, pick.pick_number)}
                              className="p-1 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                              title="Remove Pick"
                            >
                              <X className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Players Pool */}
        <div className="lg:col-span-3 bg-transparent lg:bg-neutral-900 rounded-none lg:rounded-2xl p-0 lg:p-6 border-0 lg:border lg:border-neutral-800 flex flex-col">
          <div className="flex items-center justify-between mb-4 bg-[#111111] lg:bg-transparent p-3 lg:p-0 rounded-xl">
            <h2 className="text-sm lg:text-xl font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-4 h-4 lg:w-5 lg:h-5 text-neutral-400" /> Available Players
            </h2>
            <span className="bg-neutral-800 text-neutral-300 px-3 py-1 rounded-full text-[10px] lg:text-xs font-bold">
              <span className="text-primary-500">{availablePlayers.length}</span> remaining
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            {!isDraftComplete && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-2 lg:gap-4 pb-10">
              {availablePlayers.map(player => (
                <div
                  key={player.id}
                  onClick={() => makePick(player.id)}
                  className={`bg-[#111111] lg:bg-black p-3 lg:p-4 rounded-xl border flex flex-col items-center gap-3 text-center transition-all cursor-pointer relative ${
                    pendingPickId === player.id 
                    ? 'border-primary-500 bg-primary-500/10 scale-95 opacity-50' 
                    : isMyTurn 
                      ? 'border-white/5 hover:border-primary-500/50 hover:bg-primary-500/5 hover:-translate-y-1' 
                      : 'border-white/5 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
                    {player.photo_url ? (
                      <img src={player.photo_url} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5 lg:w-8 lg:h-8 text-neutral-600" />
                    )}
                  </div>
                  {player.jersey_number && (
                    <div className="absolute top-2 right-2 bg-primary-500 text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {player.jersey_number}
                    </div>
                  )}
                  {pendingPickId === player.id && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {profile?.role === 'admin' && !pendingPickId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHiddenPlayerIds(prev => [...prev, player.id]);
                      }}
                      className="absolute top-2 left-2 w-5 h-5 lg:w-6 lg:h-6 rounded-full border border-neutral-600 text-neutral-400 flex items-center justify-center bg-neutral-900 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-colors z-10"
                      title="Hide Player"
                    >
                      <EyeOff className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                    </button>
                  )}
                  <p className="text-[11px] lg:text-sm font-medium text-white truncate w-full px-1">{player.username}</p>
                  
                  {isMyTurn && !pendingPickId && (
                    <div className="absolute bottom-2 right-2 w-5 h-5 lg:w-6 lg:h-6 rounded-full border border-primary-500 text-primary-500 flex items-center justify-center bg-[#111111] lg:bg-black group-hover:bg-primary-500 group-hover:text-black transition-colors">
                      <Plus className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}

            {!isDraftComplete && isMyTurn && (
              <div className="flex items-center justify-center gap-2 mt-2 mb-6 text-neutral-500 text-xs">
                <span className="w-4 h-4 rounded-full border border-neutral-600 flex items-center justify-center text-[10px] text-neutral-400">i</span>
                Tap a player to add them to <span className="text-orange-500 ml-1">Team {['A','B','C','D','E'][captains.findIndex(c => c.id === activeCaptain?.id)]}</span>
              </div>
            )}
            
            {profile?.role === 'admin' && hiddenPlayers.length > 0 && (
              <div className="mt-8 border-t border-white/5 pt-6 pb-6 px-2">
                <h3 className="text-[10px] lg:text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <EyeOff className="w-4 h-4" /> Hidden Players ({hiddenPlayers.length})
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  {hiddenPlayers.map(player => (
                    <div key={player.id} className="bg-neutral-900 border border-neutral-800 p-2 rounded-xl flex flex-col items-center gap-2 relative">
                      <div className="w-8 h-8 rounded-full bg-black overflow-hidden border border-white/5">
                        {player.photo_url ? <img src={player.photo_url} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 m-2 text-neutral-600" />}
                      </div>
                      <p className="text-[9px] text-neutral-400 truncate w-full text-center">{player.username}</p>
                      <button
                        onClick={() => setHiddenPlayerIds(prev => prev.filter(id => id !== player.id))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-neutral-800 border border-neutral-500 rounded-full flex items-center justify-center text-neutral-300 hover:bg-primary-500/20 hover:text-primary-500 hover:border-primary-500 transition-colors z-10"
                        title="Unhide Player"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {isDraftComplete && (
              <div className="py-12 lg:py-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-neutral-800/50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-neutral-500" />
                </div>
                <p className="text-lg lg:text-xl font-bold text-white mb-2">Draft Complete!</p>
                <p className="text-sm lg:text-base text-neutral-400 max-w-md">The teams are full (5 players per team). The admin can now finish the draft and create the match.</p>
                {profile?.role === 'admin' && (
                  <button onClick={finishDraft} className="mt-6 bg-primary-500 text-black px-6 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-primary-400 transition-colors">
                    Finish Draft
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
