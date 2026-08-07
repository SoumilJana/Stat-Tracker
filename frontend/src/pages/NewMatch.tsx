import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function NewMatch() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('STANDARD');
  
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [teamC, setTeamC] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
          date: new Date(date).toISOString() 
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

      // Navigate to matches list
      navigate(`/matches`);

    } catch (e: any) {
      console.error(e);
      alert(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div>
        <h2 className="text-2xl font-bold text-white">Start New Match</h2>
        <p className="mt-1 text-sm text-neutral-400">Set up teams and details to begin.</p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Date</label>
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Location</label>
            <input 
              type="text" 
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
              placeholder="e.g. AstroTurf Arena"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Mode</label>
            <select 
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="STANDARD">Standard Match</option>
              <option value="WINNER_STAYS">Winner Stays</option>
            </select>
          </div>
        </div>

        <div className="pt-4">
          <h3 className="text-lg font-bold text-white mb-4">Assign Teams</h3>
          <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${mode === 'WINNER_STAYS' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            
            {/* Team A */}
            <div className="space-y-3 p-4 bg-primary-900/10 border border-primary-900/30 rounded-xl">
              <h4 className="font-bold text-primary-400 flex items-center justify-between">
                Team A <span className="bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full text-xs">{teamA.length} Players</span>
              </h4>
              <div className="space-y-1">
                {players.map(p => {
                  const isSelected = teamA.includes(p.id);
                  const isAssignedElsewhere = teamB.includes(p.id) || teamC.includes(p.id);
                  const isTeamFull = teamA.length >= 5;
                  const isDisabled = isAssignedElsewhere || (isTeamFull && !isSelected);

                  return (
                    <label key={`A-${p.id}`} className={`flex items-center justify-between p-2 rounded-lg transition-colors border border-transparent ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary-900/20 hover:border-primary-900/50 cursor-pointer'}`}>
                      <span className={`font-medium ${isDisabled ? 'text-neutral-500' : 'text-neutral-300'}`}>{p.username}</span>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => togglePlayer('A', p.id)}
                        className="w-5 h-5 rounded border-neutral-600 text-primary-500 focus:ring-primary-500 bg-neutral-900 disabled:opacity-50"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Team B */}
            <div className="space-y-3 p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl">
              <h4 className="font-bold text-blue-400 flex items-center justify-between">
                Team B <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs">{teamB.length} Players</span>
              </h4>
              <div className="space-y-1">
                {players.map(p => {
                  const isSelected = teamB.includes(p.id);
                  const isAssignedElsewhere = teamA.includes(p.id) || teamC.includes(p.id);
                  const isTeamFull = teamB.length >= 5;
                  const isDisabled = isAssignedElsewhere || (isTeamFull && !isSelected);

                  return (
                    <label key={`B-${p.id}`} className={`flex items-center justify-between p-2 rounded-lg transition-colors border border-transparent ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-900/20 hover:border-blue-900/50 cursor-pointer'}`}>
                      <span className={`font-medium ${isDisabled ? 'text-neutral-500' : 'text-neutral-300'}`}>{p.username}</span>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => togglePlayer('B', p.id)}
                        className="w-5 h-5 rounded border-neutral-600 text-blue-500 focus:ring-blue-500 bg-neutral-900 disabled:opacity-50"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Team C */}
            {mode === 'WINNER_STAYS' && (
              <div className="space-y-3 p-4 bg-orange-900/10 border border-orange-900/30 rounded-xl">
                <h4 className="font-bold text-orange-400 flex items-center justify-between">
                  Team C <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs">{teamC.length} Players</span>
                </h4>
                <div className="space-y-1">
                  {players.map(p => {
                    const isSelected = teamC.includes(p.id);
                    const isAssignedElsewhere = teamA.includes(p.id) || teamB.includes(p.id);
                    const isTeamFull = teamC.length >= 5;
                    const isDisabled = isAssignedElsewhere || (isTeamFull && !isSelected);

                    return (
                      <label key={`C-${p.id}`} className={`flex items-center justify-between p-2 rounded-lg transition-colors border border-transparent ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-orange-900/20 hover:border-orange-900/50 cursor-pointer'}`}>
                        <span className={`font-medium ${isDisabled ? 'text-neutral-500' : 'text-neutral-300'}`}>{p.username}</span>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => togglePlayer('C', p.id)}
                          className="w-5 h-5 rounded border-neutral-600 text-orange-500 focus:ring-orange-500 bg-neutral-900 disabled:opacity-50"
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
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-neutral-900 border-t border-neutral-800 md:relative md:bg-transparent md:border-0 md:p-0 md:flex md:justify-end z-40">
        <button 
          onClick={startMatch}
          disabled={submitting}
          className="w-full md:w-auto bg-primary-500 text-black px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-primary-600 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? 'Scheduling...' : 'Schedule Match'}
        </button>
      </div>
    </div>
  );
}
