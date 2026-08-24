import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Copy, CheckCircle2, ArrowRight } from 'lucide-react';

export default function NewMatch() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('19:00');
  const [mode, setMode] = useState('STANDARD');
  const [numTeams, setNumTeams] = useState(3);
  
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [teamC, setTeamC] = useState<string[]>([]);
  const [teamD, setTeamD] = useState<string[]>([]);
  const [teamE, setTeamE] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [matchCreated, setMatchCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('*').order('username').then(({ data }) => {
      if (data) setPlayers(data);
    });
  }, []);

  // When mode or numTeams changes, clear unused teams
  useEffect(() => {
    if (mode === 'STANDARD') {
      setTeamC([]);
      setTeamD([]);
      setTeamE([]);
    } else {
      if (numTeams < 4) setTeamD([]);
      if (numTeams < 5) setTeamE([]);
    }
  }, [mode, numTeams]);

  const togglePlayer = (team: 'A' | 'B' | 'C' | 'D' | 'E', playerId: string) => {
    const setters = { A: setTeamA, B: setTeamB, C: setTeamC, D: setTeamD, E: setTeamE };
    const states = { A: teamA, B: teamB, C: teamC, D: teamD, E: teamE };
    
    if (states[team].includes(playerId)) {
      setters[team](prev => prev.filter(id => id !== playerId));
    } else {
      setters[team](prev => [...prev, playerId]);
      // Remove from others
      Object.keys(setters).forEach(key => {
        if (key !== team) {
          setters[key as keyof typeof setters](prev => prev.filter(id => id !== playerId));
        }
      });
    }
  };

  const startMatch = async () => {
    if (teamA.length === 0 || teamB.length === 0) {
      alert("Team A and Team B need at least 1 player");
      return;
    }
    if (mode === 'WINNER_STAYS') {
      if (teamC.length === 0) {
        alert("Team C needs at least 1 player for Winner Stays");
        return;
      }
      if (numTeams >= 4 && teamD.length === 0) {
        alert("Team D needs at least 1 player");
        return;
      }
      if (numTeams === 5 && teamE.length === 0) {
        alert("Team E needs at least 1 player");
        return;
      }
    }

    setSubmitting(true);

    try {
      // 1. Create session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({ 
          location, 
          mode: mode, 
          status: 'SCHEDULED',
          date: new Date(`${date}T${time}:00`).toISOString() 
        })
        .select()
        .single();
      
      if (sessionError) throw sessionError;

      // 2. Create Teams
      const teamsToInsert = [
        { session_id: session.id, name: 'Team A' },
        { session_id: session.id, name: 'Team B' }
      ];
      
      if (mode === 'WINNER_STAYS') {
        teamsToInsert.push({ session_id: session.id, name: 'Team C' });
        if (numTeams >= 4) teamsToInsert.push({ session_id: session.id, name: 'Team D' });
        if (numTeams === 5) teamsToInsert.push({ session_id: session.id, name: 'Team E' });
      }

      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .insert(teamsToInsert)
        .select();

      if (teamsError) throw teamsError;

      // 3. Assign Players to Teams
      const teamPlayersData = [
        ...teamA.map(playerId => ({ team_id: teams[0].id, player_id: playerId })),
        ...teamB.map(playerId => ({ team_id: teams[1].id, player_id: playerId }))
      ];
      
      if (mode === 'WINNER_STAYS') {
        teamPlayersData.push(...teamC.map(playerId => ({ team_id: teams[2].id, player_id: playerId })));
        if (numTeams >= 4) {
          teamPlayersData.push(...teamD.map(playerId => ({ team_id: teams[3].id, player_id: playerId })));
        }
        if (numTeams === 5) {
          teamPlayersData.push(...teamE.map(playerId => ({ team_id: teams[4].id, player_id: playerId })));
        }
      }

      const { error: tpError } = await supabase.from('team_players').insert(teamPlayersData);
      if (tpError) throw tpError;

      // Trigger push notification
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            notificationType: 'MATCH_CREATED',
            sessionId: session.id
          }
        });
      } catch (err) {
        console.error("Failed to send match created notification", err);
      }

      // Show success view
      setMatchCreated(true);

    } catch (e: any) {
      console.error(e);
      alert(e.message);
      setSubmitting(false);
    }
  };

  const getFormattedMatchDetails = () => {
    const formatTeam = (teamName: string, teamIds: string[]) => {
      const playerNames = teamIds.map(id => {
        const player = players.find(p => p.id === id);
        return player ? `• ${player.username}` : '';
      }).join('\n');
      return `**${teamName}**\n${playerNames}`;
    };

    let text = `🏆 *New Match Scheduled!* 🏆\n\n`;
    text += `📅 Date: ${date}\n`;
    text += `⏰ Time: ${time}\n`;
    text += `📍 Location: ${location || 'TBD'}\n`;
    text += `🎯 Mode: ${mode === 'STANDARD' ? 'Standard Match' : 'Winner Stays'}\n\n`;
    
    text += `${formatTeam('Team A', teamA)}\n\n`;
    text += `${formatTeam('Team B', teamB)}`;
    
    if (mode === 'WINNER_STAYS') {
      text += `\n\n${formatTeam('Team C', teamC)}`;
      if (numTeams >= 4) text += `\n\n${formatTeam('Team D', teamD)}`;
      if (numTeams === 5) text += `\n\n${formatTeam('Team E', teamE)}`;
    }

    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFormattedMatchDetails());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (matchCreated) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto pb-24 text-center">
        <div className="bg-black border border-primary-500/30 rounded-3xl p-8 sm:p-12 space-y-8 shadow-2xl">
          <div className="w-20 h-20 bg-primary-500/20 text-primary-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-widest">Match Scheduled!</h2>
          <p className="text-neutral-400">Your match has been successfully created. Share the details with your players.</p>
          
          <div className="bg-neutral-900/50 p-6 rounded-2xl text-left border border-white/5 whitespace-pre-wrap font-mono text-sm text-neutral-300">
            {getFormattedMatchDetails()}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button 
              onClick={handleCopy}
              className="bg-primary-500 text-black px-8 py-4 rounded-full font-black text-sm tracking-widest uppercase hover:bg-primary-400 transition-all flex items-center justify-center gap-2"
            >
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy Details'}
            </button>
            <button 
              onClick={() => navigate('/matches')}
              className="bg-white/5 text-white border border-white/10 px-8 py-4 rounded-full font-black text-sm tracking-widest uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              Go to Matches
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div>
        <h2 className="text-2xl font-bold text-white">Start New Match</h2>
        <p className="mt-1 text-sm text-neutral-400">Set up teams and details to begin.</p>
      </div>

      <div className="bg-black border border-white/5 rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Date</label>
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Time</label>
            <input 
              type="time" 
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Location</label>
            <input 
              type="text" 
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-neutral-600"
              placeholder="e.g. AstroTurf Arena"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Mode</label>
            <select 
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="STANDARD">Standard Match</option>
              <option value="WINNER_STAYS">Winner Stays</option>
            </select>
          </div>
          {mode === 'WINNER_STAYS' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Number of Teams</label>
              <select 
                value={numTeams}
                onChange={e => setNumTeams(parseInt(e.target.value))}
                className="w-full bg-neutral-900/50 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                <option value={3}>3 Teams</option>
                <option value={4}>4 Teams</option>
                <option value={5}>5 Teams</option>
              </select>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-white/5">
          <h3 className="text-xl font-bold text-white mb-6 tracking-widest uppercase">Assign Teams</h3>
          <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${mode === 'WINNER_STAYS' ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2'}`}>
            {[
              { id: 'A', name: 'Team A', teamArr: teamA, colors: { border: 'border-primary-500/20', shadow: 'shadow-primary-900/10', text: 'text-primary-400', badge: 'bg-primary-500/20 text-primary-400', bgSel: 'bg-primary-500/10 border-primary-500/30', hover: 'hover:bg-primary-900/20 hover:border-primary-500/30', ring: 'text-primary-500 focus:ring-primary-500' } },
              { id: 'B', name: 'Team B', teamArr: teamB, colors: { border: 'border-blue-500/20', shadow: 'shadow-blue-900/10', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400', bgSel: 'bg-blue-500/10 border-blue-500/30', hover: 'hover:bg-blue-900/20 hover:border-blue-500/30', ring: 'text-blue-500 focus:ring-blue-500' } },
              ...(mode === 'WINNER_STAYS' ? [{ id: 'C', name: 'Team C', teamArr: teamC, colors: { border: 'border-orange-500/20', shadow: 'shadow-orange-900/10', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-400', bgSel: 'bg-orange-500/10 border-orange-500/30', hover: 'hover:bg-orange-900/20 hover:border-orange-500/30', ring: 'text-orange-500 focus:ring-orange-500' } }] : []),
              ...(mode === 'WINNER_STAYS' && numTeams >= 4 ? [{ id: 'D', name: 'Team D', teamArr: teamD, colors: { border: 'border-purple-500/20', shadow: 'shadow-purple-900/10', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-400', bgSel: 'bg-purple-500/10 border-purple-500/30', hover: 'hover:bg-purple-900/20 hover:border-purple-500/30', ring: 'text-purple-500 focus:ring-purple-500' } }] : []),
              ...(mode === 'WINNER_STAYS' && numTeams === 5 ? [{ id: 'E', name: 'Team E', teamArr: teamE, colors: { border: 'border-pink-500/20', shadow: 'shadow-pink-900/10', text: 'text-pink-400', badge: 'bg-pink-500/20 text-pink-400', bgSel: 'bg-pink-500/10 border-pink-500/30', hover: 'hover:bg-pink-900/20 hover:border-pink-500/30', ring: 'text-pink-500 focus:ring-pink-500' } }] : [])
            ].map((teamData) => (
              <div key={teamData.id} className={`space-y-3 p-5 bg-black border ${teamData.colors.border} rounded-2xl shadow-lg ${teamData.colors.shadow}`}>
                <h4 className={`font-bold ${teamData.colors.text} flex items-center justify-between uppercase tracking-widest text-sm mb-4`}>
                  {teamData.name} <span className={`${teamData.colors.badge} px-3 py-1 rounded-full text-[10px]`}>{teamData.teamArr.length} Players</span>
                </h4>
                <div className="space-y-2">
                  {players.map(p => {
                    const isSelected = teamData.teamArr.includes(p.id);
                    const isAssignedElsewhere = [teamA, teamB, teamC, teamD, teamE].some(arr => arr !== teamData.teamArr && arr.includes(p.id));
                    const isTeamFull = teamData.teamArr.length >= 5;
                    const isDisabled = isAssignedElsewhere || (isTeamFull && !isSelected);

                    return (
                      <label key={`${teamData.id}-${p.id}`} className={`flex items-center justify-between p-3 rounded-xl transition-all border border-transparent ${isDisabled ? 'opacity-40 cursor-not-allowed bg-black' : isSelected ? teamData.colors.bgSel : `bg-neutral-900/50 border-white/5 ${teamData.colors.hover} cursor-pointer`}`}>
                        <span className={`font-medium text-sm ${isDisabled ? 'text-neutral-500' : isSelected ? 'text-white' : 'text-neutral-300'}`}>{p.username}</span>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => togglePlayer(teamData.id as any, p.id)}
                          className={`w-5 h-5 rounded-md border-white/10 ${teamData.colors.ring} focus:ring-offset-0 focus:ring-offset-transparent bg-black disabled:opacity-50`}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Fixed bottom action bar for mobile */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/5 md:relative md:bg-transparent md:border-0 md:p-0 md:flex md:justify-end z-40">
        <button 
          onClick={startMatch}
          disabled={submitting}
          className="w-full md:w-auto bg-primary-500 text-black px-8 py-4 rounded-full font-black text-sm tracking-widest uppercase hover:bg-primary-400 transition-all hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          {submitting ? 'Scheduling...' : 'Schedule Match'}
        </button>
      </div>
    </div>
  );
}
