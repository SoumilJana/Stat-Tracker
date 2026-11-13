import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { RegistrationResponse } from '../../../types/gamePayment';

export interface RegistrationDockProps {
  currentResponse?: RegistrationResponse | null;
  onSelectResponse: (response: RegistrationResponse) => void;
  loading?: boolean;
  disabled?: boolean;
  /** Disable only one button (e.g. IN after the roster is locked) */
  inDisabled?: boolean;
  outDisabled?: boolean;
  disabledReason?: string;
}

export function RegistrationDock({
  currentResponse,
  onSelectResponse,
  loading = false,
  disabled = false,
  inDisabled = false,
  outDisabled = false,
  disabledReason
}: RegistrationDockProps) {
  const inOff = disabled || inDisabled || loading;
  const outOff = disabled || outDisabled || loading;
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Your Match Attendance</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            React IN to join the roster in chronological order
          </p>
        </div>

        {currentResponse && (
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              currentResponse === 'IN'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            You are {currentResponse}
          </span>
        )}
      </div>

      {disabledReason && (disabled || inDisabled || outDisabled) && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{disabledReason}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={inOff}
          onClick={() => onSelectResponse('IN')}
          className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
            currentResponse === 'IN'
              ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400'
              : 'bg-neutral-800 hover:bg-neutral-700/80 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40'
          } ${inOff ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>I'm IN</span>
        </button>

        <button
          type="button"
          disabled={outOff}
          onClick={() => onSelectResponse('OUT')}
          className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
            currentResponse === 'OUT'
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 ring-2 ring-red-400'
              : 'bg-neutral-800 hover:bg-neutral-700/80 text-red-400 border border-red-500/20 hover:border-red-500/40'
          } ${outOff ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <XCircle className="w-4 h-4" />
          <span>I'm OUT</span>
        </button>
      </div>
    </div>
  );
}
