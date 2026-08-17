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
  
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [teamC, setTeamC] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [matchCreated, setMatchCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('*').order('username').then(({ data }) => {
      if (data) setPlayers(data);
    });
  }, []);

  // When mode changes to standard, clear team C
  useEffect(() => {
    if (mode === 'STANDARD') {
      setTeamC([]);
    }
  }, [mode]);

  const togglePlayer = (team: 'A' | 'B' | 'C', playerId: string) => {
    if (team === 'A') {
      if (teamA.includes(playerId)) setTeamA(prev => prev.filter(id => id !== playerId));
      else {
        setTeamA(prev => [...prev, playerId]);
        setTeamB(prev => prev.filter(id => id !== playerId));
        setTeamC(prev => prev.filter(id => id !== playerId));
      }
    } else if (team === 'B') {
      if (teamB.includes(playerId)) setTeamB(prev => prev.filter(id => id !== playerId));
      else {
        setTeamB(prev => [...prev, playerId]);
        setTeamA(prev => prev.filter(id => id !== playerId));
        setTeamC(prev => prev.filter(id => id !== playerId));
      }
    } else if (team === 'C') {
      if (teamC.includes(playerId)) setTeamC(prev => prev.filter(id => id !== playerId));
      else {
        setTeamC(prev => [...prev, playerId]);
        setTeamA(prev => prev.filter(id => id !== playerId));
        setTeamB(prev => prev.filter(id => id !== playerId));
      }
    }
  };

  const startMatch = async () => {
    if (teamA.length === 0 || teamB.length === 0) {
      alert("Team A and Team B need at least 1 player");
      return;
    }
    if (mode === 'WINNER_STAYS' && teamC.length === 0) {
      alert("Team C needs at least 1 player for Winner Stays");
      return;
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
      }

      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .insert(teamsToInsert)
        .select();

      if (teamsError) throw teamsError;

      const teamAId = teams[0].id;
      const teamBId = teams[1].id;
      const teamCId = mode === 'WINNER_STAYS' ? teams[2].id : null;

      // 3. Assign Players to Teams
      const teamPlayersData = [
        ...teamA.map(playerId => ({ team_id: teamAId, player_id: playerId })),
        ...teamB.map(playerId => ({ team_id: teamBId, player_id: playerId }))
      ];
      
      if (mode === 'WINNER_STAYS' && teamCId) {
        teamPlayersData.push(...teamC.map(playerId => ({ team_id: teamCId, player_id: playerId })));
      }

      const { error: tpError } = await supabase.from('team_players').insert(teamPlayersData);
      if (tpError) throw tpError;

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
        </div>

        <div className="pt-6 border-t border-white/5">
          <h3 className="text-xl font-bold text-white mb-6 tracking-widest uppercase">Assign Teams</h3>
          <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${mode === 'WINNER_STAYS' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            
            {/* Team A */}
            <div className="space-y-3 p-5 bg-black border border-primary-500/20 rounded-2xl shadow-lg shadow-primary-900/10">
              <h4 className="font-bold text-primary-400 flex items-center justify-between uppercase tracking-widest text-sm mb-4">
                Team A <span className="bg-primary-500/20 text-primary-400 px-3 py-1 rounded-full text-[10px]">{teamA.length} Players</span>
              </h4>
              <div className="space-y-2">
                {players.map(p => {
                  const isSelected = teamA.includes(p.id);
                  const isAssignedElsewhere = teamB.includes(p.id) || teamC.includes(p.id);
                  const isTeamFull = teamA.length >= 5;
                  const isDisabled = isAssignedElsewhere || (isTeamFull && !isSelected);

                  return (
                    <label key={`A-${p.id}`} className={`flex items-center justify-between p-3 rounded-xl transition-all border border-transparent ${isDisabled ? 'opacity-40 cursor-not-allowed bg-black' : isSelected ? 'bg-primary-500/10 border-primary-500/30' : 'bg-neutral-900/50 border-white/5 hover:bg-primary-900/20 hover:border-primary-500/30 cursor-pointer'}`}>
                      <span className={`font-medium text-sm ${isDisabled ? 'text-neutral-500' : isSelected ? 'text-white' : 'text-neutral-300'}`}>{p.username}</span>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => togglePlayer('A', p.id)}
                        className="w-5 h-5 rounded-md border-white/10 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 focus:ring-offset-transparent bg-black disabled:opacity-50"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Team B */}
            <div className="space-y-3 p-5 bg-black border border-blue-500/20 rounded-2xl shadow-lg shadow-blue-900/10">
              <h4 className="font-bold text-blue-400 flex items-center justify-between uppercase tracking-widest text-sm mb-4">
                Team B <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[10px]">{teamB.length} Players</span>
              </h4>
              <div className="space-y-2">
                {players.map(p => {
                  const isSelected = teamB.includes(p.id);
                  const isAssignedElsewhere = teamA.includes(p.id) || teamC.includes(p.id);
                  const isTeamFull = teamB.length >= 5;
                  const isDisabled = isAssignedElsewhere || (isTeamFull && !isSelected);

                  return (
                    <label key={`B-${p.id}`} className={`flex items-center justify-between p-3 rounded-xl transition-all border border-transparent ${isDisabled ? 'opacity-40 cursor-not-allowed bg-black' : isSelected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-neutral-900/50 border-white/5 hover:bg-blue-900/20 hover:border-blue-500/30 cursor-pointer'}`}>
                      <span className={`font-medium text-sm ${isDisabled ? 'text-neutral-500' : isSelected ? 'text-white' : 'text-neutral-300'}`}>{p.username}</span>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => togglePlayer('B', p.id)}
                        className="w-5 h-5 rounded-md border-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-transparent bg-black disabled:opacity-50"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Team C */}
            {mode === 'WINNER_STAYS' && (
              <div className="space-y-3 p-5 bg-black border border-orange-500/20 rounded-2xl shadow-lg shadow-orange-900/10">
                <h4 className="font-bold text-orange-400 flex items-center justify-between uppercase tracking-widest text-sm mb-4">
                  Team C <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-[10px]">{teamC.length} Players</span>
                </h4>
                <div className="space-y-2">
                  {players.map(p => {
                    const isSelected = teamC.includes(p.id);
                    const isAssignedElsewhere = teamA.includes(p.id) || teamB.includes(p.id);
                    const isTeamFull = teamC.length >= 5;
                    const isDisabled = isAssignedElsewhere || (isTeamFull && !isSelected);

                    return (
                      <label key={`C-${p.id}`} className={`flex items-center justify-between p-3 rounded-xl transition-all border border-transparent ${isDisabled ? 'opacity-40 cursor-not-allowed bg-black' : isSelected ? 'bg-orange-500/10 border-orange-500/30' : 'bg-neutral-900/50 border-white/5 hover:bg-orange-900/20 hover:border-orange-500/30 cursor-pointer'}`}>
                        <span className={`font-medium text-sm ${isDisabled ? 'text-neutral-500' : isSelected ? 'text-white' : 'text-neutral-300'}`}>{p.username}</span>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => togglePlayer('C', p.id)}
                          className="w-5 h-5 rounded-md border-white/10 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 focus:ring-offset-transparent bg-black disabled:opacity-50"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

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
