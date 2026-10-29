import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PlayersModern from './PlayersModern';
import PlayersLegacy from './PlayersLegacy';
import { Sparkles, History } from 'lucide-react';

const STORAGE_KEY = 'stattracker_players_view_mode';

export default function Players() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryView = searchParams.get('view'); // ?view=modern or ?view=legacy

  const [viewMode, setViewMode] = useState<'modern' | 'legacy'>(() => {
    if (queryView === 'modern' || queryView === 'legacy') return queryView;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'modern' || stored === 'legacy') return stored;
    } catch {
      // Fallback for SSR or sandboxed storage
    }
    return 'modern';
  });

  // Keep state in sync if URL query parameter changes (e.g. browser back/forward)
  useEffect(() => {
    if (queryView === 'modern' || queryView === 'legacy') {
      setViewMode(queryView);
    }
  }, [queryView]);

  const handleToggle = (mode: 'modern' | 'legacy') => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage write errors
    }
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', mode);
    setSearchParams(newParams, { replace: true });
  };

  return (
    <div className="space-y-4">
      {/* Discreet local feature toggle pill */}
      <aside
        aria-label="Layout Version Toggle"
        className="flex items-center justify-between gap-3 bg-neutral-900/80 border border-white/10 rounded-2xl px-3.5 py-2 backdrop-blur-md shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />
          <span className="text-xs font-medium text-neutral-300 whitespace-nowrap">
            <span className="sm:hidden">{viewMode === 'modern' ? 'Roster View' : 'Classic View'}</span>
            <span className="hidden sm:inline">{viewMode === 'modern' ? 'Modernized Roster' : 'Classic Roster (Original)'}</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider text-neutral-300 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            {viewMode === 'modern' ? 'Active' : 'Backup Baseline'}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/5 shrink-0">
          <button
            type="button"
            onClick={() => handleToggle('modern')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'modern'
                ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary-400" />
            <span>Modern</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggle('legacy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'legacy'
                ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 text-neutral-400" />
            <span>Classic</span>
          </button>
        </div>
      </aside>

      {/* Render selected view */}
      {viewMode === 'modern' ? <PlayersModern /> : <PlayersLegacy />}
    </div>
  );
}
