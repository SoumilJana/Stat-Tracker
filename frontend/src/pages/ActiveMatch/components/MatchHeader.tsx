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
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-6 animate-pulse">
          <CloudOff className="w-5 h-5" />
          Offline Mode. Goals will be saved locally and synced later.
        </div>
      )}
      {isSyncing && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-6">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Syncing offline goals to database...
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between mb-8">
        <Link to="/matches" className="text-neutral-400 hover:text-white flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back to Matches</span>
        </Link>
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <>
              <button
                onClick={onOpenEdit}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20 border border-neutral-500/20 transition-colors"
                title="Edit Match"
              >
                <Edit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={onDeleteMatch}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                title="Delete Match"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
              <button
                onClick={onOpenBulk}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                title="Bulk Import Stats"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bulk</span>
              </button>
            </>
          )}
          <button
            onClick={copyStats}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 border border-primary-500/20 transition-colors"
            title={session?.status === 'COMPLETED' ? 'Copy Match Stats' : 'Copy Teams'}
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary-500" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
              session.status === 'IN_PROGRESS'
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                : session.status === 'SCHEDULED'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}
          >
            {session.status.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Match Day Tallies Header */}
      <div className="flex justify-center mb-6">
        <div className="bg-black border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 text-sm shadow-lg">
          <span className="text-neutral-500 font-bold tracking-widest uppercase">Match Day Tally:</span>
          {Object.entries(teamScores).map(([tId, score]) => {
            const t = Object.values(onPitch).concat(waiting).find(item => item.id === tId);
            return t ? (
              <div key={tId} className="flex items-center gap-1 font-bold">
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
