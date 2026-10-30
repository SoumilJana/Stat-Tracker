import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ConfirmContext } from '../../contexts/ConfirmContext';
import type { ConfirmOptions, ConfirmVariant } from '../../contexts/ConfirmContext';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isDestructive = variant === 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [internalLoading, setInternalLoading] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const busy = isLoading || internalLoading;

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  // Capture trigger element on open and restore focus on close
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
      return () => {
        triggerRef.current?.focus();
      };
    }
  }, [isOpen]);

  // Autofocus appropriate initial button
  useEffect(() => {
    if (!isOpen) return;

    if (isDestructive) {
      cancelBtnRef.current?.focus();
    } else {
      confirmBtnRef.current?.focus();
    }
  }, [isOpen, isDestructive]);

  // Accessible focus trap and keyboard escape handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (busy) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey) {
          // Backward navigation: if on cancel button (first element), wrap to confirm button
          if (document.activeElement === cancelBtnRef.current || document.activeElement !== confirmBtnRef.current) {
            e.preventDefault();
            confirmBtnRef.current?.focus();
          }
        } else {
          // Forward navigation: if on confirm button (last element), wrap to cancel button
          if (document.activeElement === confirmBtnRef.current || document.activeElement !== cancelBtnRef.current) {
            e.preventDefault();
            cancelBtnRef.current?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, onClose]);

  const handleConfirmClick = async () => {
    if (busy) return;
    try {
      const res = onConfirm();
      if (res instanceof Promise) {
        setInternalLoading(true);
        await res;
      }
    } finally {
      setInternalLoading(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const icons: Record<ConfirmVariant, React.ReactNode> = {
    danger: <AlertTriangle className="w-6 h-6 text-red-400" />,
    warning: <AlertCircle className="w-6 h-6 text-amber-400" />,
    primary: <CheckCircle2 className="w-6 h-6 text-primary-400" />,
  };

  const badgeBg: Record<ConfirmVariant, string> = {
    danger: 'bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    warning: 'bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    primary: 'bg-primary-500/10 border-primary-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
  };

  const confirmBtnStyle: Record<ConfirmVariant, string> = {
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/50',
    warning: 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold',
    primary: 'bg-primary-500 hover:bg-primary-400 text-neutral-950 font-bold',
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onClose()}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Dialog Window */}
        <motion.div
          role="alertdialog"
          aria-modal="true"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 overflow-hidden ring-1 ring-black/80"
        >
          {/* Top Radial Glow */}
          <div
            className={`absolute top-0 inset-x-0 h-24 pointer-events-none opacity-20 bg-gradient-to-b ${
              variant === 'danger'
                ? 'from-red-500'
                : variant === 'warning'
                ? 'from-amber-500'
                : 'from-primary-500'
            } to-transparent`}
          />

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Header Icon */}
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 ${badgeBg[variant]}`}
            >
              {icons[variant]}
            </div>

            {/* Title & Description */}
            <h3 className="text-xl font-black text-white tracking-tight mb-2">{title}</h3>
            <p className="text-sm text-neutral-300 leading-relaxed mb-6">{description}</p>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                ref={cancelBtnRef}
                type="button"
                disabled={busy}
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {cancelText}
              </button>

              <button
                ref={confirmBtnRef}
                type="button"
                disabled={busy}
                onClick={handleConfirmClick}
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${confirmBtnStyle[variant]}`}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setModalState((prev) => {
        if (prev) {
          prev.resolve(false);
        }
        return {
          isOpen: true,
          options,
          resolve,
        };
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    setModalState((prev) => {
      if (prev) {
        prev.resolve(false);
      }
      return null;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setModalState((prev) => {
      if (prev) {
        prev.resolve(true);
      }
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modalState && (
        <ConfirmModal
          isOpen={modalState.isOpen}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title={modalState.options.title}
          description={modalState.options.description}
          confirmText={modalState.options.confirmText}
          cancelText={modalState.options.cancelText}
          variant={modalState.options.variant}
          isDestructive={modalState.options.isDestructive}
        />
      )}
    </ConfirmContext.Provider>
  );
}
