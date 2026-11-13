import { ListOrdered, Flag } from 'lucide-react';

/**
 * Winner Stays "match day" panel, styled like the live board: every team in
 * play order (the two on the pitch, then the queue), each with its bib colour,
 * plus the queue reorder and End Match Day actions for admins.
 */
export interface MatchDayPanelProps {
  profile: any;
  teamA: any;
  teamB: any;
  waiting: any[];
  teamScores: Record<string, number>;
  bibColors: Record<string, string>;
  onBibColorChange: (teamId: string, color: string) => void;
  onOpenQueueManager: () => void;
  onEndSession: () => void;
}

const QUEUE_LABELS = ['Next', '2nd', '3rd'];

export const BIB_COLORS = ['Red', 'Blue', 'Green', 'Black', 'White'] as const;

const BIB_SWATCH: Record<string, string> = {
  Red: 'bg-red-500',
  Blue: 'bg-blue-500',
  Green: 'bg-emerald-500',
  Black: 'bg-neutral-950 ring-1 ring-white/30',
  White: 'bg-white'
};

export function MatchDayPanel({
  profile,
  teamA,
  teamB,
  waiting,
  teamScores,
  bibColors,
  onBibColorChange,
  onOpenQueueManager,
  onEndSession
}: MatchDayPanelProps) {
  const isAdmin = profile?.role === 'admin';

  const rows = [
    { team: teamA, label: 'On pitch', tone: 'text-primary-400 bg-primary-500/10 border-primary-500/20' },
    { team: teamB, label: 'On pitch', tone: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    ...waiting.map((team, i) => ({
      team,
      label: QUEUE_LABELS[i] || `#${i + 1}`,
      tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    }))
  ].filter((r) => r.team);

  return (
    <div className="bg-black border border-white/10 rounded-2xl p-3 shadow-lg" data-testid="match-day-panel">
      <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-white/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">Teams &amp; Queue</h3>
        {isAdmin && waiting.length > 0 && (
          <button
            type="button"
            onClick={onOpenQueueManager}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            Reorder queue
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {rows.map(({ team, label, tone }) => {
          const bib = bibColors[team.id] || '';
          return (
            <div
              key={team.id}
              data-testid={`match-day-team-${team.id}`}
              className="min-h-[44px] flex items-center gap-2 px-2.5 py-1.5 bg-neutral-900/70 border border-white/5 rounded-xl"
            >
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${bib ? BIB_SWATCH[bib] : 'border border-dashed border-white/30'}`}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-white truncate min-w-0 flex-1">{team.name}</span>
              <span className="text-xs font-black text-neutral-300 tabular-nums shrink-0" title="Goals today">
                {teamScores[team.id] || 0}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${tone}`}>
                {label}
              </span>
              {isAdmin ? (
                <select
                  aria-label={`Bib colour for ${team.name}`}
                  className="bg-neutral-800 text-[11px] border border-white/10 rounded-lg px-1.5 py-1 outline-none text-neutral-300 cursor-pointer shrink-0"
                  value={bib}
                  onChange={(e) => onBibColorChange(team.id, e.target.value)}
                >
                  <option value="">No bib</option>
                  {BIB_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                bib && <span className="text-[11px] text-neutral-400 shrink-0">{bib}</span>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <button
          type="button"
          onClick={onEndSession}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-bold text-red-400 hover:bg-red-500/20 active:scale-[0.98] transition-all"
        >
          <Flag className="w-4 h-4" />
          END MATCH DAY
        </button>
      )}
    </div>
  );
}
