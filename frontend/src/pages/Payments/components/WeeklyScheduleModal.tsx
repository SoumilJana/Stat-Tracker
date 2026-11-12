import { useEffect, useState } from 'react';
import { CalendarClock, X, MapPin, IndianRupee, Clock, Repeat, Info } from 'lucide-react';
import type { GameSchedule } from '../../../types/gamePayment';
import {
  fetchGameSchedule,
  saveGameSchedule,
  runGameScheduleNow,
  nextScheduledDate
} from '../../../lib/gamePaymentsApi';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface WeeklyScheduleModalProps {
  onClose: () => void;
  /** Called after a game was created by "Open next game now" */
  onGameCreated?: () => void;
  notify: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function WeeklyScheduleModal({ onClose, onGameCreated, notify }: WeeklyScheduleModalProps) {
  const [schedule, setSchedule] = useState<GameSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchGameSchedule()
      .then(setSchedule)
      .catch((err) => notify.error(err.message || 'Failed to load weekly schedule.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof GameSchedule>(key: K, value: GameSchedule[K]) =>
    setSchedule((s) => (s ? { ...s, [key]: value } : s));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule) return;
    try {
      setSaving(true);
      setSchedule(await saveGameSchedule(schedule));
      notify.success('Weekly schedule saved.');
      onClose();
    } catch (err: any) {
      notify.error(err.message || 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setRunning(true);
      const id = await runGameScheduleNow();
      if (id) {
        notify.success('Next game created and open for registration!');
        onGameCreated?.();
        onClose();
      } else {
        notify.info('Nothing to create: that week already has a game, or it is too early to open it.');
      }
    } catch (err: any) {
      notify.error(err.message || 'Failed to run schedule.');
    } finally {
      setRunning(false);
    }
  };

  const nextDate = schedule ? nextScheduledDate(schedule) : null;
  const opensOn = schedule && nextDate ? addDays(nextDate, -schedule.open_days_before) : null;

  const inputCls =
    'w-full px-3.5 py-2.5 bg-neutral-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 [color-scheme:dark]';
  const labelCls = 'block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-5 sm:p-7 w-full max-w-md shadow-2xl relative my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary-400" />
            Weekly Game Schedule
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-400 py-8 text-center">Loading schedule…</p>
        ) : !schedule ? (
          <p className="text-sm text-neutral-400 py-8 text-center">No schedule found. Apply the weekly schedule migration first.</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-950 border border-white/10 cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Repeat className="w-4 h-4 text-primary-400" />
                Auto-create the weekly game
              </span>
              <input
                type="checkbox"
                checked={schedule.active}
                onChange={(e) => update('active', e.target.checked)}
                className="w-5 h-5 accent-emerald-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Day</label>
                <select
                  value={schedule.weekday}
                  onChange={(e) => update('weekday', Number(e.target.value))}
                  className={inputCls}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  <Clock className="w-3.5 h-3.5 text-primary-400" />
                  Kick-off
                </label>
                <input
                  type="time"
                  required
                  value={schedule.start_time.slice(0, 5)}
                  onChange={(e) => update('start_time', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                <MapPin className="w-3.5 h-3.5 text-primary-400" />
                Usual Turf
              </label>
              <input
                type="text"
                required
                value={schedule.location}
                onChange={(e) => update('location', e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>
                  <IndianRupee className="w-3.5 h-3.5 text-primary-400" />
                  Fee
                </label>
                <input
                  type="number"
                  min="0"
                  value={schedule.amount_per_player}
                  onChange={(e) => update('amount_per_player', Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Turf ₹</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={schedule.total_turf_cost}
                  onChange={(e) => update('total_turf_cost', Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Mins</label>
                <select
                  value={schedule.duration_minutes}
                  onChange={(e) => update('duration_minutes', Number(e.target.value))}
                  className={inputCls}
                >
                  <option value={60}>60</option>
                  <option value={90}>90</option>
                  <option value={120}>120</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Open registration</label>
              <select
                value={schedule.open_days_before}
                onChange={(e) => update('open_days_before', Number(e.target.value))}
                className={inputCls}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>{n} day{n > 1 ? 's' : ''} before</option>
                ))}
              </select>
            </div>

            {schedule.active && nextDate && opensOn && (
              <p className="text-xs text-neutral-400 bg-neutral-950 border border-white/10 rounded-xl p-3 leading-relaxed">
                Next usual game: <span className="text-white font-semibold">{formatDate(nextDate)}</span>, opening{' '}
                <span className="text-white font-semibold">{formatDate(opensOn)}</span> (checked daily just after midnight).
              </p>
            )}

            <p className="text-[11px] text-neutral-500 flex gap-1.5 leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Different day or time this week? Edit that week's game. Skipping a week? Cancel it. A week that already has
              any game (moved, added by hand, or cancelled) is never duplicated.
            </p>

            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleRunNow}
                disabled={running || !schedule.active}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {running ? 'Checking…' : 'Open next game now'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-neutral-950 font-bold text-xs shadow-lg shadow-primary-500/20 active:scale-95 transition-all"
              >
                {saving ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
