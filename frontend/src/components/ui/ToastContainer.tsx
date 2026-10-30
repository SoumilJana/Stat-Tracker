import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import {
  ToastContext,
  type ToastType,
  type ToastOptions,
  type ToastItem,
  type ToastContextValue,
} from '../../contexts/ToastContext';

export function ToastCard({
  item,
  onDismiss,
  reduceMotion,
}: {
  item: ToastItem;
  onDismiss: () => void;
  reduceMotion: boolean | null;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (item.duration > 0) {
      timerRef.current = setTimeout(onDismiss, item.duration);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [item.duration, onDismiss]);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseLeave = () => {
    if (item.duration > 0) {
      timerRef.current = setTimeout(onDismiss, item.duration);
    }
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  };

  const borders: Record<ToastType, string> = {
    success: 'border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.18)]',
    error: 'border-red-500/30 shadow-[0_4px_20px_rgba(239,68,68,0.18)]',
    warning: 'border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.18)]',
    info: 'border-blue-500/30 shadow-[0_4px_20px_rgba(96,165,250,0.18)]',
  };

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 350 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-neutral-900/95 backdrop-blur-2xl border text-white text-sm font-medium w-full ring-1 ring-black/60 ${borders[item.type]}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icons[item.type]}
        <span className="truncate">{item.message}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss();
            }}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer"
          >
            {item.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const shouldReduceMotion = useReducedMotion();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions): string => {
      const id = options?.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const defaultDurations: Record<ToastType, number> = {
        success: 4000,
        info: 4000,
        warning: 5000,
        error: 6000,
      };
      const duration = options?.duration !== undefined ? options.duration : defaultDurations[type];

      setToasts((prev) => {
        // Prevent exact duplicate spam
        const filtered = prev.filter((t) => !(t.message === message && t.type === type));
        return [...filtered, { id, type, message, duration, action: options?.action }];
      });

      return id;
    },
    []
  );

  const value: ToastContextValue = {
    toast: {
      success: (msg, opts) => addToast('success', msg, opts),
      error: (msg, opts) => addToast('error', msg, opts),
      warning: (msg, opts) => addToast('warning', msg, opts),
      info: (msg, opts) => addToast('info', msg, opts),
      dismiss,
      clearAll,
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-live="polite"
            className="fixed top-3 inset-x-3 sm:top-5 sm:right-5 sm:left-auto sm:w-96 z-[70] flex flex-col gap-2.5 pointer-events-none items-center sm:items-end"
          >
            <AnimatePresence mode="popLayout">
              {toasts.map((item) => (
                <ToastCard
                  key={item.id}
                  item={item}
                  onDismiss={() => dismiss(item.id)}
                  reduceMotion={shouldReduceMotion}
                />
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
