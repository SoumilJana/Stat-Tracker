import { Clock, SkipForward } from 'lucide-react';

interface PitchBoardProps {
  session: any;
  profile: any;
  teamA: any;
  teamB: any;
  teamPlayers: Record<string, any[]>;
  waiting: any[];
  bibColors: Record<string, string>;
  events: any[];
  timeOnPitch: Record<string, number>;
  onPitch: any[];
  onInitiateGoal: (playerId: string, teamId: string, playersList: any[]) => void;
  onSwapTeam: (teamId: string) => void;
  onRecordTimeUp: () => void;
  onEndSession: () => void;
  onBibColorChange: (teamId: string, color: string) => void;
  onOpenQueueManager: () => void;
}

export function PitchBoard({
  session,
  profile,
  teamA,
  teamB,
  teamPlayers,
  waiting,
  bibColors,
  events,
  timeOnPitch,
  onPitch,
  onInitiateGoal,
  onSwapTeam,
  onRecordTimeUp,
  onEndSession,
  onBibColorChange,
  onOpenQueueManager
}: PitchBoardProps) {
  const teamAPlayersList = teamPlayers[teamA?.id] || [];
  const teamBPlayersList = teamPlayers[teamB?.id] || [];

  return (
    <>
      {/* Waiting queue status */}
      {session.status === 'IN_PROGRESS' && waiting.length > 0 && (
        <div className="flex flex-col items-center justify-center mb-8 gap-3">
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse">
            <Clock className="w-4 h-4" />
            Waiting: {waiting.map(t => t.name).join(', ')}
          </div>
          {profile?.role === 'admin' && Object.values(timeOnPitch).some(t => t === 0) && (
            <button
              onClick={onOpenQueueManager}
              className="text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors underline"
            >
              Manage Match Order
            </button>
          )}
        </div>
      )}

      {/* Main Pitch Roster Area */}
      <div className="lg:col-span-2 space-y-8">
        {session.status !== 'IN_PROGRESS' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(teamPlayers).map(([tId, players]) => {
              const team = Object.values(onPitch).concat(waiting).find(item => item.id === tId);
              if (!team) return null;

              return (
                <div key={tId} className="bg-black border border-white/5 rounded-2xl p-5 shadow-lg shadow-black/50">
                  <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm flex items-center justify-between">
                    <span>{team.name}</span>
                    {session.status === 'SCHEDULED' && profile?.role === 'admin' && (
                      <select
                        className="bg-neutral-800 text-xs font-normal border border-white/10 rounded px-2 py-1 outline-none text-neutral-300 ml-2"
                        value={bibColors[tId] || ''}
                        onChange={e => onBibColorChange(tId, e.target.value)}
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
                    onClick={() => onSwapTeam(teamA.id)}
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
                    onClick={() => onInitiateGoal(player.id, teamA.id, teamAPlayersList)}
                    className={`w-full flex items-center justify-between p-3 md:p-4 bg-neutral-900/50 border border-white/5 rounded-xl transition-all shadow-sm ${
                      session.status === 'IN_PROGRESS' && profile?.role === 'admin'
                        ? 'hover:bg-primary-900/40 hover:border-primary-500/50 group active:scale-95'
                        : 'disabled:opacity-75 disabled:cursor-default'
                    }`}
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
                    onClick={() => onSwapTeam(teamB.id)}
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
                    onClick={() => onInitiateGoal(player.id, teamB.id, teamBPlayersList)}
                    className={`w-full flex items-center justify-between p-3 md:p-4 bg-neutral-900/50 border border-white/5 rounded-xl transition-all shadow-sm ${
                      session.status === 'IN_PROGRESS' && profile?.role === 'admin'
                        ? 'hover:bg-blue-900/40 hover:border-blue-500/50 group active:scale-95'
                        : 'disabled:opacity-75 disabled:cursor-default'
                    }`}
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
                onClick={onRecordTimeUp}
                className="bg-neutral-800 text-white border border-neutral-700 px-6 py-3 rounded-xl font-medium hover:bg-neutral-700 hover:border-neutral-500 transition-colors w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <SkipForward className="w-5 h-5" />
                No Goal / Time Up
              </button>
            )}

            <button
              onClick={onEndSession}
              className="bg-red-500/10 text-red-400 border border-red-500/30 px-8 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-colors w-full sm:w-auto sm:ml-auto"
            >
              END MATCH DAY
            </button>
          </div>
        )}
      </div>
    </>
  );
}
