import { useState, useEffect } from 'react';

export interface WinnerStaysGoalEntryProps {
  session: any;
  profile: any;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  teamPlayers: Record<string, any[]>;
  events: any[];
  waiting?: any[];
  isSubmitting?: boolean;
  onInitiateGoal: (playerId: string, teamId: string, playersList: any[]) => void;
  onSwapTeam?: (teamId: string) => void;
}

export function WinnerStaysGoalEntry({
  session,
  profile,
  teamA,
  teamB,
  teamPlayers,
  events,
  waiting = [],
  isSubmitting = false,
  onInitiateGoal,
  onSwapTeam
}: WinnerStaysGoalEntryProps) {
  const safeTeamA = teamA || { id: 'team-a', name: 'Team A' };
  const safeTeamB = teamB || { id: 'team-b', name: 'Team B' };

  const [selectedTeamId, setSelectedTeamId] = useState<string>(safeTeamA.id);

  // Auto-heal active team resolution if previously selected team was rotated off-pitch
  const activeTeam =
    safeTeamA.id === selectedTeamId
      ? safeTeamA
      : safeTeamB.id === selectedTeamId
      ? safeTeamB
      : safeTeamA;

  const isTeamA = activeTeam.id === safeTeamA.id;
  const currentPlayers = (teamPlayers && teamPlayers[activeTeam.id]) || [];

  // Sync internal state when rotation changes active pitch teams
  useEffect(() => {
    if (selectedTeamId !== safeTeamA.id && selectedTeamId !== safeTeamB.id) {
      setSelectedTeamId(safeTeamA.id);
    }
  }, [safeTeamA.id, safeTeamB.id, selectedTeamId]);

  const isAdmin = profile?.role === 'admin';
  const isInProgress = session?.status === 'IN_PROGRESS';
  const isGoalActionDisabled = Boolean(isSubmitting) || !isInProgress || !isAdmin;

  // Calculate goal tally per player in current match events
  const getPlayerGoalCount = (playerId: string): number => {
    if (!Array.isArray(events)) return 0;
    return events.filter(
      (e) =>
        e &&
        (e.event_type === 'GOAL' || e.type === 'GOAL') &&
        (e.player_id === playerId || e.playerId === playerId)
    ).length;
  };

  const handleCardClick = (player: any) => {
    if (isGoalActionDisabled) return;
    onInitiateGoal(player.id, activeTeam.id, currentPlayers);
  };

  return (
    <div className="w-full">
      {/* 1. Team Switcher Tabs */}
      <div className="grid grid-cols-2 gap-2 mb-2.5 max-w-2xl mx-auto" role="tablist" aria-label="Team Switcher">
        {/* Team A Tab */}
        <button
          type="button"
          role="tab"
          aria-selected={isTeamA}
          aria-controls={`panel-${safeTeamA.id}`}
          onClick={() => setSelectedTeamId(safeTeamA.id)}
          className={`h-10 sm:h-11 px-3 rounded-xl text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer border ${
            isTeamA
              ? 'bg-primary-500 text-neutral-950 font-black shadow-lg shadow-primary-500/20 border-primary-400'
              : 'bg-neutral-900/80 text-neutral-400 border border-white/5 hover:text-white hover:bg-neutral-800/80'
          }`}
        >
          <span className="truncate">{safeTeamA.name}</span>
        </button>

        {/* Team B Tab */}
        <button
          type="button"
          role="tab"
          aria-selected={!isTeamA}
          aria-controls={`panel-${safeTeamB.id}`}
          onClick={() => setSelectedTeamId(safeTeamB.id)}
          className={`h-10 sm:h-11 px-3 rounded-xl text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer border ${
            !isTeamA
              ? 'bg-blue-500 text-neutral-950 font-black shadow-lg shadow-blue-500/20 border-blue-400'
              : 'bg-neutral-900/80 text-neutral-400 border border-white/5 hover:text-white hover:bg-neutral-800/80'
          }`}
        >
          <span className="truncate">{safeTeamB.name}</span>
        </button>
      </div>

      {/* 2. Responsive 2-Column Player Grid */}
      <div
        id={`panel-${activeTeam.id}`}
        role="tabpanel"
        aria-label={`${activeTeam.name} Roster`}
        className="grid grid-cols-2 gap-2 sm:gap-2.5 max-w-2xl mx-auto"
      >
        {currentPlayers.length === 0 ? (
          <div className="col-span-2 text-center py-5 text-xs text-neutral-500 bg-neutral-900/40 border border-white/5 rounded-xl">
            No players on {activeTeam.name}
          </div>
        ) : (
          currentPlayers.map((player) => {
            const goals = getPlayerGoalCount(player.id);
            const playerName = player.username || player.name || 'Player';

            return (
              <button
                key={player.id}
                type="button"
                disabled={isGoalActionDisabled}
                onClick={() => handleCardClick(player)}
                aria-label={
                  isAdmin && isInProgress
                    ? `Record goal for ${playerName}`
                    : playerName
                }
                data-testid={`player-card-${player.id}`}
                className={`group w-full min-h-[44px] h-12 bg-neutral-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 flex items-center justify-between transition-all active:scale-[0.98] ${
                  isGoalActionDisabled
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : 'hover:border-white/20 hover:bg-neutral-800/80 cursor-pointer'
                }`}
              >
                {/* Left content: Player Name & Goal Pill */}
                <div className="flex items-center gap-1.5 min-w-0 pr-1 text-left">
                  <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[90px] sm:max-w-[130px]">
                    {playerName}
                  </span>
                  {goals > 0 && (
                    <span
                      data-testid={`goal-badge-${player.id}`}
                      className="text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 flex-shrink-0"
                    >
                      {goals}G
                    </span>
                  )}
                </div>

                {/* Right content: Prominent + GOAL Action Pill */}
                {isAdmin && isInProgress && (
                  <span
                    data-testid={`goal-action-${player.id}`}
                    className={`font-black text-xs px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0 transition-colors ${
                      isTeamA
                        ? 'bg-primary-500 text-neutral-950 hover:bg-primary-400 group-hover:bg-primary-400'
                        : 'bg-blue-500 text-neutral-950 hover:bg-blue-400 group-hover:bg-blue-400'
                    }`}
                  >
                    + GOAL
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Optional Below-Grid Team Swap Trigger */}
      {onSwapTeam && waiting && waiting.length > 0 && isAdmin && isInProgress && (
        <div className="flex justify-end max-w-2xl mx-auto mt-2">
          <button
            type="button"
            onClick={() => onSwapTeam(activeTeam.id)}
            disabled={isSubmitting}
            className={`text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/5 transition-colors ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            Swap {activeTeam.name}
          </button>
        </div>
      )}
    </div>
  );
}

export default WinnerStaysGoalEntry;
