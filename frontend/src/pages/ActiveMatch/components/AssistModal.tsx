import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface AssistModalProps {
  isOpen: boolean;
  pendingGoal: { playerId: string; teamId: string; teamPlayers: any[] } | null;
  onConfirm: (assistedBy: string | null) => void;
  onCancel: () => void;
}

export function AssistModal({ isOpen, pendingGoal, onConfirm, onCancel }: AssistModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const isTest = import.meta.env.MODE === 'test';
  const scorer = pendingGoal?.teamPlayers.find(p => p.id === pendingGoal.playerId);

  return (
    <AnimatePresence>
      {isOpen && pendingGoal && (
        <motion.div
          key="assist-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion || isTest ? { duration: 0 } : { duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            key="assist-modal-content"
            initial={shouldReduceMotion || isTest ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion || isTest ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={shouldReduceMotion || isTest ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"
          >
            <h3 className="text-xl font-bold text-white mb-2 text-center">Who assisted?</h3>
            <p className="text-neutral-400 text-sm mb-6 text-center">
              Goal by {scorer?.username}
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <button
                onClick={() => onConfirm(null)}
                className="w-full py-4 px-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
              >
                No Assist
              </button>

              {pendingGoal.teamPlayers
                .filter(p => p.id !== pendingGoal.playerId)
                .map(player => (
                  <button
                    key={player.id}
                    onClick={() => onConfirm(player.id)}
                    className="w-full py-4 px-4 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 font-bold rounded-xl border border-primary-500/20 transition-colors cursor-pointer"
                  >
                    {player.username}
                  </button>
                ))}
            </div>

            <button
              onClick={onCancel}
              className="mt-6 w-full py-3 text-neutral-500 hover:text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
