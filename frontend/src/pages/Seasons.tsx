import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CheckCircle2, X, Crown, Lock } from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

import { buildSeasons, getCurrentSeason } from '../lib/seasons';

interface Profile {
  id: string;
  username: string;
  photo_url: string | null;
}

interface SealedSeason {
  id: string;
  season_number: number;
  season_label: string;
  notes: string | null;
  declared_at: string | null;
  scorer_1_id: string | null;  scorer_1_goals: number | null;
  scorer_2_id: string | null;  scorer_2_goals: number | null;
  scorer_3_id: string | null;  scorer_3_goals: number | null;
  assister_1_id: string | null; assister_1_assists: number | null;
  assister_2_id: string | null; assister_2_assists: number | null;
  assister_3_id: string | null; assister_3_assists: number | null;
  defender_id: string | null;  defender_awards: number | null;
  gk_id: string | null;        gk_awards: number | null;
}

interface RawStat {
  player_id: string;
  goals: number;
  assists: number;
  best_defender_awards: number;
  best_gk_awards: number;
}


// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function Avatar({ profile, size = 'sm' }: { profile: Profile | null | undefined; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-xs';
  if (profile?.photo_url)
    return <img src={profile.photo_url} alt={profile.username} className={`${cls} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${cls} rounded-full bg-neutral-800 flex items-center justify-center shrink-0`}>
      {profile ? (
        <span className="font-bold text-neutral-400">{profile.username[0]?.toUpperCase()}</span>
      ) : (
        <Users className="w-3.5 h-3.5 text-neutral-600" />
      )}
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function RankRow({ rank, profile, stat, unit }: { rank: number; profile: Profile | null | undefined; stat: number | null; unit: string }) {
  const isFirst = rank === 0;
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors ${isFirst ? 'bg-white/5' : ''}`}>
      <span className="text-lg w-6 text-center shrink-0">{MEDALS[rank]}</span>
      <Avatar profile={profile} size="sm" />
      <span className="flex-1 text-sm font-bold text-white truncate">{profile?.username || '—'}</span>
      <span className={`text-sm font-black tabular-nums shrink-0 ${isFirst ? 'text-orange-400' : 'text-neutral-500'}`}>
        {stat ?? '—'}<span className="text-[10px] font-medium text-neutral-600 ml-1">{unit}</span>
      </span>
    </div>
  );
}

function WinnerRow({ profile, stat, unit }: { profile: Profile | null | undefined; stat: number | null; unit: string }) {
  if (!profile) {
    return <p className="text-neutral-600 text-sm text-center py-3">No award this season</p>;
  }
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
      <Crown className="w-4 h-4 text-orange-400 shrink-0" />
      <Avatar profile={profile} size="md" />
      <span className="flex-1 text-base font-black text-white truncate">{profile.username}</span>
      {stat !== null && (
        <span className="text-base font-black text-orange-400 tabular-nums shrink-0">
          {stat}<span className="text-xs font-medium text-neutral-500 ml-1">{unit}</span>
        </span>
      )}
    </div>
  );
}

type PanelColor = 'amber' | 'blue' | 'orange' | 'purple';
const panelBorder: Record<PanelColor, string> = {
  amber:  'border-amber-500/20  bg-amber-500/5',
  blue:   'border-blue-500/20   bg-blue-500/5',
  orange: 'border-orange-500/20 bg-orange-500/5',
  purple: 'border-purple-500/20 bg-purple-500/5',
};
const panelText: Record<PanelColor, string> = {
  amber:  'text-amber-400',
  blue:   'text-blue-400',
  orange: 'text-orange-400',
  purple: 'text-purple-400',
};

function Panel({ icon, title, award, color, children }: {
  icon: string; title: string; award: string; color: PanelColor; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${panelBorder[color]}`}>
      <div>
        <p className="text-xl mb-1">{icon}</p>
        <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${panelText[color]}`}>{award}</p>
        <p className="text-lg font-black text-white leading-tight">{title}</p>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function PreviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-800/60 rounded-xl p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function PreviewRow({ rank, name, stat }: { rank: number; name: string; stat: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-neutral-300">{MEDALS[rank] || '  '} {name}</span>
      <span className="text-orange-400 font-bold tabular-nums">{stat}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function Seasons() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const seasons = useMemo(() => buildSeasons(), []);

  // Default to the currently active season
  const defaultSeason = useMemo(() => getCurrentSeason(seasons), [seasons]);

  const [selectedNum, setSelectedNum] = useState(defaultSeason.number);
  const [sealedSeasons, setSealedSeasons] = useState<SealedSeason[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map());
  const [liveStats, setLiveStats] = useState<RawStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSealModal, setShowSealModal] = useState(false);
  const [sealNote, setSealNote] = useState('');
  const [sealing, setSealing] = useState(false);

  const selectedSeason = seasons.find(s => s.number === selectedNum) || seasons[0];
  const sealedData = sealedSeasons.find(s => s.season_number === selectedNum);
  const isSealed = !!sealedData;

  const p = useCallback((id: string | null | undefined) =>
    id ? profileMap.get(id) || null : null,
  [profileMap]);

  // ── Fetch all profiles once ──
  useEffect(() => {
    supabase.from('profiles').select('id, username, photo_url').then(({ data }) => {
      if (data) setProfileMap(new Map(data.map(row => [row.id, row as Profile])));
    });
  }, []);

  // ── Fetch sealed seasons ──
  const fetchSealed = useCallback(async () => {
    const { data } = await supabase.from('seasons').select('*').order('season_number');
    if (data) setSealedSeasons(data as SealedSeason[]);
  }, []);
  useEffect(() => { fetchSealed(); }, [fetchSealed]);

  // ── Fetch live stats when season not sealed ──
  useEffect(() => {
    if (isSealed) { setLoading(false); return; }
    setLoading(true);
    setLiveStats([]);
    let cancelled = false;
    supabase
      .rpc('get_player_stats_in_range', {
        p_start_date: selectedSeason.startDate,
        p_end_date:   selectedSeason.endDate,
      })
      .then(({ data }) => {
        if (!cancelled) {
          if (data) setLiveStats(data as RawStat[]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [selectedNum, isSealed, selectedSeason.startDate, selectedSeason.endDate]);

  // ── Derived live top lists ──
  const liveTopScorers   = useMemo(() => [...liveStats].sort((a, b) => b.goals   - a.goals   || b.assists - a.assists).slice(0, 3), [liveStats]);
  const liveTopAssisters = useMemo(() => [...liveStats].sort((a, b) => b.assists - a.assists || b.goals   - a.goals  ).slice(0, 3), [liveStats]);
  const liveDefender     = useMemo(() => [...liveStats].filter(s => s.best_defender_awards > 0).sort((a, b) => b.best_defender_awards - a.best_defender_awards)[0] || null, [liveStats]);
  const liveGK           = useMemo(() => [...liveStats].filter(s => s.best_gk_awards        > 0).sort((a, b) => b.best_gk_awards        - a.best_gk_awards       )[0] || null, [liveStats]);

  // ── Seal handler ──
  const handleSeal = async () => {
    if (!isAdmin) return;
    setSealing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('seasons').insert({
      season_number: selectedSeason.number,
      season_label:  selectedSeason.label,
      start_date:    selectedSeason.startDate,
      end_date:      selectedSeason.endDate,
      is_sealed:     true,
      notes:         sealNote || null,
      declared_by:   user?.id || null,
      declared_at:   new Date().toISOString(),
      scorer_1_id: liveTopScorers[0]?.player_id || null, scorer_1_goals: liveTopScorers[0]?.goals || null,
      scorer_2_id: liveTopScorers[1]?.player_id || null, scorer_2_goals: liveTopScorers[1]?.goals || null,
      scorer_3_id: liveTopScorers[2]?.player_id || null, scorer_3_goals: liveTopScorers[2]?.goals || null,
      assister_1_id: liveTopAssisters[0]?.player_id || null, assister_1_assists: liveTopAssisters[0]?.assists || null,
      assister_2_id: liveTopAssisters[1]?.player_id || null, assister_2_assists: liveTopAssisters[1]?.assists || null,
      assister_3_id: liveTopAssisters[2]?.player_id || null, assister_3_assists: liveTopAssisters[2]?.assists || null,
      defender_id: liveDefender?.player_id || null, defender_awards: liveDefender?.best_defender_awards || null,
      gk_id:       liveGK?.player_id       || null, gk_awards:       liveGK?.best_gk_awards             || null,
    });
    if (!error) {
      await fetchSealed();
      setShowSealModal(false);
      setSealNote('');
    } else {
      alert(error.message);
    }
    setSealing(false);
  };

  const S = selectedSeason.shortLabel;

  // ── Render panels (sealed vs live) ──
  const renderPanels = () => {
    if (loading) return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500" />
      </div>
    );

    const scorers   = isSealed && sealedData ? [
      { pid: sealedData.scorer_1_id,   val: sealedData.scorer_1_goals   },
      { pid: sealedData.scorer_2_id,   val: sealedData.scorer_2_goals   },
      { pid: sealedData.scorer_3_id,   val: sealedData.scorer_3_goals   },
    ] : liveTopScorers.map(s => ({ pid: s.player_id, val: s.goals }));

    const assisters = isSealed && sealedData ? [
      { pid: sealedData.assister_1_id, val: sealedData.assister_1_assists },
      { pid: sealedData.assister_2_id, val: sealedData.assister_2_assists },
      { pid: sealedData.assister_3_id, val: sealedData.assister_3_assists },
    ] : liveTopAssisters.filter(s => s.assists > 0).map(s => ({ pid: s.player_id, val: s.assists }));

    const defPid    = isSealed && sealedData ? sealedData.defender_id    : liveDefender?.player_id    || null;
    const defAwards = isSealed && sealedData ? sealedData.defender_awards : liveDefender?.best_defender_awards || null;
    const gkPid     = isSealed && sealedData ? sealedData.gk_id          : liveGK?.player_id          || null;
    const gkAwards  = isSealed && sealedData ? sealedData.gk_awards      : liveGK?.best_gk_awards      || null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Golden Boot */}
        <Panel icon="⚽" title="Golden Boot" award={`${S} Golden Boot`} color="amber">
          {scorers.filter(s => s.pid).length === 0
            ? <p className="text-neutral-600 text-sm text-center py-3">No goals yet</p>
            : scorers.map((s, i) => s.pid && (
              <RankRow key={`scorer-${i}`} rank={i} profile={p(s.pid)} stat={s.val} unit="goals" />
            ))}
        </Panel>

        {/* Playmaker */}
        <Panel icon="🎯" title="Playmaker Award" award={`${S} Playmaker Award`} color="blue">
          {assisters.filter(s => s.pid).length === 0
            ? <p className="text-neutral-600 text-sm text-center py-3">No assists yet</p>
            : assisters.map((s, i) => s.pid && (
              <RankRow key={`assister-${i}`} rank={i} profile={p(s.pid)} stat={s.val} unit="assists" />
            ))}
        </Panel>

        {/* Best Defender */}
        <Panel icon="🛡️" title="Best Defender" award={`${S} Best Defender`} color="orange">
          <WinnerRow profile={p(defPid)} stat={defAwards} unit="awards" />
        </Panel>

        {/* Golden Glove */}
        <Panel icon="🧤" title="Golden Glove" award={`${S} Golden Glove`} color="purple">
          <WinnerRow profile={p(gkPid)} stat={gkAwards} unit="awards" />
        </Panel>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase">Hall of Fame</h2>
          <p className="mt-2 text-xs sm:text-sm font-bold text-neutral-500 tracking-widest uppercase">Season Champions</p>
        </div>
        <select
          value={selectedNum}
          onChange={e => setSelectedNum(parseInt(e.target.value))}
          className="bg-neutral-900 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary-500 cursor-pointer"
        >
          {seasons.map(s => (
            <option key={s.number} value={s.number}>{s.label}</option>
          ))}
        </select>
      </motion.div>

      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {isSealed ? (
            <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sealed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" /> Live
            </span>
          )}
          {sealedData?.notes && (
            <span className="text-xs text-neutral-500 italic max-w-xs truncate">"{sealedData.notes}"</span>
          )}
        </div>

        {isAdmin && !isSealed && (
          <button
            onClick={() => setShowSealModal(true)}
            className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
          >
            <Lock className="w-3.5 h-3.5" /> Seal Season
          </button>
        )}
      </div>

      {/* Panels */}
      {renderPanels()}

      {/* ── Seal Modal ── */}
      <AnimatePresence>
        {showSealModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Handle */}
                <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto mb-5 sm:hidden" />

                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-black text-white">Seal {selectedSeason.label}</h3>
                  <button onClick={() => setShowSealModal(false)} className="text-neutral-500 hover:text-white transition-colors p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">Snapshot Preview</p>

                <div className="space-y-3 mb-5">
                  <PreviewBlock label="⚽ Golden Boot — Top 3 Scorers">
                    {liveTopScorers.filter(s => s.goals > 0).length === 0
                      ? <p className="text-xs text-neutral-600">No data</p>
                      : liveTopScorers.filter(s => s.goals > 0).map((s, i) => (
                          <PreviewRow key={s.player_id} rank={i} name={p(s.player_id)?.username || '?'} stat={`${s.goals} goals`} />
                        ))}
                  </PreviewBlock>
                  <PreviewBlock label="🎯 Playmaker Award — Top 3 Assisters">
                    {liveTopAssisters.filter(s => s.assists > 0).length === 0
                      ? <p className="text-xs text-neutral-600">No data</p>
                      : liveTopAssisters.filter(s => s.assists > 0).map((s, i) => (
                          <PreviewRow key={s.player_id} rank={i} name={p(s.player_id)?.username || '?'} stat={`${s.assists} assists`} />
                        ))}
                  </PreviewBlock>
                  <PreviewBlock label="🛡️ Best Defender — Season Winner">
                    {liveDefender
                      ? <PreviewRow rank={0} name={p(liveDefender.player_id)?.username || '?'} stat={`${liveDefender.best_defender_awards} awards`} />
                      : <p className="text-xs text-neutral-600">No awards this season</p>}
                  </PreviewBlock>
                  <PreviewBlock label="🧤 Golden Glove — Season Winner">
                    {liveGK
                      ? <PreviewRow rank={0} name={p(liveGK.player_id)?.username || '?'} stat={`${liveGK.best_gk_awards} awards`} />
                      : <p className="text-xs text-neutral-600">No awards this season</p>}
                  </PreviewBlock>
                </div>

                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">
                  Season Note (optional)
                </label>
                <textarea
                  value={sealNote}
                  onChange={e => setSealNote(e.target.value)}
                  placeholder={`e.g. ${p(liveTopScorers[0]?.player_id)?.username || 'Someone'}'s dominant season...`}
                  rows={2}
                  className="w-full bg-neutral-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500/50 resize-none placeholder-neutral-700 mb-5"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowSealModal(false); setSealNote(''); }}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-neutral-400 text-sm font-bold hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSeal}
                    disabled={sealing}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black text-sm font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    {sealing ? 'Sealing...' : 'Confirm & Seal'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
