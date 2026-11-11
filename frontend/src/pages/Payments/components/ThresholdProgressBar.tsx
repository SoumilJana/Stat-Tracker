import { Users, CheckCircle, Zap } from 'lucide-react';

export interface ThresholdProgressBarProps {
  activeCount: number;
}

export function ThresholdProgressBar({ activeCount }: ThresholdProgressBarProps) {
  const isThresholdMet = activeCount >= 10;
  const is15PlayerMode = activeCount >= 15;

  let progressPercent = 0;
  let statusText = '';
  let subText = '';

  if (activeCount < 10) {
    progressPercent = Math.min((activeCount / 10) * 100, 100);
    statusText = `${activeCount} / 10 Players`;
    subText = `Need ${10 - activeCount} more player${10 - activeCount > 1 ? 's' : ''} to confirm turf & unlock payments`;
  } else if (activeCount < 15) {
    progressPercent = ((activeCount - 10) / 5) * 100;
    statusText = `${activeCount} Players Joined`;
    subText = `Standard 5v5 Confirmed (${activeCount > 10 ? `${activeCount - 10} on waitlist` : '10 slots filled'}). ${15 - activeCount} more to auto-switch to 3 Teams Winner Stays!`;
  } else {
    progressPercent = 100;
    statusText = `${activeCount} Players (3 Teams Confirmed)`;
    subText = `15 Active Players! Match automatically upgraded to 3 Teams Winner Stays (1.5 hrs).`;
  }

  return (
    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {isThresholdMet ? (
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          )}
          <span className="text-sm font-bold text-white tracking-tight">{statusText}</span>
        </div>

        {is15PlayerMode ? (
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary-400 bg-primary-950/80 border border-primary-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary-400" />
            3-Team Mode
          </span>
        ) : isThresholdMet ? (
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            5v5 Confirmed
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-neutral-400">
            Min 10 Required
          </span>
        )}
      </div>

      {/* Progress Bar Track */}
      <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-white/5 p-0.5">
        <div
          role="progressbar"
          aria-valuenow={activeCount}
          aria-valuemin={0}
          aria-valuemax={15}
          className={`h-full rounded-full transition-all duration-500 ${
            is15PlayerMode
              ? 'bg-gradient-to-r from-emerald-500 to-primary-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : isThresholdMet
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
              : 'bg-primary-500'
          }`}
          style={{ width: `${Math.max(progressPercent, 4)}%` }}
        />
      </div>

      <p className="text-xs text-neutral-400 mt-2 font-medium">{subText}</p>
    </div>
  );
}
