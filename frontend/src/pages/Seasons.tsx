import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CheckCircle2, X, Lock, Trophy, BarChart3, Calendar, ChevronDown, Clock, ArrowRight } from 'lucide-react';
import { buildSeasons, getCurrentSeason } from '../lib/seasons';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

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
  motm_id: string | null;      motm_awards: number | null;
}

interface RawStat {
  player_id: string;
  goals: number;
  assists: number;
  best_defender_awards: number;
  best_gk_awards: number;
  motm_awards: number;
}


// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function Avatar({ profile, size = 'sm', className = '' }: { profile: Profile | null | undefined; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const cls = size === 'xl' ? 'w-20 h-20 text-3xl border-2 border-neutral-800' :
              size === 'lg' ? 'w-12 h-12 text-lg border-2 border-neutral-800' : 
              size === 'md' ? 'w-10 h-10 text-sm' : 
              'w-7 h-7 text-xs';
  if (profile?.photo_url)
    return <img src={profile.photo_url} alt={profile.username} className={`${cls} rounded-full object-cover shrink-0 ${className}`} />;
  return (
    <div className={`${cls} rounded-full bg-neutral-800 flex items-center justify-center shrink-0 ${className}`}>
      {profile ? (
        <span className="font-bold text-neutral-400">{profile.username[0]?.toUpperCase()}</span>
      ) : (
        <Users className="w-1/2 h-1/2 text-neutral-600" />
      )}
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

type PanelColor = 'amber' | 'blue' | 'emerald' | 'orange' | 'purple';
const awardColors: Record<PanelColor, { bg: string; border: string; text: string; glow: string; textGrad: string }> = {
  amber: {
    bg: 'from-amber-900/40 to-neutral-950',
    border: 'border-amber-600/50',
    text: 'text-amber-500',
    glow: 'shadow-[0_0_30px_-10px_rgba(245,158,11,0.3)]',
    textGrad: 'from-amber-300 to-amber-600',
  },
  blue: {
    bg: 'from-blue-900/40 to-neutral-950',
    border: 'border-blue-600/50',
    text: 'text-blue-500',
    glow: 'shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)]',
    textGrad: 'from-blue-300 to-blue-600',
  },
  emerald: {
    bg: 'from-emerald-900/40 to-neutral-950',
    border: 'border-emerald-600/50',
    text: 'text-emerald-500',
    glow: 'shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]',
    textGrad: 'from-emerald-300 to-emerald-600',
  },
  orange: {
    bg: 'from-orange-900/40 to-neutral-950',
    border: 'border-orange-600/50',
    text: 'text-orange-500',
    glow: 'shadow-[0_0_30px_-10px_rgba(249,115,22,0.3)]',
    textGrad: 'from-orange-300 to-orange-600',
  },
  purple: {
    bg: 'from-purple-900/40 to-neutral-950',
    border: 'border-purple-600/50',
    text: 'text-purple-500',
    glow: 'shadow-[0_0_30px_-10px_rgba(168,85,247,0.3)]',
    textGrad: 'from-purple-300 to-purple-600',
  },
};

function AwardCard({ title, subtitle, icon, color, profile, stat, unit }: {
  title: string; subtitle: string; icon: string; color: PanelColor; profile: Profile | null | undefined; stat: number | null; unit: string;
}) {
  const c = awardColors[color];
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-b ${c.bg} p-6 flex flex-col items-center text-center ${c.glow}`}>
      {/* Icon Placeholder (Since no 3D asset, we use large emoji or icon) */}
      <div className="text-6xl mb-4 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] transform hover:scale-110 transition-transform">
        {icon}
      </div>
      
      {/* Title */}
      <h4 className={`text-sm font-black uppercase tracking-widest bg-gradient-to-b ${c.textGrad} bg-clip-text text-transparent mb-1`}>{title}</h4>
      <p className="text-xs text-neutral-400 mb-6">{subtitle}</p>
      
      {/* Winner */}
      {profile ? (
        <>
          <div className="relative">
            {/* Optional glow behind avatar */}
            <div className={`absolute inset-0 rounded-full blur-md bg-gradient-to-b ${c.textGrad} opacity-30`} />
            <Avatar profile={profile} size="xl" className="relative z-10" />
            <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs z-20`}>
              {icon === '⚽' ? '🏆' : icon === '🎯' ? '🏅' : icon === '🛡️' ? '🛡️' : icon === '⭐' ? '⭐' : '🧤'}
            </div>
          </div>
          <p className="mt-4 text-lg font-black text-white">{profile.username}</p>
          <div className="mt-1 flex flex-col items-center">
            <span className={`text-4xl font-black bg-gradient-to-b ${c.textGrad} bg-clip-text text-transparent`}>{stat}</span>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">{unit}</span>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <p className="text-sm text-neutral-600 font-bold">No winner yet</p>
        </div>
      )}
      
      {/* View Leaderboard Button */}
      <button className={`mt-6 w-full py-3 rounded-full border border-white/10 text-xs font-bold text-neutral-300 hover:bg-white/5 flex items-center justify-center gap-2 transition-colors`}>
        View Leaderboard <ArrowRight className="w-3.5 h-3.5" />
      </button>
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

  useEffect(() => {
    supabase.from('profiles').select('id, username, photo_url').then(({ data }) => {
      if (data) setProfileMap(new Map(data.map(row => [row.id, row as Profile])));
    });
  }, []);

  const fetchSealed = useCallback(async () => {
    const { data } = await supabase.from('seasons').select('*').order('season_number');
    if (data) setSealedSeasons(data as SealedSeason[]);
  }, []);
  useEffect(() => { fetchSealed(); }, [fetchSealed]);

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

  const liveTopScorers   = useMemo(() => [...liveStats].sort((a, b) => b.goals   - a.goals   || b.assists - a.assists).slice(0, 3), [liveStats]);
  const liveTopAssisters = useMemo(() => [...liveStats].sort((a, b) => b.assists - a.assists || b.goals   - a.goals  ).slice(0, 3), [liveStats]);
  const liveDefender     = useMemo(() => [...liveStats].filter(s => s.best_defender_awards > 0).sort((a, b) => b.best_defender_awards - a.best_defender_awards)[0] || null, [liveStats]);
  const liveGK           = useMemo(() => [...liveStats].filter(s => s.best_gk_awards        > 0).sort((a, b) => b.best_gk_awards        - a.best_gk_awards       )[0] || null, [liveStats]);
  const liveMOTM         = useMemo(() => [...liveStats].filter(s => s.motm_awards           > 0).sort((a, b) => b.motm_awards           - a.motm_awards          )[0] || null, [liveStats]);

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
      motm_id:     liveMOTM?.player_id     || null, motm_awards:     liveMOTM?.motm_awards              || null,
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

  const now = new Date();
  const end = new Date(selectedSeason.endDate);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const renderPanels = () => {
    if (loading) return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500" />
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
    const motmPid    = isSealed && sealedData ? sealedData.motm_id        : liveMOTM?.player_id        || null;
    const motmAwards = isSealed && sealedData ? sealedData.motm_awards    : liveMOTM?.motm_awards      || null;

    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${selectedNum >= 2 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        <AwardCard 
          title="Golden Boot" 
          subtitle="Most Goals" 
          icon="⚽" 
          color="amber" 
          profile={p(scorers[0]?.pid)} 
          stat={scorers[0]?.val ?? null} 
          unit="goals" 
        />
        <AwardCard 
          title="Playmaker Award" 
          subtitle="Most Assists" 
          icon="🎯" 
          color="blue" 
          profile={p(assisters[0]?.pid)} 
          stat={assisters[0]?.val ?? null} 
          unit="assists" 
        />
        <AwardCard 
          title="Best Defender" 
          subtitle="Most MOTM (Def)" 
          icon="🛡️" 
          color="emerald" 
          profile={p(defPid)} 
          stat={defAwards} 
          unit="awards" 
        />
        <AwardCard 
          title="Golden Glove" 
          subtitle="Best Goalkeeper" 
          icon="🧤" 
          color="orange" 
          profile={p(gkPid)} 
          stat={gkAwards} 
          unit="clean sheets" 
        />
        {selectedNum >= 2 && (
          <AwardCard 
            title="Man of the Season" 
            subtitle="Most MOTM Awards" 
            icon="⭐" 
            color="purple" 
            profile={p(motmPid)} 
            stat={motmAwards} 
            unit="awards" 
          />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      {/* Header Text */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Hall of Fame</h2>
        <h1 className="text-4xl font-black text-white mb-6">Legends <span className="text-emerald-400">Live Here</span></h1>
      </motion.div>

      {/* Tabs */}
      <div className="flex bg-neutral-900 rounded-full p-1 mb-6 max-w-md">
        <button className="flex-1 bg-emerald-500/10 text-emerald-400 rounded-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 border border-emerald-500/20">
          <Trophy className="w-4 h-4" /> Season Awards
        </button>
        <button className="flex-1 text-neutral-400 rounded-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:text-white transition-colors cursor-not-allowed opacity-50">
          <BarChart3 className="w-4 h-4" /> All-Time Legends
        </button>
      </div>

      {/* Season Selector */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Calendar className="w-5 h-5 text-neutral-400" />
        </div>
        <select
          value={selectedNum}
          onChange={e => setSelectedNum(parseInt(e.target.value))}
          className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-12 pr-10 py-4 text-white font-bold outline-none appearance-none cursor-pointer focus:border-white/20 transition-colors"
        >
          {seasons.map(s => (
            <option key={s.number} value={s.number}>{s.label}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <ChevronDown className="w-4 h-4 text-neutral-500" />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div className="flex items-center gap-3">
          {isSealed ? (
            <span className="flex items-center gap-1.5 bg-neutral-800 border border-white/10 text-neutral-300 text-xs font-bold px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sealed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" /> Live Season
            </span>
          )}
          {sealedData?.notes && (
            <span className="text-xs text-neutral-500 italic max-w-xs truncate">"{sealedData.notes}"</span>
          )}
        </div>

        {!isSealed && (
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <Clock className="w-4 h-4" />
            <div className="flex flex-col text-right">
              <span className="font-bold text-white">{daysLeft > 0 ? `${daysLeft} days left` : 'Ends today'}</span>
              <span className="text-[10px]">until season ends</span>
            </div>
          </div>
        )}

        {isAdmin && !isSealed && (
          <button
            onClick={() => setShowSealModal(true)}
            className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ml-auto"
          >
            <Lock className="w-3.5 h-3.5" /> Seal Season
          </button>
        )}
      </div>

      <div className="mt-8 mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-neutral-400">Season Awards</h3>
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
                  {selectedNum >= 2 && (
                    <PreviewBlock label="⭐ Man of the Season — Season Winner">
                      {liveMOTM
                        ? <PreviewRow rank={0} name={p(liveMOTM.player_id)?.username || '?'} stat={`${liveMOTM.motm_awards} MOTM`} />
                        : <p className="text-xs text-neutral-600">No awards this season</p>}
                    </PreviewBlock>
                  )}
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
