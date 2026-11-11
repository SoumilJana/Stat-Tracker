import { CreditCard, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export default function Payments() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-8 pb-32 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Payments</h1>
        <p className="text-neutral-400 mt-1 text-sm sm:text-base">
          Track match dues, pitch bookings, and team payment balances.
        </p>
      </div>

      {/* Subtle Coming Soon Card */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/50 backdrop-blur-xl p-8 sm:p-14 text-center shadow-2xl"
      >
        {/* Subtle decorative glow */}
        <div 
          aria-hidden="true" 
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl opacity-60" 
        />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 mb-6 shadow-inner ring-1 ring-primary-500/20">
            <CreditCard className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Coming Soon
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
            Payments Module In Development
          </h2>

          <p className="mt-3 text-neutral-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            We are working on bringing automated match fee tracking, player settlement records, and expense management right here to StatTracker.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
