/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/WinnerStaysClock.tsx
 *
 * Dark Stadium Match Clock UI Component exclusively for Winner Stays matches.
 *
 * Features:
 * - Authentic Dark Stadium aesthetic (#051410 pitch-turf, neutral-950 canvas, emerald neon #10b981)
 * - Large monospace tabular countdown display (text-6xl md:text-8xl)
 * - Visual warning tiers: amber warning at <= 30s, red pulse at <= 10s, expired banner at 00:00
 * - Phase Badges (Goal Buffer 60s vs Playing 10:00 vs Time Expired)
 * - Status Indicators (RUNNING vs prominent PAUSED banner)
 * - Admin Controls (Start/Pause, Reset with confirmation, Skip Buffer)
 * - Spectator Read-Only HUD with live synchronized indicator
 * - Referee Physical Experience (procedural Web Audio API whistles, Vibration API haptics, Screen Wake Lock)
 * - Referee Settings Drawer/Modal for persistent sound, vibration, and wake lock toggles
 * - Safe 00:00 expiry outcome coordination via onRecordTimeUp
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Settings,
  Volume2,
  VolumeX,
  Smartphone,
  Sun,
  Radio,
  X,
  AlertTriangle,
  RotateCcw as UndoIcon,
} from 'lucide-react';
import type { TimerPhase } from './types';
import { useWinnerStaysTimer } from './useWinnerStaysTimer';
import {
  playBufferStartWhistle,
  playBufferEndWhistle,
  playMatchEndWhistle,
  unlockAudioContext,
} from './refereeAudio';
import {
  useRefereeSettings,
  useWakeLock,
  triggerHaptic,
  HAPTIC_PATTERNS,
} from './useRefereeSensors';

export interface WinnerStaysClockProps {
  /** Active match session object */
  session: any;
  /** Realtime match event stream */
  events?: any[];
  /** Current user profile (checks profile?.role === 'admin') */
  profile?: any;
  /** Callback to invoke on confirmed 00:00 time expiry (NO_GOAL_TIME_UP) */
  onRecordTimeUp?: () => Promise<void>;
  /** Testing & configuration overrides */
  storageEnabled?: boolean;
  syncEnabled?: boolean;
  supabaseClient?: any;
  confirmOverride?: (options: any) => Promise<boolean>;
}

