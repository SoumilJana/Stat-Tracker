import { motion, AnimatePresence } from 'framer-motion';

export interface OverlayEventData {
  type: 'GOAL' | 'ROTATE';
  title: string;
  subtitle: string;
  color: string;
  id: number;
}

interface EventOverlayProps {
  overlayEvent: OverlayEventData | null;
}

export function EventOverlay({ overlayEvent }: EventOverlayProps) {
  return (
    <AnimatePresence>
      {overlayEvent && (
        <motion.div
          key={overlayEvent.id}
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -50 }}
          transition={{ type: 'spring', damping: 15 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            className="relative z-10 flex flex-col items-center bg-neutral-900/90 border border-white/10 p-12 rounded-3xl shadow-2xl text-center overflow-hidden"
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={{ delay: 0.1, type: 'spring' }}
          >
            <div className={`absolute inset-0 opacity-20 blur-[50px] ${overlayEvent.color.replace('text-', 'bg-')}`} />

            <motion.h1
              className={`text-6xl md:text-8xl font-black italic tracking-tighter uppercase ${overlayEvent.color} drop-shadow-lg mb-4`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
            >
              {overlayEvent.title}
            </motion.h1>

            <motion.p
              className="text-2xl md:text-4xl font-bold text-white tracking-widest uppercase drop-shadow-md"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {overlayEvent.subtitle}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
