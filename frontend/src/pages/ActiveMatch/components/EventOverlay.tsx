import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

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
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {overlayEvent && (
        <motion.div
          key={overlayEvent.id}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none select-none"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center bg-neutral-900/95 border border-white/10 p-8 sm:p-12 rounded-3xl shadow-2xl text-center overflow-hidden max-w-lg mx-4">
            <div className={`absolute inset-0 opacity-20 blur-[50px] ${overlayEvent.color.replace('text-', 'bg-')}`} />

            <motion.h1
              className={`text-5xl sm:text-7xl md:text-8xl font-black italic tracking-tighter uppercase ${overlayEvent.color} drop-shadow-lg mb-3`}
              initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {overlayEvent.title}
            </motion.h1>

            <motion.p
              className="text-xl sm:text-3xl md:text-4xl font-bold text-white tracking-widest uppercase drop-shadow-md"
              initial={shouldReduceMotion ? { opacity: 0 } : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.08, duration: 0.2, ease: "easeOut" }}
            >
              {overlayEvent.subtitle}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