export function WinnerStaysClock({
  session,
  events = [],
  profile,
  onRecordTimeUp,
  storageEnabled = true,
  syncEnabled = true,
  supabaseClient,
  confirmOverride,
}: WinnerStaysClockProps) {
  // 1. Referee Sensors & Settings
  const { settings, toggleSound, toggleVibration, toggleWakeLock } = useRefereeSettings();
  const wakeLock = useWakeLock(settings.wakeLockEnabled && session?.status !== 'COMPLETED');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingTimeUp, setIsRecordingTimeUp] = useState(false);

  // 2. Track Phase Transitions for Whistles and Haptics
  const handlePhaseExpire = useCallback(
    (expiredPhase: TimerPhase) => {
      if (expiredPhase === 'GOAL_BUFFER') {
        // Buffer ended -> double whistle & double haptic
        if (settings.soundEnabled) playBufferEndWhistle();
        if (settings.vibrationEnabled) triggerHaptic(HAPTIC_PATTERNS.bufferEnd);
      } else if (expiredPhase === 'PLAYING') {
        // Match ended -> long whistle & long haptic
        if (settings.soundEnabled) playMatchEndWhistle();
        if (settings.vibrationEnabled) triggerHaptic(HAPTIC_PATTERNS.matchEnd);
      }
    },
    [settings.soundEnabled, settings.vibrationEnabled]
  );

  // 3. Reactive Timer Engine Hook
  const timer = useWinnerStaysTimer({
    sessionId: session?.id,
    session,
    events,
    profile,
    onRecordTimeUp,
    onPhaseExpire: handlePhaseExpire,
    storageEnabled,
    syncEnabled,
    supabaseClient,
    confirmOverride,
  });

  // 4. Trigger Short Whistle on Buffer Start (when a goal triggers GOAL_BUFFER)
  const prevPhaseRef = useRef<TimerPhase>(timer.state.phase);
  const prevGoalIdRef = useRef<string | null>(timer.state.lastGoalEventId);
  const isInitialMountRef = useRef<boolean>(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevPhaseRef.current = timer.state.phase;
      prevGoalIdRef.current = timer.state.lastGoalEventId;
      return;
    }

    const currentPhase = timer.state.phase;
    const currentGoalId = timer.state.lastGoalEventId;

    if (
      currentPhase === 'GOAL_BUFFER' &&
      (prevPhaseRef.current !== 'GOAL_BUFFER' ||
        (currentGoalId && currentGoalId !== prevGoalIdRef.current))
    ) {
      // Goal Buffer initiated
      if (settings.soundEnabled) playBufferStartWhistle();
      if (settings.vibrationEnabled) triggerHaptic(HAPTIC_PATTERNS.bufferStart);
    }

    prevPhaseRef.current = currentPhase;
    prevGoalIdRef.current = currentGoalId;
  }, [timer.state.phase, timer.state.lastGoalEventId, settings.soundEnabled, settings.vibrationEnabled]);

  // Audio gesture unlock helper
  const handleInteraction = useCallback(() => {
    unlockAudioContext();
  }, []);

  const handleStart = () => {
    handleInteraction();
    timer.start();
  };

  const handlePause = () => {
    handleInteraction();
    timer.pause();
  };

  const handleReset = async () => {
    handleInteraction();
    await timer.reset();
  };

  const handleSkip = () => {
    handleInteraction();
    timer.skip();
  };

  const handleRollback = async () => {
    handleInteraction();
    await timer.rollback();
  };

  const handleManualRecordTimeUp = async () => {
    if (!onRecordTimeUp || isRecordingTimeUp) return;
    try {
      setIsRecordingTimeUp(true);
      await onRecordTimeUp();
    } finally {
      setIsRecordingTimeUp(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Styling Computations based on Phase, Urgency & Status
  // ---------------------------------------------------------------------------
  const { phase, status } = timer.state;
  const isRunning = status === 'RUNNING';
  const isPaused = status === 'PAUSED';
  const isGoalBuffer = phase === 'GOAL_BUFFER';
  const isPlaying = phase === 'PLAYING';
  const isExpired = phase === 'TIME_EXPIRED';

  // Digital countdown text color and glow
  let timeDisplayClass = 'text-emerald-400 drop-shadow-[0_0_25px_rgba(16,185,129,0.35)]';
  if (isExpired) {
    timeDisplayClass = 'text-red-500 animate-pulse drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]';
  } else if (isPlaying && timer.urgencyLevel === 'URGENT_10') {
    timeDisplayClass = 'text-red-400 animate-pulse drop-shadow-[0_0_25px_rgba(248,113,113,0.5)]';
  } else if (isPlaying && timer.urgencyLevel === 'WARNING_30') {
    timeDisplayClass = 'text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.45)]';
  } else if (isGoalBuffer) {
    timeDisplayClass = 'text-emerald-300 drop-shadow-[0_0_25px_rgba(52,211,153,0.4)]';
  }

  // Border & ambient card glow
  let containerBorderClass = 'border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)]';
  if (isExpired) {
    containerBorderClass = 'border-red-500/40 shadow-[0_0_60px_rgba(239,68,68,0.2)]';
  } else if (isPlaying && timer.urgencyLevel === 'URGENT_10') {
    containerBorderClass = 'border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.15)]';
  } else if (isPlaying && timer.urgencyLevel === 'WARNING_30') {
    containerBorderClass = 'border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.15)]';
  }

  return (
    <div
      data-testid="winner-stays-clock"
      className={`relative overflow-hidden rounded-2xl md:rounded-3xl bg-[#051410] border ${containerBorderClass} p-2.5 sm:p-4 md:p-6 mb-2 md:mb-8 backdrop-blur-md transition-all duration-300`}
      onClick={handleInteraction}
    >
      {/* Stadium Pitch Turf Texture Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="w-full h-full bg-[repeating-linear-gradient(90deg,transparent,transparent_60px,rgba(16,185,129,0.06)_60px,rgba(16,185,129,0.06)_120px)]" />
      </div>

      {/* Top Header Row: Phase Badge, Status Badge & Settings Toggle */}
      <div className="relative z-10 h-6 mb-1 sm:mb-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {/* Phase Badge */}
          {isGoalBuffer && (
            <span
              data-testid="phase-badge-buffer"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-ping" />
              Goal Buffer (60s)
            </span>
          )}

          {isPlaying && (
            <span
              data-testid="phase-badge-playing"
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase ${
                timer.urgencyLevel === 'URGENT_10'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse'
                  : timer.urgencyLevel === 'WARNING_30'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              }`}
            >
              {timer.urgencyLevel === 'URGENT_10' && (
                <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400 animate-bounce" />
              )}
              Playing Match (10:00)
            </span>
          )}

          {isExpired && (
            <span
              data-testid="phase-badge-expired"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase bg-red-600/30 text-red-300 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse"
            >
              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400" />
              Match Expired (00:00)
            </span>
          )}

          {/* Operational Status Badge */}
          {isRunning && (
            <span
              data-testid="status-badge-running"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wider uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Running
            </span>
          )}

          {isPaused && (
            <span
              data-testid="status-badge-paused"
              className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.25)]"
            >
              <Pause className="w-3 h-3 text-amber-400" />
              Paused
            </span>
          )}

          {status === 'IDLE' && (
            <span
              data-testid="status-badge-idle"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase bg-neutral-900 text-neutral-400 border border-white/10"
            >
              Ready
            </span>
          )}
        </div>

        {/* Top Right Actions: Referee Settings Drawer Toggle */}
        <div className="flex items-center gap-2">
          {wakeLock.isLocked && (
            <span
              title="Screen Wake Lock is active"
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400/80 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20"
            >
              <Sun className="w-3 h-3 text-emerald-400" />
              Awake
            </span>
          )}

          <button
            type="button"
            data-testid="referee-settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open Referee Experience Settings"
            className="p-1 sm:p-2 rounded-lg sm:rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 transition-all cursor-pointer active:scale-95"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Main Large Monospace Athletic Tabular Countdown */}
      <div className="relative z-10 flex flex-col items-center justify-center my-0.5 sm:my-2 py-0 sm:py-1">
        <div
          data-testid="timer-display"
          className={`font-mono tabular-nums text-3xl sm:text-4xl md:text-6xl font-black text-white select-none transition-colors duration-200 ${timeDisplayClass}`}
        >
          {timer.formattedTime}
        </div>

        {/* Phase Description / Subtext */}
        <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-semibold tracking-wide text-neutral-400 uppercase text-center">
          {isGoalBuffer && 'Goal Scored — 60s Team Rotation Buffer'}
          {isPlaying && timer.urgencyLevel === 'URGENT_10' && (
            <span className="text-red-400 font-bold animate-pulse">Final 10 Seconds — Prepare Whistle</span>
          )}
          {isPlaying && timer.urgencyLevel === 'WARNING_30' && (
            <span className="text-amber-400 font-semibold">30 Seconds Remaining in Playing Time</span>
          )}
          {isPlaying && timer.urgencyLevel === 'NORMAL' && '10:00 Playing Countdown in Progress'}
          {isExpired && (
            <span className="text-red-400 font-bold">Time Expired — Admin Action Required</span>
          )}
        </p>

        {/* Goal Undo Rollback Banner / Action (Admin Only) */}
        {timer.isAdmin && timer.state.previousState && (
          <div
            data-testid="undo-rollback-banner"
            className="mt-2 sm:mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl sm:rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 text-xs text-amber-200"
          >
            <span>Goal undo detected. Rollback clock to previous state?</span>
            <button
              type="button"
              data-testid="rollback-clock-btn"
              onClick={handleRollback}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition-all cursor-pointer"
            >
              <UndoIcon className="w-3.5 h-3.5" />
              Rollback Clock
            </button>
          </div>
        )}

        {/* Match Expired 00:00 Outcome Record Button (Admin Only) */}
        {timer.isAdmin && isExpired && onRecordTimeUp && (
          <div
            data-testid="time-up-record-banner"
            className="mt-2 sm:mt-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-red-950/40 border border-red-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 text-center sm:text-left"
          >
            <div>
              <p className="text-xs sm:text-sm font-bold text-red-300">Match Countdown Reached 00:00</p>
              <p className="text-[11px] sm:text-xs text-neutral-400">
                Record No-Goal Time Up to execute Winner Stays team rotation.
              </p>
            </div>
            <button
              type="button"
              data-testid="record-time-up-btn"
              disabled={isRecordingTimeUp}
              onClick={handleManualRecordTimeUp}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 cursor-pointer disabled:opacity-50"
            >
              {isRecordingTimeUp ? 'Recording...' : 'Record Time Up'}
            </button>
          </div>
        )}
      </div>

      {/* Control Actions Section */}
      <div className="relative z-10 gap-2 mt-2 pt-2 border-t border-white/5 flex flex-wrap items-center justify-center md:gap-4 md:mt-4 md:pt-4">
        {timer.isAdmin ? (
          <>
            {/* Start / Pause Toggle */}
            {isRunning ? (
              <button
                type="button"
                data-testid="pause-timer-btn"
                onClick={handlePause}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold md:px-6 md:py-3 md:rounded-2xl md:text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all active:scale-95 cursor-pointer"
              >
                <span data-testid="timer-start-pause-btn" className="flex items-center gap-1.5">
                  <Pause className="w-3.5 h-3.5 md:w-4 md:h-4 fill-amber-300" />
                  Pause
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="start-timer-btn"
                onClick={handleStart}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold md:px-6 md:py-3 md:rounded-2xl md:text-sm bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all active:scale-95 cursor-pointer"
              >
                <span data-testid="timer-start-pause-btn" className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-neutral-950" />
                  {isPaused ? 'Resume' : 'Start Clock'}
                </span>
              </button>
            )}

            {/* Skip Buffer Button (Visible ONLY during GOAL_BUFFER) */}
            {isGoalBuffer && (
              <button
                type="button"
                data-testid="skip-buffer-btn"
                onClick={handleSkip}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold md:px-5 md:py-3 md:rounded-2xl md:text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all active:scale-95 cursor-pointer"
              >
                <span data-testid="timer-skip-buffer-btn" className="flex items-center gap-1.5">
                  <FastForward className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Skip Buffer
                </span>
              </button>
            )}

            {/* Reset Button (Prompts confirmation when running) */}
            <button
              type="button"
              data-testid="reset-timer-btn"
              onClick={handleReset}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold md:px-5 md:py-3 md:rounded-2xl md:text-sm bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
            >
              <span data-testid="timer-reset-btn" className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Reset
              </span>
            </button>
          </>
        ) : (
          /* Spectator Read-Only HUD */
          <div
            data-testid="spectator-live-hud"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold md:px-4 md:py-2 md:rounded-2xl bg-neutral-900/90 border border-emerald-500/20 text-neutral-300 shadow-inner"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Spectator Live HUD</span>
            <span className="text-neutral-500">•</span>
            <span className="text-emerald-400/90">Synchronized via Realtime</span>
          </div>
        )}
      </div>

      {/* Referee Settings Drawer / Modal */}
      {isSettingsOpen && (
        <div
          data-testid="referee-settings-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-sm bg-neutral-900 border border-emerald-500/20 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                Referee Experience
              </h3>
              <button
                type="button"
                data-testid="close-settings-btn"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close referee settings"
                className="p-1 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 py-4">
              {/* Sound / Whistles Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    {settings.soundEnabled ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Whistle Audio</p>
                    <p className="text-xs text-neutral-400">Synthesized referee whistles</p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="toggle-sound-btn"
                  onClick={toggleSound}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    settings.soundEnabled ? 'bg-emerald-500 justify-end' : 'bg-neutral-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Vibration API Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Haptic Vibration</p>
                    <p className="text-xs text-neutral-400">Pulses on transitions</p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="toggle-vibration-btn"
                  onClick={toggleVibration}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    settings.vibrationEnabled ? 'bg-emerald-500 justify-end' : 'bg-neutral-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Screen Wake Lock Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Keep Screen Awake</p>
                    <p className="text-xs text-neutral-400">
                      {wakeLock.isSupported
                        ? wakeLock.isLocked
                          ? 'Active (Screen locked awake)'
                          : 'Enabled (Screen wake lock)'
                        : 'Unsupported in this browser'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="toggle-wakelock-btn"
                  disabled={!wakeLock.isSupported}
                  onClick={toggleWakeLock}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors disabled:opacity-40 ${
                    settings.wakeLockEnabled && wakeLock.isSupported
                      ? 'bg-emerald-500 justify-end'
                      : 'bg-neutral-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WinnerStaysClock;
