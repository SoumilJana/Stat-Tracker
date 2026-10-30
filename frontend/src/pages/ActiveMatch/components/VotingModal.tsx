import { Check } from 'lucide-react';

interface VotingModalProps {
  isOpen: boolean;
  awardType: 'BEST_DEFENDER' | 'BEST_GK' | 'MOTM' | null;
  players: any[];
  pollVotes: any[];
  currentProfileId: string | undefined;
  onVote: (awardType: 'BEST_DEFENDER' | 'BEST_GK' | 'MOTM', candidateId: string) => void;
  onClose: () => void;
}

export function VotingModal({
  isOpen,
  awardType,
  players,
  pollVotes,
  currentProfileId,
  onVote,
  onClose
}: VotingModalProps) {
  if (!isOpen || !awardType) return null;

  // Ensure distinct players sorted by username
  const distinctPlayers = players
    .filter((p, i, self) => i === self.findIndex(t => t.id === p.id))
    .sort((a, b) => a.username.localeCompare(b.username));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
        <h3 className="text-xl font-bold text-white mb-2 text-center">
          {awardType === 'BEST_DEFENDER' ? '🛡️ Best Defender' : awardType === 'BEST_GK' ? '🧤 Best Goalkeeper' : '⭐ Man of the Match'}
        </h3>
        <p className="text-neutral-400 text-sm mb-6 text-center">
          Vote for a player from this matchday
        </p>

        <div className="space-y-2 overflow-y-auto pr-2 flex-1">
          {distinctPlayers.map(player => {
            const isCurrentVote = pollVotes.some(
              v => v.voter_id === currentProfileId && v.award_type === awardType && v.candidate_id === player.id
            );
            return (
              <button
                key={player.id}
                onClick={() => onVote(awardType, player.id)}
                className={`w-full py-3 px-4 font-bold rounded-xl border transition-colors flex justify-between items-center cursor-pointer ${
                  isCurrentVote
                    ? 'bg-primary-500/20 text-primary-400 border-primary-500/30'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white border-white/5'
                }`}
              >
                <span>{player.username}</span>
                {isCurrentVote && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 text-neutral-500 hover:text-white text-sm font-medium transition-colors border-t border-neutral-800 pt-4 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
