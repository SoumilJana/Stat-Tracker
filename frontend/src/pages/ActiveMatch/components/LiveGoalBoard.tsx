import { Fragment, useContext } from 'react';
import { Undo2, Repeat } from 'lucide-react';
import { ConfirmContext } from '../../../contexts/ConfirmContext';

/**
 * Compact live board for standard and 7v7 matches: both teams side by side,
 * each with its score on top. Admins tap a name to record a goal (the assist /
 * own goal prompt opens), and can undo the last goal from below the board.
 */
export interface LiveGoalBoardProps {
  session: any;
  profile: any;
  teamA: any;
  teamB: any;
  teamPlayers: Record<string, any[]>;
  teamScores: Record<string, number>;
  goalAnim?: { teamId: string; id: number } | null;
  events: any[];
  waiting: any[];
  onInitiateGoal: (playerId: string, teamId: string, playersList: any[]) => void;
  onSwapTeam: (teamId: string) => void;
  onUndoEvent?: (eventId: string) => void;
}

const STARTERS_7V7 = 7;

export function playerMatchStats(events: any[], playerId: string) {
  let goals = 0;
  let assists = 0;
  let ownGoals = 0;
  for (const e of events || []) {
    if (!e || e.event_type !== 'GOAL') continue;
    if (e.player_id === playerId) {
      if (e.is_own_goal) ownGoals++;
      else goals++;
    }
    if (e.assisted_by === playerId) assists++;
  }
  return { goals, assists, ownGoals };
}

export function LiveGoalBoard({
  session,
  profile,
  teamA,
  teamB,
  teamPlayers,
  teamScores,
  goalAnim,
  events,
  waiting,
  onInitiateGoal,
  onSwapTeam,
  onUndoEvent
}: LiveGoalBoardProps) {
  const confirmCtx = useContext(ConfirmContext);
  const isAdmin = profile?.role === 'admin';
  const canScore = isAdmin && session?.status === 'IN_PROGRESS';
  const is7v7 = session?.mode === 'SPECIAL_7V7';

  const allPlayers = Object.values(teamPlayers || {}).flat();
  const lastEvent = events?.[0];
  const lastGoal = lastEvent?.event_type === 'GOAL' ? lastEvent : null;
  const lastGoalName =
    lastGoal &&
    (lastGoal.player?.username ||
      lastGoal.profiles?.username ||
      allPlayers.find((p) => p.id === lastGoal.player_id)?.username ||
      'player');

  const handleUndo = async () => {
    if (!lastGoal || !onUndoEvent) return;
    const message = `Remove ${lastGoalName}'s goal${lastGoal.is_own_goal ? ' (own goal)' : ''}?`;
    const ok = confirmCtx
      ? await confirmCtx.confirm({
          title: 'Undo last goal?',
          description: message,
          confirmText: 'Undo Goal',
          variant: 'danger',
          isDestructive: true
        })
      : window.confirm(message);
    if (ok) onUndoEvent(lastGoal.id);
  };

  const renderColumn = (team: any, side: 'A' | 'B') => {
    const players = teamPlayers[team?.id] || [];
    const accent = side === 'A' ? 'text-primary-400' : 'text-blue-400';
    const rowHover = side === 'A' ? 'hover:border-primary-500/50 active:bg-primary-900/40' : 'hover:border-blue-500/50 active:bg-blue-900/40';
    const animColor = side === 'A' ? 'text-primary-400' : 'text-blue-400';

    return (
      <div className="min-w-0 flex flex-col" data-testid={`live-column-${side}`}>
        {/* Team name + score */}
        <div className="flex items-center justify-between gap-1 px-1 pb-2 mb-2 border-b border-white/10">
          <div className="min-w-0">
            <h4 className={`${accent} font-bold uppercase tracking-wider text-xs truncate`}>{team?.name}</h4>
            {canScore && waiting.length > 0 && (
              <button
                type="button"
                onClick={() => onSwapTeam(team.id)}
                className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-400 hover:text-white"
                title="Swap this team out for the next waiting team"
              >
                <Repeat className="w-3 h-3" />
                Swap Out
              </button>
            )}
          </div>
          <div
            className="relative text-3xl font-black text-white tabular-nums leading-none shrink-0"
            aria-label={`${team?.name} score`}
          >
            {teamScores[team?.id] || 0}
            {goalAnim?.teamId === team?.id && (
              <span
                key={goalAnim?.id}
                className={`absolute -top-3 -right-4 text-lg font-black ${animColor} animate-float-up pointer-events-none`}
              >
                +1
              </span>
            )}
          </div>
        </div>

        {/* Players */}
        <div className="space-y-1.5">
          {players.map((player, index) => {
            const { goals, assists, ownGoals } = playerMatchStats(events, player.id);
            return (
              <Fragment key={player.id}>
                {is7v7 && players.length > STARTERS_7V7 && index === STARTERS_7V7 && (
                  <div className="pt-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/80 border-t border-white/10">
                    Substitutes ({players.length - STARTERS_7V7})
                  </div>
                )}
                <button
                  type="button"
                  disabled={!canScore}
                  onClick={() => onInitiateGoal(player.id, team.id, players)}
                  aria-label={canScore ? `Record goal for ${player.username}` : player.username}
                  className={`w-full min-h-[44px] flex items-center justify-between gap-1 px-2.5 py-2 bg-neutral-900/70 border border-white/5 rounded-xl text-left transition-all ${
                    canScore ? `${rowHover} active:scale-[0.97] cursor-pointer` : 'cursor-default'
                  }`}
                >
                  <span className="text-sm font-semibold text-white truncate min-w-0">{player.username}</span>
                  <span className="flex items-center gap-1 shrink-0 text-[10px] font-black">
                    {goals > 0 && (
                      <span className="px-1 py-0.5 rounded bg-white/10 text-white" title={`${goals} goals`}>
                        ⚽{goals}
                      </span>
                    )}
                    {assists > 0 && (
                      <span className="px-1 py-0.5 rounded bg-blue-500/15 text-blue-300" title={`${assists} assists`}>
                        {assists}A
                      </span>
                    )}
                    {ownGoals > 0 && (
                      <span className="px-1 py-0.5 rounded bg-rose-500/15 text-rose-300" title={`${ownGoals} own goals`}>
                        {ownGoals}OG
                      </span>
                    )}
                  </span>
                </button>
              </Fragment>
            );
          })}
          {players.length === 0 && <p className="text-xs text-neutral-500 px-1 py-3">No players</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="bg-black border border-white/10 rounded-2xl p-3 shadow-lg">
        {is7v7 && (
          <div className="text-center mb-2">
            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              7v7 Special
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {renderColumn(teamA, 'A')}
          {renderColumn(teamB, 'B')}
        </div>
        {canScore && (
          <p className="text-center text-[10px] text-neutral-500 mt-3">Tap a player to record a goal</p>
        )}
      </div>

      {canScore && lastGoal && onUndoEvent && (
        <button
          type="button"
          onClick={handleUndo}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 border border-white/10 text-sm font-semibold text-neutral-300 hover:text-white hover:border-red-500/40 active:scale-[0.98] transition-all"
        >
          <Undo2 className="w-4 h-4" />
          Undo last goal ({lastGoalName})
        </button>
      )}
    </div>
  );
}
