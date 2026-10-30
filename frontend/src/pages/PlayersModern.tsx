import { useEffect, useState, useMemo } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { deletePlayer } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { enrichPlayersWithRatings } from '../lib/playerRating';
import { getOnFirePlayers } from '../lib/streaks';

import type { Profile, PositionFilter, SortOption } from './Players/types';
import { PlayerTiltCard } from './Players/components/PlayerTiltCard';
import { PlayerDetailModal } from './Players/components/PlayerDetailModal';
import { PlayerAddModal } from './Players/components/PlayerAddModal';
import { PlayerEditModal } from './Players/components/PlayerEditModal';
import { RosterNav } from './Players/components/RosterNav';
import { PlayersSkeleton } from './Players/components/PlayersSkeleton';

export default function PlayersModern() {
  const toast = useToast();
  const confirm = useConfirm();
  const shouldReduceMotion = useReducedMotion();
  const { user, profile } = useAuth();
  const isAdmin = user?.user_metadata?.role?.includes('admin');
  const isAnkita =
    profile?.username?.toLowerCase() === 'ankita' ||
    profile?.full_name?.toLowerCase() === 'ankita' ||
    profile?.name?.toLowerCase() === 'ankita';

  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);

  // Roster Navigation & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('rank');

  const fetchPlayers = async () => {
    const [statsResponse, firePlayers] = await Promise.all([
      supabase.from('player_stats').select('*').order('username'),
      getOnFirePlayers()
    ]);

    const { data } = statsResponse;
    if (data) {
      const enriched = enrichPlayersWithRatings(data, firePlayers);
      setPlayers(
        enriched.map(p => ({
          ...p,
          id: (p as any).id || (p as any).player_id,
          total_goals: p.total_goals || 0,
          games_played: p.games_played || 0,
          rating: p.role === 'manager' ? 110 : p.rating
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const basePlayers = useMemo(() => {
    return isAnkita
      ? players.filter(p => p.username.toLowerCase() === 'ankita' || p.username.toLowerCase() === 'soumil')
      : players;
  }, [players, isAnkita]);

  const positionCounts = useMemo(() => {
    const counts: Record<PositionFilter, number> = { ALL: basePlayers.length, FWD: 0, MID: 0, DEF: 0, GK: 0 };
    basePlayers.forEach(p => {
      if (p.position && counts[p.position] !== undefined) counts[p.position]++;
    });
    return counts;
  }, [basePlayers]);

  const filteredPlayers = useMemo(() => {
    let list = [...basePlayers];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => p.username.toLowerCase().includes(q) || (p.full_name && p.full_name.toLowerCase().includes(q)));
    }
    if (positionFilter !== 'ALL') {
      list = list.filter(p => p.position === positionFilter);
    }
    list.sort((a, b) => {
      if (sortOption !== 'rank') {
        const getVal = (p: Profile) =>
          sortOption === 'ovr' ? p.rating ?? 0 :
          sortOption === 'goals' ? p.total_goals || 0 :
          sortOption === 'assists' ? p.total_assists || 0 :
          sortOption === 'matches' ? p.games_played || 0 : 0;
        const diff = getVal(b) - getVal(a);
        if (diff !== 0) return diff;
      }
      return (a.leaderboardRank ?? 999) - (b.leaderboardRank ?? 999);
    });
    return list;
  }, [basePlayers, searchQuery, positionFilter, sortOption]);

  const handleDeletePlayer = async (player: Profile) => {
    const ok = await confirm({
      title: `Delete Player ${player.username}?`,
      description: `Are you sure you want to delete ${player.username}? This cannot be undone.`,
      confirmText: 'Delete Player',
      variant: 'danger',
      isDestructive: true
    });
    if (!ok) return;

    try {
      await deletePlayer(player.id);
      setPlayers(prev => prev.filter(p => p.id !== player.id));
      setSelectedPlayer(null);
    } catch (error) {
      console.error('Error deleting player:', error);
      toast.error('Failed to delete player');
    }
  };

  const handleOpenEdit = (player: Profile) => {
    setSelectedPlayer(null);
    setEditingPlayer(player);
    setIsEditModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setPositionFilter('ALL');
    setSortOption('rank');
  };

  if (loading) return <PlayersSkeleton />;

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">Players</h2>
          <p className="mt-1 text-sm text-neutral-400">Manage the team roster</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-primary-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Add Player
          </button>
        )}
      </div>

      <RosterNav
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOption={sortOption}
        onSortChange={setSortOption}
        positionFilter={positionFilter}
        onPositionChange={setPositionFilter}
        positionCounts={positionCounts}
        onResetFilters={handleResetFilters}
      />

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {filteredPlayers.length === 0 ? (
          basePlayers.length === 0 ? (
            <div className="col-span-full py-12 text-center text-neutral-500 bg-[#0B101E] border border-dashed border-neutral-800 rounded-2xl">
              No players found. Add your first player!
            </div>
          ) : (
            <div className="col-span-full py-12 px-4 text-center bg-neutral-900/40 border border-dashed border-neutral-800 rounded-3xl backdrop-blur-sm max-w-lg mx-auto w-full my-6 flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-white/10 flex items-center justify-center text-2xl shadow-inner">⚽</div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No players match your filters</h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  {searchQuery.trim()
                    ? `No roster results for "${searchQuery}"${positionFilter !== 'ALL' ? ` with position ${positionFilter}` : ''}.`
                    : `No players currently registered as ${positionFilter}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary-500 hover:bg-primary-400 text-black transition-all active:scale-95 shadow-lg shadow-primary-500/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset all filters</span>
              </button>
            </div>
          )
        ) : (
          filteredPlayers.map(player => (
            <PlayerTiltCard
              key={player.id}
              player={player}
              isDiamond={player.role === 'manager'}
              shouldReduceMotion={shouldReduceMotion}
              onClick={() => setSelectedPlayer(player)}
            />
          ))
        )}
      </div>

      <PlayerDetailModal
        player={selectedPlayer}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        shouldReduceMotion={shouldReduceMotion}
        onClose={() => setSelectedPlayer(null)}
        onEdit={handleOpenEdit}
        onDelete={handleDeletePlayer}
      />

      <PlayerAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchPlayers}
      />

      <PlayerEditModal
        isOpen={isEditModalOpen}
        player={editingPlayer}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingPlayer(null);
        }}
        onSuccess={updated => {
          if (updated && selectedPlayer && selectedPlayer.id === editingPlayer?.id) {
            setSelectedPlayer({ ...selectedPlayer, ...updated });
          }
          fetchPlayers();
        }}
      />
    </div>
  );
}
