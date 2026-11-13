import { Fragment } from 'react';
import { Clock } from 'lucide-react';
import { LiveGoalBoard } from './LiveGoalBoard';
import { MatchDayPanel } from './MatchDayPanel';

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
  /** No longer used here: Winner Stays shows No Goal / Time Up under the live board */
  onRecordTimeUp?: () => void;
  onEndSession: () => void;
  onBibColorChange: (teamId: string, color: string) => void;
  onOpenQueueManager: () => void;
  teamScores?: Record<string, number>;
  goalAnim?: { teamId: string; id: number } | null;
  onUndoEvent?: (eventId: string) => void;
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
  onEndSession,
  onBibColorChange,
  onOpenQueueManager,
  teamScores = {},
  goalAnim = null,
  onUndoEvent
}: PitchBoardProps) {

  return (
    <>
      {/* Waiting queue status for non-Winner-Stays in-progress matches */}
      {session.status === 'IN_PROGRESS' && session.mode !== 'WINNER_STAYS' && waiting.length > 0 && (
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

      {/* Main Pitch Roster & Secondary Actions Area */}
      <div className="lg:col-span-2 space-y-6">
        {session.mode === 'WINNER_STAYS' && session.status === 'IN_PROGRESS' ? (
          /* Winner Stays: teams in play order with bib colours, queue and End Match Day */
          <MatchDayPanel
            profile={profile}
            teamA={teamA}
            teamB={teamB}
            waiting={waiting}
            teamScores={teamScores}
            bibColors={bibColors}
            onBibColorChange={onBibColorChange}
            onOpenQueueManager={onOpenQueueManager}
            onEndSession={onEndSession}
          />
        ) : session.status !== 'IN_PROGRESS' ? (
          /* Scheduled or Completed State: Display all rosters & bib color selections */
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
                    {players.map((player, index) => {
                      const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
                      const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;
                      return (
                        <Fragment key={player.id}>
                          {session.mode === 'SPECIAL_7V7' && players.length > 7 && index === 7 && (
                            <div className="pt-2 pb-1 border-t border-white/10 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-400/80">
                              <span>Substitutes ({players.length - 7})</span>
                            </div>
                          )}
                          <div
                            className="w-full flex items-center justify-between p-3 md:p-4 bg-neutral-900/50 border border-white/5 rounded-xl shadow-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-white font-medium text-left truncate">{player.username}</span>
                              {session.mode === 'SPECIAL_7V7' && (
                                <span
                                  className={`shrink-0 ${
                                    index < 7
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded'
                                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded'
                                  }`}
                                >
                                  {index < 7 ? 'Starter' : 'Sub'}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-3 shrink-0">
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
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Standard / 7v7 IN_PROGRESS: compact side-by-side board */
          <LiveGoalBoard
            session={session}
            profile={profile}
            teamA={teamA}
            teamB={teamB}
            teamPlayers={teamPlayers}
            teamScores={teamScores}
            goalAnim={goalAnim}
            events={events}
            waiting={waiting}
            onInitiateGoal={onInitiateGoal}
            onSwapTeam={onSwapTeam}
            onUndoEvent={onUndoEvent}
          />
        )}

        {/* Action bar for standard Non-Winner-Stays mode when in progress */}
        {session.mode !== 'WINNER_STAYS' && session.status === 'IN_PROGRESS' && profile?.role === 'admin' && (
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-neutral-800">
            <button
              onClick={onEndSession}
              className="bg-red-500/10 text-red-400 border border-red-500/30 px-8 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-colors w-full sm:w-auto sm:ml-auto cursor-pointer"
            >
              END MATCH DAY
            </button>
          </div>
        )}
      </div>
    </>
  );
}
