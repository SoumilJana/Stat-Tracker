import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Activity, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPlayer, deletePlayer, updatePlayer } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'framer-motion';
import { enrichPlayersWithRatings } from '../lib/playerRating';
import PlayerRatingBadge from '../components/PlayerRatingBadge';
import { formatRating } from '../lib/playerRating';
import { getOnFirePlayers } from '../lib/streaks';
type Profile = {
  id: string;
  username: string;
  full_name?: string | null;
  role?: string;
  position?: 'FWD' | 'MID' | 'DEF' | 'GK';
  photo_url?: string | null;
  total_goals?: number;
  total_assists?: number;
  games_played?: number;
  rating?: number;
  onFire?: boolean;
  leaderboardRank?: number;
  isTopAssister?: boolean;
  best_defender_awards?: number;
  best_gk_awards?: number;
};

export default function Players() {
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role?.includes('admin');

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('player');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Edit Form State
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editPosition, setEditPosition] = useState<'FWD' | 'MID' | 'DEF' | 'GK'>('FWD');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);

  const fetchPlayers = async () => {
    const [statsResponse, firePlayers] = await Promise.all([
      supabase.from('player_stats').select('*').order('username'),
      getOnFirePlayers()
    ]);

    const { data } = statsResponse;

    if (data) {
      const enriched = enrichPlayersWithRatings(data, firePlayers);
      setPlayers(enriched.map(p => ({
        ...p,
        id: (p as any).id || (p as any).player_id,
        total_goals: p.total_goals || 0,
        games_played: p.games_played || 0
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleDeletePlayer = async (player: Profile) => {
    if (window.confirm(`Are you sure you want to delete ${player.username}?`)) {
      try {
        await deletePlayer(player.id);
        setPlayers(players.filter(p => p.id !== player.id));
        setSelectedPlayer(null);
      } catch (error) {
        console.error('Error deleting player:', error);
        alert('Failed to delete player');
      }
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    try {
      await createPlayer({
        username,
        password,
        role
      });
      setIsAddModalOpen(false);
      setUsername('');
      setPassword('');
      setRole('player');
      fetchPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    
    setSubmitting(true);
    setError('');
    
    try {
      let imageFile = null;

      // Handle image upload and compression
      if (editPhotoFile) {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 400,
          useWebWorker: true,
        };
        
        try {
          imageFile = await imageCompression(editPhotoFile, options);
        } catch (compErr: any) {
          if (compErr.message === 'Failed to fetch' || compErr.message.includes('Worker')) {
            options.useWebWorker = false;
            imageFile = await imageCompression(editPhotoFile, options);
          } else {
            throw compErr;
          }
        }
      }

      const response = await updatePlayer(editingPlayer.id, {
        username: editUsername,
        full_name: editFullName || null,
        photo_url: editPhotoUrl || null,
        position: editPosition,
        image_file: imageFile
      });

      const finalPhotoUrl = response.photo_url;
      
      setIsEditModalOpen(false);
      setEditPhotoFile(null);
      
      // Update selectedPlayer instantly if it's the one being edited
      if (selectedPlayer?.id === editingPlayer.id) {
        setSelectedPlayer({
          ...selectedPlayer,
          username: editUsername,
          full_name: editFullName || null,
          photo_url: finalPhotoUrl || null,
          position: editPosition
        });
      }
      
      fetchPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (player: Profile) => {
    setEditingPlayer(player);
    setEditUsername(player.username);
    setEditFullName(player.full_name || '');
    setEditPhotoUrl(player.photo_url || '');
    setEditPosition(player.position || 'FWD');
    setEditPhotoFile(null);
    setIsEditModalOpen(true);
  };

  if (loading) return <div className="text-primary-500">Loading players...</div>;

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
            className="flex items-center gap-2 bg-primary-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Player
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {players.map((player) => (
          <motion.div 
            layoutId={`card-${player.id}`}
            key={player.id} 
            onClick={() => setSelectedPlayer(player)}
            className={`group relative bg-black border rounded-2xl overflow-hidden cursor-pointer shadow-xl transition-all duration-300 aspect-[3/4] ${
              player.onFire 
                ? 'border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:shadow-[0_0_25px_rgba(249,115,22,0.6)]' 
                : 'border-white/5 hover:shadow-primary-500/20 hover:border-primary-500/30'
            }`}
          >
            {/* Background Image */}
            <motion.div layoutId={`avatar-${player.id}`} className="absolute inset-0">
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.username} className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                  <span className="text-6xl font-black text-neutral-700">{player.username.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
            </motion.div>
            
            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

            {/* Content Container */}
            <div className="absolute inset-0 p-5 flex flex-col pointer-events-none">
              
              {/* Top Row: Tags & Rating */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {player.leaderboardRank && player.leaderboardRank <= 3 && (
                    <span className="whitespace-nowrap px-2 py-1 rounded border border-white/10 bg-white/5 backdrop-blur-sm text-[9px] font-bold text-neutral-300 uppercase tracking-widest">
                      {player.leaderboardRank === 1 ? '🥇 #1' : player.leaderboardRank === 2 ? '🥈 #2' : '🥉 #3'}
                    </span>
                  )}
                  <span className={`whitespace-nowrap px-2 py-1 rounded border border-white/10 backdrop-blur-sm text-[9px] font-bold uppercase tracking-widest ${
                    player.position === 'FWD' ? 'bg-blue-500/20 text-blue-300' :
                    player.position === 'MID' ? 'bg-green-500/20 text-green-300' :
                    player.position === 'DEF' ? 'bg-yellow-500/20 text-yellow-300' :
                    player.position === 'GK' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-white/5 text-neutral-300'
                  }`}>
                    {player.position || 'FWD'}
                  </span>
                  {player.isTopAssister && (
                    <span className="whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 backdrop-blur-sm text-[9px] font-bold text-neutral-300 uppercase tracking-widest">
                      🎯 TOP ASSIST
                    </span>
                  )}
                  {(player.best_defender_awards || 0) > 0 ? (
                    <span className="whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 backdrop-blur-sm text-[9px] font-bold text-neutral-300 uppercase tracking-widest">
                      🛡️ {player.best_defender_awards}
                    </span>
                  ) : null}
                  {(player.best_gk_awards || 0) > 0 ? (
                    <span className="whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 backdrop-blur-sm text-[9px] font-bold text-neutral-300 uppercase tracking-widest">
                      🧤 {player.best_gk_awards}
                    </span>
                  ) : null}
                </div>
                {player.rating !== undefined && (
                  <div className="flex-shrink-0">
                    <PlayerRatingBadge rating={player.rating} variant="boxed" />
                  </div>
                )}
              </div>

              {/* Name & Subtitle */}
              <div>
                <motion.h3 layoutId={`username-${player.id}`} className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-md mt-1">
                  {player.username}
                </motion.h3>
                {player.full_name && (
                  <motion.p layoutId={`fullname-${player.id}`} className="text-[10px] font-bold text-primary-400 uppercase tracking-widest mt-1 drop-shadow-md">
                    {player.full_name}
                  </motion.p>
                )}
              </div>

              {/* Stats List */}
              <div className="mt-auto space-y-3 w-full">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-neutral-300">
                     <Target className="w-4 h-4 text-primary-500/80" />
                     <span className="text-[10px] font-bold uppercase tracking-widest">Goals</span>
                   </div>
                   <span className="text-base font-black text-white">{player.total_goals || 0}</span>
                </div>

                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-neutral-300">
                     <Target className="w-4 h-4 text-blue-500/80" />
                     <span className="text-[10px] font-bold uppercase tracking-widest">Assists</span>
                   </div>
                   <span className="text-base font-black text-white">{player.total_assists || 0}</span>
                </div>

                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-neutral-300">
                     <Target className="w-4 h-4 text-green-500/80" />
                     <span className="text-[10px] font-bold uppercase tracking-widest">Goals/Game</span>
                   </div>
                   <span className="text-base font-black text-white">
                     {player.games_played ? ((player.total_goals || 0) / player.games_played).toFixed(2) : "0.00"}
                   </span>
                </div>
                
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-neutral-300">
                     <Activity className="w-4 h-4 text-primary-500/80" />
                     <span className="text-[10px] font-bold uppercase tracking-widest">Played</span>
                   </div>
                   <span className="text-base font-black text-white">{player.games_played || 0}</span>
                </div>
              </div>

            </div>
          </motion.div>
        ))}
        {players.length === 0 && (
          <div className="col-span-full py-12 text-center text-neutral-500 bg-[#0B101E] border border-dashed border-neutral-800 rounded-2xl">
            No players found. Add your first player!
          </div>
        )}
      </div>

      {/* Expanded Player Card Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                layoutId={`card-${selectedPlayer.id}`}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={`bg-neutral-950 border rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl pointer-events-auto relative flex flex-col min-h-[60vh] max-h-[90vh] ${
                  selectedPlayer.onFire ? 'border-orange-500/80 shadow-[0_0_25px_rgba(249,115,22,0.5)]' : 'border-neutral-800'
                }`}
              >
                {/* Full Background Image */}
                <motion.div layoutId={`avatar-${selectedPlayer.id}`} className="absolute inset-0 overflow-hidden pointer-events-none">
                  {selectedPlayer.photo_url ? (
                    <img src={selectedPlayer.photo_url} alt={selectedPlayer.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-8xl font-bold text-neutral-800 bg-neutral-900">
                      {selectedPlayer.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </motion.div>
                
                {/* Dark Overlay for entire modal for legibility */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
                
                <button 
                  onClick={() => setSelectedPlayer(null)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/50 rounded-full text-white backdrop-blur-md transition-colors z-20"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Content Container */}
                <div className="relative z-10 flex flex-col h-full flex-1">
                  
                  {/* Header / Name Section */}
                  <div className="pt-24 px-6 sm:px-8 pb-4 mt-auto">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {selectedPlayer.leaderboardRank && selectedPlayer.leaderboardRank <= 3 && (
                        <span className="whitespace-nowrap px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm text-[10px] font-bold text-neutral-200 uppercase tracking-widest">
                          {selectedPlayer.leaderboardRank === 1 ? '🥇 #1' : selectedPlayer.leaderboardRank === 2 ? '🥈 #2' : '🥉 #3'}
                        </span>
                      )}
                      <span className={`whitespace-nowrap px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest ${
                        selectedPlayer.position === 'FWD' ? 'bg-blue-500/20 text-blue-300' :
                        selectedPlayer.position === 'MID' ? 'bg-green-500/20 text-green-300' :
                        selectedPlayer.position === 'DEF' ? 'bg-yellow-500/20 text-yellow-300' :
                        selectedPlayer.position === 'GK' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-white/5 text-neutral-300'
                      }`}>
                        {selectedPlayer.position || 'FWD'}
                      </span>
                      {selectedPlayer.isTopAssister && (
                        <span className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm text-[10px] font-bold text-neutral-200 uppercase tracking-widest">
                          🎯 TOP ASSIST
                        </span>
                      )}
                    </div>
                    <motion.h3 layoutId={`username-${selectedPlayer.id}`} className="text-4xl sm:text-5xl font-black text-white truncate drop-shadow-xl flex items-baseline gap-2">
                      {selectedPlayer.username}
                      {selectedPlayer.rating !== undefined && <PlayerRatingBadge rating={selectedPlayer.rating} size="lg" />}
                    </motion.h3>
                    {selectedPlayer.full_name && (
                      <motion.p layoutId={`fullname-${selectedPlayer.id}`} className="text-xl text-primary-400 font-medium truncate drop-shadow-md mt-1">
                        {selectedPlayer.full_name}
                      </motion.p>
                    )}
                  </div>

                  {/* Stats Section */}
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-6 overflow-y-auto w-full">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="bg-white/5 backdrop-blur-xl rounded-xl py-2.5 px-4 border border-white/10 flex flex-col items-center justify-center text-center shadow-xl flex-1 min-w-[90px]">
                        <Target className="w-4 h-4 text-primary-400 mb-1" />
                        <div className="text-2xl font-black text-white drop-shadow-md">{selectedPlayer.total_goals || 0}</div>
                        <div className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest mt-0.5">Goals</div>
                      </div>
                      <div className="bg-white/5 backdrop-blur-xl rounded-xl py-2.5 px-4 border border-white/10 flex flex-col items-center justify-center text-center shadow-xl flex-1 min-w-[90px]">
                        <Target className="w-4 h-4 text-blue-400 mb-1" />
                        <div className="text-2xl font-black text-white drop-shadow-md">{selectedPlayer.total_assists || 0}</div>
                        <div className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest mt-0.5">Assists</div>
                      </div>
                      <div className="bg-white/5 backdrop-blur-xl rounded-xl py-2.5 px-4 border border-white/10 flex flex-col items-center justify-center text-center shadow-xl flex-1 min-w-[90px]">
                        <Target className="w-4 h-4 text-green-400 mb-1" />
                        <div className="text-2xl font-black text-white drop-shadow-md">
                          {selectedPlayer.games_played ? ((selectedPlayer.total_goals || 0) / selectedPlayer.games_played).toFixed(2) : "0.00"}
                        </div>
                        <div className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest mt-0.5">Goals/Game</div>
                      </div>
                      <div className="bg-white/5 backdrop-blur-xl rounded-xl py-2.5 px-4 border border-white/10 flex flex-col items-center justify-center text-center shadow-xl flex-1 min-w-[90px]">
                        <Activity className="w-4 h-4 text-primary-400 mb-1" />
                        <div className="text-2xl font-black text-white drop-shadow-md">{selectedPlayer.games_played || 0}</div>
                        <div className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest mt-0.5">Played</div>
                      </div>
                      {selectedPlayer.best_defender_awards ? (
                        <div className="bg-white/5 backdrop-blur-xl rounded-xl py-2.5 px-4 border border-white/10 flex flex-col items-center justify-center text-center shadow-xl flex-1 min-w-[90px]">
                          <span className="text-xl mb-1 drop-shadow-md">🛡️</span>
                          <div className="text-2xl font-black text-white drop-shadow-md">{selectedPlayer.best_defender_awards}</div>
                          <div className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest mt-0.5">Best Def</div>
                        </div>
                      ) : null}
                      {selectedPlayer.best_gk_awards ? (
                        <div className="bg-white/5 backdrop-blur-xl rounded-xl py-2.5 px-4 border border-white/10 flex flex-col items-center justify-center text-center shadow-xl flex-1 min-w-[90px]">
                          <span className="text-xl mb-1 drop-shadow-md">🧤</span>
                          <div className="text-2xl font-black text-white drop-shadow-md">{selectedPlayer.best_gk_awards}</div>
                          <div className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest mt-0.5">Best GK</div>
                        </div>
                      ) : null}
                      {selectedPlayer.rating !== undefined && (
                        <div className="bg-white/5 backdrop-blur-xl rounded-xl py-2.5 px-4 border border-white/10 flex flex-col items-center justify-center text-center shadow-xl flex-1 min-w-[90px]">
                          <Activity className="w-4 h-4 text-amber-400 mb-1" />
                          <div className="text-2xl font-black text-white drop-shadow-md">{formatRating(selectedPlayer.rating)}</div>
                          <div className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest mt-0.5">OVR</div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {(user?.id === selectedPlayer.id || isAdmin) && (
                      <div className="flex justify-end gap-3 pt-4">
                        <button 
                          onClick={() => openEditModal(selectedPlayer)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl transition-all font-medium text-sm border border-white/10 hover:border-white/20"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit Profile
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeletePlayer(selectedPlayer)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md text-red-100 rounded-xl transition-all font-medium text-sm border border-red-500/30 hover:border-red-500/50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Add Player Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">Add New Player</h3>
              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. Soumil"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Temporary Password</label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. secret123"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {/* Role is hardcoded to 'player' automatically */}
                </div>
                
                {error && <p className="text-red-400 text-sm bg-red-400/10 p-2 rounded">{error}</p>}
                
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium bg-primary-500 text-black rounded-lg hover:bg-primary-600 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Player'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">Edit Profile</h3>
              <form onSubmit={handleEditPlayer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. Soumil Jana"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Position</label>
                  <select
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value as 'FWD' | 'MID' | 'DEF' | 'GK')}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="FWD">Forward (ST/RW/LW)</option>
                    <option value="MID">Midfielder (CAM/CM/CDM)</option>
                    <option value="DEF">Defender (CB/LB/RB)</option>
                    <option value="GK">Goalkeeper (GK)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Profile Photo</label>
                  <input
                    type="file"
                    accept="image/jpeg, image/png"
                    onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-primary-500 focus:border-primary-500"
                  />
                  {editPhotoFile && <p className="text-xs text-primary-400 mt-1">File selected: {editPhotoFile.name}</p>}
                </div>
                
                {error && <p className="text-red-400 text-sm bg-red-400/10 p-2 rounded">{error}</p>}
                
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium bg-primary-500 text-black rounded-lg hover:bg-primary-600 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
