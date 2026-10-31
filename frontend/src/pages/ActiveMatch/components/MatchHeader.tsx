import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Activity, Copy, Check, Share2, CloudOff, RefreshCw } from 'lucide-react';

interface MatchHeaderProps {
  session: any;
  profile: any;
  teamScores: Record<string, number>;
  onPitch: any[];
  waiting: any[];
  teamPlayers: Record<string, any[]>;
  events: any[];
  pollVotes: any[];
  bibColors: Record<string, string>;
  isOffline: boolean;
  isSyncing: boolean;
  onOpenEdit: () => void;
  onDeleteMatch: () => void;
  onOpenBulk: () => void;
}

export function MatchHeader({
  session,
  profile,
  teamScores,
  onPitch,
  waiting,
  teamPlayers,
  events,
  pollVotes,
  bibColors,
  isOffline,
  isSyncing,
  onOpenEdit,
  onDeleteMatch,
  onOpenBulk
}: MatchHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [statsCopied, setStatsCopied] = useState(false);

  const copyStats = () => {
    if (!session) return;

    if (session.status !== 'COMPLETED') {
      let text = `Match - ${new Date(session.date).toLocaleDateString()}\n`;
      if (session.location) text += `Location: ${session.location}\n`;
      text += `Time: ${new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;

      const allTeams = [...Object.values(onPitch), ...waiting];

      allTeams
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(team => {
          const players = teamPlayers[team.id];
          if (!players || players.length === 0) return;

          const bibColor = bibColors[team.id] ? ` (${bibColors[team.id]})` : '';
          text += `\n${team.name}${bibColor}\n`;
          text += `Captain: ${players[0].username}\n`;
          if (players.length > 1) {
            players.slice(1).forEach((p, index) => {
              text += `${index + 1}. ${p.username}\n`;
            });
          }
        });

      navigator.clipboard.writeText(text);
      setStatsCopied(true);
      setTimeout(() => setStatsCopied(false), 2000);
      return;
    }

    let text = `Match Day Stats - ${new Date(session.date).toLocaleDateString()}\n`;
    if (session.location) text += `Location: ${session.location}\n`;
    text += `\n--- Match Day Tally ---\n`;

    let matchWinner: any = null;
    let maxScore = -1;
    Object.entries(teamScores).forEach(([tId, score]) => {
      if (score > maxScore) {
        maxScore = score;
        matchWinner = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
      }
    });

    Object.entries(teamScores).forEach(([tId, score]) => {
      const t = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
      if (t) {
        text += `${t.name.replace('Team ', '')}: ${score}\n`;
      }
    });

    text += `\n--- Player Stats ---\n`;
    const teams = Object.keys(teamPlayers)
      .map(tId => Object.values(onPitch).concat(waiting).find(t => t.id === tId))
      .filter(Boolean);
    teams.sort((a, b) => {
      if (matchWinner && a?.id === matchWinner.id) return -1;
      if (matchWinner && b?.id === matchWinner.id) return 1;
      return 0;
    });

    teams.forEach(team => {
      if (!team) return;
      const players = teamPlayers[team.id];
      if (!players) return;

      const isWinner = matchWinner && team.id === matchWinner.id;
      let hasStats = false;
      let teamText = isWinner ? `\n🏆 WINNER: ${team.name} 🏆\n` : `\n${team.name}:\n`;

      players.forEach(player => {
        const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
        const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;

        if (pGoals > 0 || pAssists > 0 || isWinner) {
          hasStats = true;
          teamText += `- ${player.username}`;
          const stats = [];
          if (pGoals > 0) stats.push(`${pGoals} G`);
          if (pAssists > 0) stats.push(`${pAssists} A`);
          if (stats.length > 0) {
            teamText += `: ${stats.join(', ')}`;
          }
          teamText += '\n';
        }
      });
      if (hasStats) {
        text += teamText;
      }
    });

    let topScorerName = 'N/A';
    let topScorerGoals = 0;
    let topScorerAssists = 0;

    let topAssisterName = 'N/A';
    let topAssisterAssists = 0;
    let topAssisterGoals = 0;

    Object.values(teamPlayers)
      .flat()
      .forEach(player => {
        const pGoals = events.filter(e => e.event_type === 'GOAL' && e.player_id === player.id).length;
        const pAssists = events.filter(e => e.event_type === 'GOAL' && e.assisted_by === player.id).length;

        if (pGoals > topScorerGoals || (pGoals === topScorerGoals && pGoals > 0 && pAssists > topScorerAssists)) {
          topScorerGoals = pGoals;
          topScorerAssists = pAssists;
          topScorerName = player.username;
        }

        if (pAssists > topAssisterAssists || (pAssists === topAssisterAssists && pAssists > 0 && pGoals > topAssisterGoals)) {
          topAssisterAssists = pAssists;
          topAssisterGoals = pGoals;
          topAssisterName = player.username;
        }
      });

    const getAwardWinner = (awardType: string) => {
      const votes = pollVotes.filter(v => v.award_type === awardType);
      const counts: Record<string, number> = {};
      votes.forEach(v => (counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1));
      let maxId: string | null = null;
      let maxVotes = 0;
      Object.entries(counts).forEach(([id, c]) => {
        if (c > maxVotes) {
          maxVotes = c;
          maxId = id;
        }
      });
      if (!maxId) return null;
      return Object.values(teamPlayers).flat().find(p => p.id === maxId)?.username;
    };

    const bestGk = getAwardWinner('BEST_GK');
    const bestDef = getAwardWinner('BEST_DEFENDER');

    text += `\n--- Highlights ---\n`;
    if (topScorerGoals > 0) text += `Top Scorer: ${topScorerName} (${topScorerGoals}G)\n`;
    if (topAssisterAssists > 0) text += `Top Assister: ${topAssisterName} (${topAssisterAssists}A)\n`;
    if (bestGk) text += `Best GK: ${bestGk}\n`;
    if (bestDef) text += `Best Defender: ${bestDef}\n`;

    navigator.clipboard.writeText(text);
    setStatsCopied(true);
    setTimeout(() => setStatsCopied(false), 2000);
  };

  return (
    <>
      {/* Offline Indicators */}
      {isOffline && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 mb-2 sm:mb-4 animate-pulse">
          <CloudOff className="w-4 h-4 sm:w-5 h-5 shrink-0" />
          <span>Offline Mode. Goals will be saved locally and synced later.</span>
        </div>
      )}
      {isSyncing && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 mb-2 sm:mb-4">
          <RefreshCw className="w-4 h-4 sm:w-5 h-5 animate-spin shrink-0" />
          <span>Syncing offline goals to database...</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 mb-2 md:mb-6 min-h-[40px] sm:min-h-[48px]">
        <Link
          to="/matches"
          className="p-1 sm:p-0 text-neutral-400 hover:text-white flex items-center gap-1.5 sm:gap-2 transition-colors shrink-0"
          title="Back to Matches"
          aria-label="Back to Matches"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 h-5" />
          <span className="hidden sm:inline text-sm font-medium">Back to Matches</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
          {profile?.role === 'admin' && (
            <>
              <button
                onClick={onOpenEdit}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20 border border-neutral-500/20 transition-colors flex items-center gap-1.5 shrink-0"
                title="Edit Match"
                aria-label="Edit Match"
              >
                <Edit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={onDeleteMatch}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors flex items-center gap-1.5 shrink-0"
                title="Delete Match"
                aria-label="Delete Match"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
              <button
                onClick={onOpenBulk}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors flex items-center gap-1.5 shrink-0"
                title="Bulk Import Stats"
                aria-label="Bulk Import Stats"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bulk</span>
              </button>
            </>
          )}
          <button
            onClick={copyStats}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 border border-primary-500/20 transition-colors flex items-center gap-1.5 shrink-0"
            title={session?.status === 'COMPLETED' ? 'Copy Match Stats' : 'Copy Teams'}
            aria-label={session?.status === 'COMPLETED' ? 'Copy Match Stats' : 'Copy Teams'}
          >
            {statsCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {statsCopied ? 'Copied!' : session?.status === 'COMPLETED' ? 'Copy Stats' : 'Copy Teams'}
            </span>
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-colors flex items-center gap-1.5 shrink-0"
            title="Share Match Link"
            aria-label="Share Match Link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary-500" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
          <div
            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest whitespace-nowrap shrink-0 ${
              session?.status === 'IN_PROGRESS'
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                : session?.status === 'SCHEDULED'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}
          >
            {session?.status ? session.status.replace('_', ' ') : 'UNKNOWN'}
          </div>
        </div>
      </div>

      {/* Match Day Tallies Header */}
      <div className="flex justify-center mb-2 md:mb-6">
        <div className="bg-black/90 border border-white/10 rounded-full px-3 py-1 sm:px-6 sm:py-2.5 flex items-center gap-2 sm:gap-6 text-[11px] sm:text-sm shadow-md overflow-x-auto max-w-full">
          <span className="text-neutral-500 font-bold tracking-wider sm:tracking-widest uppercase text-[10px] sm:text-xs shrink-0">
            Tally:
          </span>
          {Object.entries(teamScores).map(([tId, score]) => {
            const t = Object.values(onPitch).concat(waiting).find(item => item.id === tId);
            return t ? (
              <div key={tId} className="flex items-center gap-1 font-bold shrink-0">
                <span className={onPitch.find(p => p.id === tId) ? 'text-primary-400' : 'text-neutral-500'}>
                  {t.name.replace('Team ', '')}
                </span>
                <span className="text-white">{score}</span>
              </div>
            ) : null;
          })}
        </div>
      </div>
    </>
  );
}
