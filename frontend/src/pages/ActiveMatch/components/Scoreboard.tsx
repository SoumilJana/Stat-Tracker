interface ScoreboardProps {
  session: any;
  teamA: any;
  teamB: any;
  teamScores: Record<string, number>;
  goalAnim: { teamId: string; id: number } | null;
  pollVotes: any[];
  teamPlayers: Record<string, any[]>;
  profile: any;
  onOpenVoting: (award: 'BEST_DEFENDER' | 'BEST_GK' | 'MOTM') => void;
  onPitch: any[];
  waiting: any[];
}

export function Scoreboard({
  session,
  teamA,
  teamB,
  teamScores,
  goalAnim,
  pollVotes,
  teamPlayers,
  profile,
  onOpenVoting,
  onPitch,
  waiting
}: ScoreboardProps) {
  let winnersOfTheDay: any[] = [];
  let maxScore = -1;
  if (session?.status === 'COMPLETED') {
    Object.entries(teamScores).forEach(([tId, score]) => {
      if (score > maxScore) {
        maxScore = score;
        const winner = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
        winnersOfTheDay = winner ? [winner] : [];
      } else if (score === maxScore && maxScore !== -1) {
        const winner = Object.values(onPitch).concat(waiting).find(t => t.id === tId);
        if (winner) winnersOfTheDay.push(winner);
      }
    });
  }

  return (
    <div className="bg-black border border-white/5 rounded-3xl p-6 md:p-10 mb-8 shadow-2xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-primary-500/5 blur-[100px] rounded-full pointer-events-none" />

      {session.status === 'COMPLETED' ? (
        <div className="flex flex-col items-center justify-center relative z-10 py-4">
          <h2 className="text-xl md:text-2xl font-bold text-neutral-400 mb-2 tracking-widest uppercase">
            {winnersOfTheDay.length > 1 ? 'Match Day Winners (Draw)' : 'Match Day Winner'}
          </h2>
          <div className="text-5xl md:text-7xl font-black text-primary-400 tracking-tighter drop-shadow-lg mb-4 uppercase text-center flex flex-col md:flex-row gap-4 items-center justify-center">
            {winnersOfTheDay.map((winner, idx) => (
              <span key={winner?.id || idx}>
                {winner?.name}
                {idx < winnersOfTheDay.length - 1 && <span className="text-3xl text-neutral-500 mx-4 hidden md:inline">&</span>}
              </span>
            ))}
          </div>
          <div className="text-lg text-white font-bold bg-neutral-800 px-6 py-2 rounded-full border border-neutral-700 mb-8">
            {maxScore} {session.mode === 'WINNER_STAYS' ? 'Wins' : 'Goals'}
          </div>

          {/* Poll Results */}
          <div
            className={`w-full mt-4 grid grid-cols-1 md:grid-cols-${
              new Date(session.date) < new Date('2026-09-06') ? '2' : '3'
            } gap-6`}
          >
            {(new Date(session.date) < new Date('2026-09-06')
              ? ['BEST_DEFENDER', 'BEST_GK']
              : ['BEST_DEFENDER', 'BEST_GK', 'MOTM']
            ).map(award => {
              const isMatchParticipant = profile ? Object.values(teamPlayers).flat().some(p => p.id === profile.id) : false;
              const awardName =
                award === 'BEST_DEFENDER' ? '🛡️ Best Defender' : award === 'BEST_GK' ? '🧤 Best Goalkeeper' : '⭐ Man of the Match';
              const votesForAward = pollVotes.filter(v => v.award_type === award);
              const voteCounts: Record<string, number> = {};
              votesForAward.forEach(v => {
                voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] || 0) + 1;
              });

              let leadingCandidateIds: string[] = [];
              let maxVotes = 0;
              Object.entries(voteCounts).forEach(([cId, count]) => {
                if (count > maxVotes) {
                  maxVotes = count;
                  leadingCandidateIds = [cId];
                } else if (count === maxVotes && maxVotes > 0) {
                  leadingCandidateIds.push(cId);
                }
              });

              const leadingPlayers = leadingCandidateIds
                .map(id => Object.values(teamPlayers).flat().find(p => p.id === id))
                .filter(Boolean);
              const hasVoted = pollVotes.some(v => v.voter_id === profile?.id && v.award_type === award);

              return (
                <div key={award} className="bg-neutral-900/80 border border-white/10 rounded-2xl p-5 text-left relative overflow-hidden">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                    {awardName}
                    {hasVoted && <span className="bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded text-[10px]">VOTED</span>}
                  </h3>

                  {leadingPlayers.length > 0 ? (
                    <div className="flex flex-col gap-2 mb-4">
                      {leadingPlayers.map(player => (
                        <div key={player?.id} className="flex items-center justify-between">
                          <div className="text-2xl font-black text-white">{player?.username}</div>
                          <div className="text-sm font-bold bg-white/10 px-3 py-1 rounded-full text-white">
                            {maxVotes} {maxVotes === 1 ? 'vote' : 'votes'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-neutral-500 italic mb-4">No votes yet</div>
                  )}

                  {isMatchParticipant ? (
                    <button
                      onClick={() => onOpenVoting(award as 'BEST_DEFENDER' | 'BEST_GK' | 'MOTM')}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-colors"
                    >
                      {hasVoted ? 'Change Vote' : 'Cast Vote'}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2 bg-neutral-800 border border-white/5 rounded-xl text-xs font-bold text-neutral-500 cursor-not-allowed"
                    >
                      Only match participants can vote
                    </button>
                  )}

                  {profile?.role === 'admin' && votesForAward.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Admin: Vote Details</div>
                      <ul className="text-xs text-neutral-400 space-y-1 max-h-32 overflow-y-auto pr-1">
                        {votesForAward.map(v => {
                          const candidate = Object.values(teamPlayers).flat().find(p => p.id === v.candidate_id);
                          return (
                            <li key={v.id} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                              <span className="truncate pr-2">{v.voter?.username || 'Unknown'}</span>
                              <span className="text-white whitespace-nowrap text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
                                voted {candidate?.username || 'Unknown'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-row items-center justify-between relative z-10 gap-2 md:gap-8">
          {/* Team A Score */}
          <div className="flex flex-col items-center flex-1 w-full overflow-hidden relative">
            <h3 className="text-lg md:text-2xl font-bold text-primary-400 mb-2 truncate max-w-full px-2 text-center tracking-widest uppercase">
              {teamA?.name}
            </h3>
            <div className="text-6xl md:text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg relative">
              {teamScores[teamA?.id] || 0}
              {goalAnim?.teamId === teamA?.id && (
                <span
                  key={goalAnim?.id}
                  className="absolute -top-4 -right-12 md:-right-16 text-3xl md:text-5xl font-black text-primary-400 animate-float-up pointer-events-none drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] z-50"
                >
                  +1
                </span>
              )}
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex flex-col items-center justify-center px-2 md:px-4 flex-shrink-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 shadow-inner">
              <span className="text-neutral-400 font-bold text-xs md:text-sm">VS</span>
            </div>
            {session.location && (
              <span className="mt-4 text-[10px] md:text-xs font-medium text-neutral-500 uppercase tracking-widest text-center hidden sm:block">
                {session.location}
              </span>
            )}
          </div>

          {/* Team B Score */}
          <div className="flex flex-col items-center flex-1 w-full overflow-hidden relative">
            <h3 className="text-lg md:text-2xl font-bold text-blue-400 mb-2 truncate max-w-full px-2 text-center tracking-widest uppercase">
              {teamB?.name}
            </h3>
            <div className="text-6xl md:text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg relative">
              {teamScores[teamB?.id] || 0}
              {goalAnim?.teamId === teamB?.id && (
                <span
                  key={goalAnim?.id}
                  className="absolute -top-4 -right-12 md:-right-16 text-3xl md:text-5xl font-black text-blue-400 animate-float-up pointer-events-none drop-shadow-[0_0_15px_rgba(96,165,250,0.8)] z-50"
                >
                  +1
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
