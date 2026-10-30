import { Search, X, ChevronDown, RotateCcw } from 'lucide-react';
import type { PositionFilter, SortOption } from '../types';

interface RosterNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  positionFilter: PositionFilter;
  onPositionChange: (filter: PositionFilter) => void;
  positionCounts: Record<PositionFilter, number>;
  onResetFilters: () => void;
}

export function RosterNav({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  positionFilter,
  onPositionChange,
  positionCounts,
  onResetFilters
}: RosterNavProps) {
  const showReset = searchQuery.trim() !== '' || positionFilter !== 'ALL' || sortOption !== 'rank';

  return (
    <div className="space-y-2.5 pt-1">
      {/* Row 1: Search & Sort Dropdown */}
      <div className="flex items-center gap-2.5">
        {/* Search Input with Search Icon and Clear Button */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by username or name..."
            className="w-full bg-neutral-900/90 border border-white/10 focus:border-primary-500/50 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative shrink-0">
          <select
            value={sortOption}
            onChange={e => onSortChange(e.target.value as SortOption)}
            aria-label="Sort players"
            className="appearance-none bg-neutral-900/90 border border-white/10 hover:border-white/20 text-neutral-200 text-xs font-semibold rounded-xl pl-3 pr-8 py-2.5 focus:outline-none focus:border-primary-500/50 cursor-pointer transition-all shadow-inner"
          >
            <option value="rank">Rank (Leaderboard)</option>
            <option value="ovr">OVR Rating</option>
            <option value="goals">Most Goals</option>
            <option value="assists">Most Assists</option>
            <option value="matches">Most Played</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Row 2: Horizontal Scrollable Position Filter Pills & Reset Action */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          {(['ALL', 'FWD', 'MID', 'DEF', 'GK'] as PositionFilter[]).map(pos => {
            const count = positionCounts[pos] || 0;
            const isActive = positionFilter === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => onPositionChange(pos)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-primary-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-white/5'
                }`}
              >
                <span>{pos === 'ALL' ? 'All' : pos}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-black/20 text-black font-black' : 'bg-white/5 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Reset Filters Button */}
        {showReset && (
          <button
            type="button"
            onClick={onResetFilters}
            aria-label="Reset all filters"
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/10 active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-primary-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
