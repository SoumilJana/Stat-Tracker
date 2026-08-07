import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Activity, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPlayer } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'framer-motion';

type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  photo_url: string | null;
  total_goals?: number;
  games_played?: number;
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
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);

  const fetchPlayers = async () => {
    const { data } = await supabase.from('player_stats').select('*').order('username');
    if (data) {
      setPlayers(data.map(p => ({
        ...p,
        id: p.id || p.player_id
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

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
      let finalPhotoUrl = editPhotoUrl;

      // Handle image upload and compression
      if (editPhotoFile) {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 400,
          useWebWorker: true,
        };
        
        const compressedFile = await imageCompression(editPhotoFile, options);
        const fileName = `${editingPlayer.id}-${Date.now()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, compressedFile, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
          
        finalPhotoUrl = publicUrlData.publicUrl;
      }

      // Update the base profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: editUsername,
          full_name: editFullName || null,
          photo_url: finalPhotoUrl || null
        })
        .eq('id', editingPlayer.id);

      if (updateError) throw updateError;
      
      setIsEditModalOpen(false);
      setEditPhotoFile(null);
      
      // Update selectedPlayer instantly if it's the one being edited
      if (selectedPlayer?.id === editingPlayer.id) {
        setSelectedPlayer({
          ...selectedPlayer,
          username: editUsername,
          full_name: editFullName || null,
          photo_url: finalPhotoUrl || null
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <motion.div 
            layoutId={`card-${player.id}`}
            key={player.id} 
            onClick={() => setSelectedPlayer(player)}
            className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col cursor-pointer hover:border-primary-500/50 transition-colors"
          >
            <div className="p-6 flex items-start gap-4">
              <motion.div layoutId={`avatar-${player.id}`} className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center border-2 border-primary-500/30 flex-shrink-0 text-xl font-bold text-neutral-300 overflow-hidden">
                {player.photo_url ? (
                  <img src={player.photo_url} alt={player.username} className="w-full h-full object-cover" />
                ) : (
                  player.username.substring(0, 2).toUpperCase()
                )}
              </motion.div>
              <div className="flex-1 min-w-0">
                <motion.h3 layoutId={`username-${player.id}`} className="text-lg font-bold text-white truncate">{player.username}</motion.h3>
                {player.full_name && (
                  <motion.p layoutId={`fullname-${player.id}`} className="text-sm text-neutral-400 truncate">{player.full_name}</motion.p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-300 uppercase tracking-wider">
                    {player.role}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {players.length === 0 && (
          <div className="col-span-full py-12 text-center text-neutral-500 bg-neutral-900 border border-dashed border-neutral-700 rounded-xl">
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
                className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl pointer-events-auto relative flex flex-col max-h-[90vh]"
              >
                {/* Background Image / Header */}
                <div className="relative h-64 sm:h-80 w-full bg-neutral-800 flex items-center justify-center flex-shrink-0">
                  <motion.div layoutId={`avatar-${selectedPlayer.id}`} className="absolute inset-0 overflow-hidden">
                    {selectedPlayer.photo_url ? (
                      <img src={selectedPlayer.photo_url} alt={selectedPlayer.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-neutral-700 bg-neutral-800">
                        {selectedPlayer.username.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </motion.div>
                  {/* Dark Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-900/60 to-transparent" />
                  
                  <button 
                    onClick={() => setSelectedPlayer(null)}
                    className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-colors z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="absolute bottom-6 left-6 right-6 z-10">
                    <motion.h3 layoutId={`username-${selectedPlayer.id}`} className="text-3xl sm:text-4xl font-black text-white truncate drop-shadow-lg">
                      {selectedPlayer.username}
                    </motion.h3>
                    {selectedPlayer.full_name && (
                      <motion.p layoutId={`fullname-${selectedPlayer.id}`} className="text-lg text-primary-400 font-medium truncate drop-shadow-md">
                        {selectedPlayer.full_name}
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Stats Section */}
                <div className="p-6 sm:p-8 space-y-8 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-950/50 rounded-xl p-4 border border-neutral-800 flex flex-col items-center justify-center text-center">
                      <Activity className="w-6 h-6 text-primary-500 mb-2" />
                      <div className="text-4xl font-black text-white">{selectedPlayer.games_played || 0}</div>
                      <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mt-1">Games Played</div>
                    </div>
                    <div className="bg-neutral-950/50 rounded-xl p-4 border border-neutral-800 flex flex-col items-center justify-center text-center">
                      <Target className="w-6 h-6 text-primary-500 mb-2" />
                      <div className="text-4xl font-black text-white">{selectedPlayer.total_goals || 0}</div>
                      <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mt-1">Goals Scored</div>
                    </div>
                  </div>

                  {/* Actions */}
                  {(user?.id === selectedPlayer.id || isAdmin) && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
                      <button 
                        onClick={() => openEditModal(selectedPlayer)}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors font-medium text-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Profile
                      </button>
                      {isAdmin && (
                        <button className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors font-medium text-sm">
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
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
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="player">Player</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
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
