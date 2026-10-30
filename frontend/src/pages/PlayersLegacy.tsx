import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Activity, Target, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPlayer, deletePlayer, updatePlayer } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { processImageFile, PORTRAIT_PRESET, RANKING_BANNER_PRESET } from '../lib/imageProcessing';
import { motion, AnimatePresence, useMotionValue, useTransform, useMotionTemplate, useSpring, useReducedMotion } from 'framer-motion';
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
  ranking_image_url?: string | null;
  total_goals?: number;
  total_assists?: number;
  games_played?: number;
  rating?: number;
  onFire?: boolean;
  leaderboardRank?: number;
  isTopAssister?: boolean;
  best_defender_awards?: number;
  best_gk_awards?: number;
  total_wins?: number;
  total_mini_matches?: number;
};

const TiltCard = ({ player, isDiamond, onClick, children, className }: any) => {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springConfig = { damping: 30, stiffness: 400, mass: 0.5 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // Reduced tilt angles for a more premium, subtle effect
  const rotateX = useTransform(smoothMouseY, [0, 1], ["10deg", "-10deg"]);
  const rotateY = useTransform(smoothMouseX, [0, 1], ["-10deg", "10deg"]);
  
  const glareX = useTransform(smoothMouseX, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(smoothMouseY, [0, 1], ["0%", "100%"]);
  
  const background = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDiamond) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / height));
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    if (!isDiamond) return;
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.div
      layoutId={`card-${player.id}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={isDiamond ? {
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      } : {}}
      className={className}
    >
      {isDiamond && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-50 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background }}
        />
      )}
      {children}
    </motion.div>
  );
};

function PlayersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-neutral-800/70 rounded-xl skeleton-shimmer" />
          <div className="h-4 w-44 bg-neutral-800/40 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-10 w-28 bg-neutral-800/50 rounded-xl skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="aspect-[3/4] bg-neutral-900/60 border border-white/5 rounded-2xl p-5 flex flex-col justify-between skeleton-shimmer relative overflow-hidden"
          >
            {/* Top row tags & rating */}
            <div className="flex justify-between items-start gap-2">
              <div className="flex gap-1.5">
                <div className="h-5 w-12 bg-neutral-800/60 rounded" />
                <div className="h-5 w-14 bg-neutral-800/40 rounded" />
              </div>
              <div className="h-6 w-9 bg-neutral-800/50 rounded-md" />
            </div>

            {/* Bottom info & stats */}
            <div className="space-y-3 mt-auto">
              <div className="space-y-1">
                <div className="h-6 w-28 bg-neutral-800/70 rounded" />
                <div className="h-3 w-16 bg-neutral-800/40 rounded" />
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between">
                  <div className="h-3 w-12 bg-neutral-800/40 rounded" />
                  <div className="h-3 w-6 bg-neutral-800/60 rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="h-3 w-14 bg-neutral-800/40 rounded" />
                  <div className="h-3 w-6 bg-neutral-800/60 rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-neutral-800/40 rounded" />
                  <div className="h-3 w-8 bg-neutral-800/60 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayersLegacy() {
  const toast = useToast();
  const confirm = useConfirm();
  const shouldReduceMotion = useReducedMotion();
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);

  // Lock background page scroll while player detail modal is open
  useEffect(() => {
    if (selectedPlayer) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [selectedPlayer]);

  const { user, profile } = useAuth();
  const isAdmin = user?.user_metadata?.role?.includes('admin');
  const isAnkita = profile?.username?.toLowerCase() === 'ankita' || profile?.full_name?.toLowerCase() === 'ankita' || profile?.name?.toLowerCase() === 'ankita';

  // Add Player Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('player');
  const [addFullName, setAddFullName] = useState('');
  const [addPosition, setAddPosition] = useState<'FWD' | 'MID' | 'DEF' | 'GK'>('FWD');
  const [addPhotoFile, setAddPhotoFile] = useState<File | null>(null);
  const [addPhotoPreview, setAddPhotoPreview] = useState<string | null>(null);
  const [addRankingFile, setAddRankingFile] = useState<File | null>(null);
  const [addRankingPreview, setAddRankingPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Edit Player Form State
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPosition, setEditPosition] = useState<'FWD' | 'MID' | 'DEF' | 'GK'>('FWD');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [editRankingPhotoUrl, setEditRankingPhotoUrl] = useState('');
  const [editRankingPhotoFile, setEditRankingPhotoFile] = useState<File | null>(null);
  const [editRankingPhotoPreview, setEditRankingPhotoPreview] = useState<string | null>(null);
  const [removeRankingPhoto, setRemoveRankingPhoto] = useState(false);

  const resetAddForm = () => {
    setUsername('');
    setPassword('');
    setRole('player');
    setAddFullName('');
    setAddPosition('FWD');
    if (addPhotoPreview) URL.revokeObjectURL(addPhotoPreview);
    if (addRankingPreview) URL.revokeObjectURL(addRankingPreview);
    setAddPhotoFile(null);
    setAddPhotoPreview(null);
    setAddRankingFile(null);
    setAddRankingPreview(null);
    setError('');
  };

  const resetEditForm = () => {
    if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
    if (editRankingPhotoPreview) URL.revokeObjectURL(editRankingPhotoPreview);
    setEditingPlayer(null);
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setRemovePhoto(false);
    setEditRankingPhotoFile(null);
    setEditRankingPhotoPreview(null);
    setRemoveRankingPhoto(false);
    setError('');
  };

  const fetchPlayers = async () => {
    const [statsResponse, firePlayers] = await Promise.all([
      supabase.from('player_stats').select('*').order('username'),
      getOnFirePlayers()
    ]);

    const { data } = statsResponse;

    if (data) {
      const enriched = enrichPlayersWithRatings(data, firePlayers);
      setPlayers(enriched.map(p => {
        const isManager = p.role === 'manager';
        return {
          ...p,
          id: (p as any).id || (p as any).player_id,
          total_goals: p.total_goals || 0,
          games_played: p.games_played || 0,
          rating: isManager ? 110 : p.rating,
        };
      }));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleDeletePlayer = async (player: Profile) => {
    const ok = await confirm({
      title: `Delete Player ${player.username}?`,
      description: `Are you sure you want to delete ${player.username}? This cannot be undone.`,
      confirmText: "Delete Player",
      variant: "danger",
      isDestructive: true
    });
    if (!ok) return;

    try {
      await deletePlayer(player.id);
      setPlayers(players.filter(p => p.id !== player.id));
      setSelectedPlayer(null);
    } catch (error) {
      console.error('Error deleting player:', error);
      toast.error('Failed to delete player');
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    try {
      let processedPortraitFile: File | null = null;
      let processedRankingFile: File | null = null;

      if (addPhotoFile) {
        processedPortraitFile = await processImageFile(addPhotoFile, PORTRAIT_PRESET);
      }
      if (addRankingFile) {
        processedRankingFile = await processImageFile(addRankingFile, RANKING_BANNER_PRESET);
      }

      await createPlayer({
        username,
        password,
        role,
        full_name: addFullName || null,
        position: addPosition,
        image_file: processedPortraitFile,
        ranking_image_file: processedRankingFile
      });

      setIsAddModalOpen(false);
      resetAddForm();
      fetchPlayers();
    } catch (err: any) {
      setError(err.message || 'Failed to create player');
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
      let processedPortraitFile: File | null = null;
      let processedRankingFile: File | null = null;

      if (editPhotoFile) {
        processedPortraitFile = await processImageFile(editPhotoFile, PORTRAIT_PRESET);
      }
      if (editRankingPhotoFile) {
        processedRankingFile = await processImageFile(editRankingPhotoFile, RANKING_BANNER_PRESET);
      }

      const response = await updatePlayer(editingPlayer.id, {
        username: editUsername,
        full_name: editFullName || null,
        photo_url: editPhotoUrl || null,
        ranking_image_url: editRankingPhotoUrl || null,
        position: editPosition,
        image_file: processedPortraitFile,
        ranking_image_file: processedRankingFile,
        remove_photo: removePhoto,
        remove_ranking_image: removeRankingPhoto
      });

      const finalPhotoUrl = response.photo_url;
      const finalRankingUrl = response.ranking_image_url;
      
      setIsEditModalOpen(false);
      resetEditForm();
      
      // Update selectedPlayer instantly if it's the one being edited
      if (selectedPlayer?.id === editingPlayer.id) {
        setSelectedPlayer({
          ...selectedPlayer,
          username: editUsername,
          full_name: editFullName || null,
          photo_url: finalPhotoUrl || null,
          ranking_image_url: finalRankingUrl || null,
          position: editPosition
        });
      }
      
      fetchPlayers();
    } catch (err: any) {
      setError(err.message || 'Failed to update player');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (player: Profile) => {
    if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
    if (editRankingPhotoPreview) URL.revokeObjectURL(editRankingPhotoPreview);
    setEditingPlayer(player);
    setEditUsername(player.username);
    setEditFullName(player.full_name || '');
    setEditPosition(player.position || 'FWD');
    setEditPhotoUrl(player.photo_url || '');
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setRemovePhoto(false);
    setEditRankingPhotoUrl(player.ranking_image_url || '');
    setEditRankingPhotoFile(null);
    setEditRankingPhotoPreview(null);
    setRemoveRankingPhoto(false);
    setError('');
    setIsEditModalOpen(true);
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
            className="flex items-center gap-2 bg-primary-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Player
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {(() => {
          const displayPlayers = isAnkita 
            ? players.filter(p => p.username.toLowerCase() === 'ankita' || p.username.toLowerCase() === 'soumil')
            : players;

          if (displayPlayers.length === 0) {
            return (
              <div className="col-span-full py-12 text-center text-neutral-500 bg-[#0B101E] border border-dashed border-neutral-800 rounded-2xl">
                No players found. Add your first player!
              </div>
            );
          }

          return displayPlayers.map((player) => {
          const isDiamond = player.role === 'manager';
          
          return (
          <TiltCard
            key={player.id} 
            player={player}
            isDiamond={isDiamond}
            onClick={() => setSelectedPlayer(player)}
            className={`group relative bg-black border rounded-2xl overflow-hidden cursor-pointer shadow-xl transition-all duration-300 aspect-[3/4] ${
              isDiamond 
                ? 'border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.6)] hover:shadow-[0_0_35px_rgba(34,211,238,0.9)]'
                : player.onFire 
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
                    isDiamond ? 'bg-cyan-500/20 text-cyan-300' :
                    player.position === 'FWD' ? 'bg-blue-500/20 text-blue-300' :
                    player.position === 'MID' ? 'bg-green-500/20 text-green-300' :
                    player.position === 'DEF' ? 'bg-yellow-500/20 text-yellow-300' :
                    player.position === 'GK' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-white/5 text-neutral-300'
                  }`}>
                    {isDiamond ? 'MANAGER' : player.position || 'FWD'}
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
          </TiltCard>
          );
        });
      })()}
      </div>

      {/* Expanded Player Card Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Modal Dialog (Full screen on mobile, floating dialog card on desktop) */}
            <motion.div
              layoutId={`card-${selectedPlayer.id}`}
              transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 26, stiffness: 320 }}
              className={`bg-neutral-950 sm:border sm:rounded-3xl overflow-hidden w-full h-[100dvh] sm:h-auto sm:max-h-[88dvh] sm:max-w-xl shadow-2xl relative flex flex-col z-10 ${
                selectedPlayer.role === 'manager'
                  ? 'sm:border-cyan-400/80 sm:shadow-[0_0_40px_rgba(34,211,238,0.7)]'
                  : selectedPlayer.onFire
                  ? 'sm:border-orange-500/80 sm:shadow-[0_0_25px_rgba(249,115,22,0.5)]'
                  : 'sm:border-neutral-800'
              }`}
            >
              {/* Subtle Background Ambient Photo */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {selectedPlayer.photo_url ? (
                  <img
                    src={selectedPlayer.photo_url}
                    alt={selectedPlayer.username}
                    className="w-full h-full object-cover object-[center_20%] opacity-25 blur-[3px] scale-105"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl font-black text-neutral-800 bg-neutral-900">
                    {selectedPlayer.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/80 via-neutral-950/92 to-neutral-950" />
              </div>

              {/* Pinned Top Bar: Safe Area, Badges, Close Button */}
              <div className="relative z-30 flex items-center justify-between px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 shrink-0 bg-neutral-950/60 backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {selectedPlayer.leaderboardRank && selectedPlayer.leaderboardRank <= 3 && (
                    <span className="whitespace-nowrap px-2.5 py-1 rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm text-[10px] font-bold text-neutral-200 uppercase tracking-widest">
                      {selectedPlayer.leaderboardRank === 1 ? '🥇 #1' : selectedPlayer.leaderboardRank === 2 ? '🥈 #2' : '🥉 #3'}
                    </span>
                  )}
                  <span className={`whitespace-nowrap px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest ${
                    selectedPlayer.role === 'manager' ? 'bg-cyan-500/20 text-cyan-300' :
                    selectedPlayer.position === 'FWD' ? 'bg-blue-500/20 text-blue-300' :
                    selectedPlayer.position === 'MID' ? 'bg-green-500/20 text-green-300' :
                    selectedPlayer.position === 'DEF' ? 'bg-yellow-500/20 text-yellow-300' :
                    selectedPlayer.position === 'GK' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-white/5 text-neutral-300'
                  }`}>
                    {selectedPlayer.role === 'manager' ? 'MANAGER' : selectedPlayer.position || 'FWD'}
                  </span>
                  {selectedPlayer.isTopAssister && (
                    <span className="whitespace-nowrap flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm text-[10px] font-bold text-neutral-200 uppercase tracking-widest">
                      🎯 TOP ASSIST
                    </span>
                  )}
                </div>

                <button 
                  onClick={() => setSelectedPlayer(null)}
                  aria-label="Close Profile"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-white/15 flex items-center justify-center text-white backdrop-blur-xl transition-all active:scale-95 shadow-lg shrink-0 ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Pinned Player Identity (Always accessible at top) */}
              <div className="relative z-20 px-4 sm:px-6 pb-3.5 shrink-0 border-b border-white/[0.08] bg-neutral-950/70 backdrop-blur-md">
                <div className="flex items-center gap-3.5 sm:gap-4">
                  {/* Avatar Thumbnail */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border border-white/15 bg-neutral-900 shrink-0 shadow-lg">
                    {selectedPlayer.photo_url ? (
                      <img
                        src={selectedPlayer.photo_url}
                        alt={selectedPlayer.username}
                        className="w-full h-full object-cover object-[center_20%]"
                        loading="eager"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-black text-neutral-600">
                        {selectedPlayer.username.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <motion.h3
                        layoutId={`username-${selectedPlayer.id}`}
                        className="text-2xl sm:text-3xl font-black text-white truncate tracking-tight drop-shadow-md"
                      >
                        {selectedPlayer.username}
                      </motion.h3>
                      {selectedPlayer.rating !== undefined && (
                        <PlayerRatingBadge rating={selectedPlayer.rating} variant="boxed" />
                      )}
                    </div>
                    {selectedPlayer.full_name && (
                      <motion.p
                        layoutId={`fullname-${selectedPlayer.id}`}
                        className="text-xs sm:text-sm text-primary-400 font-semibold tracking-wide truncate mt-0.5"
                      >
                        {selectedPlayer.full_name}
                      </motion.p>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Stats & Actions (Natural single scroll container) */}
              <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
                {/* Statistics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {/* Goals */}
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                    <Target className="w-4 h-4 text-primary-400 mb-1" />
                    <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                      {selectedPlayer.total_goals || 0}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Goals</div>
                  </div>

                  {/* Assists */}
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                    <Target className="w-4 h-4 text-blue-400 mb-1" />
                    <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                      {selectedPlayer.total_assists || 0}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Assists</div>
                  </div>

                  {/* Goals / Game */}
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                    <Target className="w-4 h-4 text-green-400 mb-1" />
                    <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                      {selectedPlayer.games_played ? ((selectedPlayer.total_goals || 0) / selectedPlayer.games_played).toFixed(2) : "0.00"}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Goals / Game</div>
                  </div>

                  {/* Matches Played */}
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                    <Activity className="w-4 h-4 text-primary-400 mb-1" />
                    <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                      {selectedPlayer.games_played || 0}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Played</div>
                  </div>

                  {/* Win Rate */}
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                    <Activity className="w-4 h-4 text-orange-400 mb-1" />
                    <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                      {selectedPlayer.games_played && selectedPlayer.games_played > 0 
                        ? Math.round(((selectedPlayer.total_wins || 0) / selectedPlayer.games_played) * 100) + '%'
                        : "0%"}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Win Rate</div>
                  </div>

                  {/* Overall Rating Card */}
                  {selectedPlayer.rating !== undefined && (
                    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                      <Activity className="w-4 h-4 text-amber-400 mb-1" />
                      <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                        {formatRating(selectedPlayer.rating)}
                      </div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">OVR</div>
                    </div>
                  )}

                  {/* Best Defender Awards */}
                  {selectedPlayer.best_defender_awards ? (
                    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                      <span className="text-lg mb-0.5 drop-shadow-md">🛡️</span>
                      <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                        {selectedPlayer.best_defender_awards}
                      </div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Best Def</div>
                    </div>
                  ) : null}

                  {/* Best GK Awards */}
                  {selectedPlayer.best_gk_awards ? (
                    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-lg">
                      <span className="text-lg mb-0.5 drop-shadow-md">🧤</span>
                      <div className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                        {selectedPlayer.best_gk_awards}
                      </div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Best GK</div>
                    </div>
                  ) : null}
                </div>

                {/* Actions */}
                {(user?.id === selectedPlayer.id || isAdmin) && (
                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button 
                      onClick={() => openEditModal(selectedPlayer)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider border border-white/15"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Profile
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeletePlayer(selectedPlayer)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 active:scale-95 text-red-200 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border border-red-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Player Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-white">Add New Player</h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddForm();
                }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddPlayer} className="flex flex-col min-h-0 flex-1">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Username *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors text-sm"
                    placeholder="e.g. Soumil"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={addFullName}
                    onChange={(e) => setAddFullName(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors text-sm"
                    placeholder="e.g. Soumil Jana"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Position</label>
                  <select
                    value={addPosition}
                    onChange={(e) => setAddPosition(e.target.value as 'FWD' | 'MID' | 'DEF' | 'GK')}
                    className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors cursor-pointer text-sm"
                  >
                    <option value="FWD">Forward (ST/RW/LW)</option>
                    <option value="MID">Midfielder (CAM/CM/CDM)</option>
                    <option value="DEF">Defender (CB/LB/RB)</option>
                    <option value="GK">Goalkeeper (GK)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Temporary Password *</label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors text-sm"
                    placeholder="e.g. secret123"
                  />
                </div>

                {/* Portrait Upload Section */}
                <div className="pt-2">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Player Portrait
                    </label>
                    <span className="text-[11px] text-neutral-400">Target: 600 × 800 px (3:4)</span>
                  </div>

                  <input
                    id="add-portrait-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (addPhotoPreview) URL.revokeObjectURL(addPhotoPreview);
                        setAddPhotoFile(file);
                        setAddPhotoPreview(URL.createObjectURL(file));
                      }
                      e.target.value = '';
                    }}
                  />

                  {addPhotoPreview ? (
                    <div className="flex items-center gap-4 p-3 bg-neutral-800/60 rounded-xl border border-white/5">
                      <div className="w-16 h-[85px] sm:w-20 sm:h-[106px] aspect-[3/4] rounded-lg overflow-hidden border border-white/10 bg-black shrink-0 relative">
                        <img
                          src={addPhotoPreview}
                          alt="Portrait Preview"
                          className="w-full h-full object-cover object-[center_20%]"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">Portrait Selected</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-400 font-bold uppercase">3:4</span>
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-tight truncate">
                          {addPhotoFile?.name}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <label
                            htmlFor="add-portrait-input"
                            className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors"
                          >
                            Change
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (addPhotoPreview) URL.revokeObjectURL(addPhotoPreview);
                              setAddPhotoFile(null);
                              setAddPhotoPreview(null);
                            }}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="add-portrait-input"
                      className="flex items-center gap-3.5 p-3.5 border-2 border-dashed border-neutral-700/80 hover:border-primary-500/60 hover:bg-neutral-800/40 rounded-xl cursor-pointer transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-neutral-800 group-hover:bg-primary-500/10 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-primary-400 transition-colors">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white group-hover:text-primary-300 transition-colors">
                          Upload Portrait Image
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Recommended 600 × 800 px (3:4 ratio)
                        </div>
                      </div>
                    </label>
                  )}
                </div>

                {/* Ranking Banner Upload Section */}
                <div className="pt-2">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Ranking Banner
                    </label>
                    <span className="text-[11px] text-neutral-400">Target: 1200 × 300 px (~4:1)</span>
                  </div>

                  <input
                    id="add-banner-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (addRankingPreview) URL.revokeObjectURL(addRankingPreview);
                        setAddRankingFile(file);
                        setAddRankingPreview(URL.createObjectURL(file));
                      }
                      e.target.value = '';
                    }}
                  />

                  {addRankingPreview ? (
                    <div className="space-y-2 p-3 bg-neutral-800/60 rounded-xl border border-white/5">
                      <div className="w-full h-20 rounded-lg overflow-hidden border border-white/10 bg-black relative">
                        <img
                          src={addRankingPreview}
                          alt="Banner Preview"
                          className="w-full h-full object-cover object-[center_20%]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/50 to-neutral-950 pointer-events-none" />
                        <div className="absolute top-2 left-2.5 text-[10px] font-bold text-white/90 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                          Leaderboard Preview
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[11px] text-neutral-400 truncate max-w-[200px]">{addRankingFile?.name}</span>
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="add-banner-input"
                            className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors"
                          >
                            Change
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (addRankingPreview) URL.revokeObjectURL(addRankingPreview);
                              setAddRankingFile(null);
                              setAddRankingPreview(null);
                            }}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label
                        htmlFor="add-banner-input"
                        className="flex items-center gap-3.5 p-3.5 border-2 border-dashed border-neutral-700/80 hover:border-primary-500/60 hover:bg-neutral-800/40 rounded-xl cursor-pointer transition-all group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-neutral-800 group-hover:bg-primary-500/10 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-primary-400 transition-colors">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white group-hover:text-primary-300 transition-colors">
                            Upload Ranking Banner
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            Wide horizontal banner (~4:1 ratio)
                          </div>
                        </div>
                      </label>
                      <p className="text-[10px] text-neutral-500 italic px-1">
                        Optional: If omitted, the leaderboard row will fall back to the player portrait.
                      </p>
                    </div>
                  )}
                </div>

                {error && <p className="text-red-400 text-xs font-medium bg-red-400/10 border border-red-500/20 p-3 rounded-xl">{error}</p>}
              </div>

              <div className="p-4 sm:p-5 border-t border-neutral-800 flex justify-end gap-3 shrink-0 bg-neutral-900">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetAddForm();
                  }}
                  className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-bold bg-primary-500 text-black rounded-xl hover:bg-primary-400 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : 'Create Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-white">Edit Profile</h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  resetEditForm();
                }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditPlayer} className="flex flex-col min-h-0 flex-1">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Username *</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors text-sm"
                    placeholder="e.g. Soumil Jana"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Position</label>
                  <select
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value as 'FWD' | 'MID' | 'DEF' | 'GK')}
                    className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors cursor-pointer text-sm"
                  >
                    <option value="FWD">Forward (ST/RW/LW)</option>
                    <option value="MID">Midfielder (CAM/CM/CDM)</option>
                    <option value="DEF">Defender (CB/LB/RB)</option>
                    <option value="GK">Goalkeeper (GK)</option>
                  </select>
                </div>

                {/* Portrait Upload / Edit Section */}
                <div className="pt-2">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Player Portrait
                    </label>
                    <span className="text-[11px] text-neutral-400">Target: 600 × 800 px (3:4)</span>
                  </div>

                  <input
                    id="edit-portrait-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
                        setEditPhotoFile(file);
                        setEditPhotoPreview(URL.createObjectURL(file));
                        setRemovePhoto(false);
                      }
                      e.target.value = '';
                    }}
                  />

                  {(() => {
                    const activePortrait = editPhotoPreview || (!removePhoto && editPhotoUrl ? editPhotoUrl : null);
                    if (activePortrait) {
                      return (
                        <div className="flex items-center gap-4 p-3 bg-neutral-800/60 rounded-xl border border-white/5">
                          <div className="w-16 h-[85px] sm:w-20 sm:h-[106px] aspect-[3/4] rounded-lg overflow-hidden border border-white/10 bg-black shrink-0 relative">
                            <img
                              src={activePortrait}
                              alt="Portrait"
                              className="w-full h-full object-cover object-[center_20%]"
                            />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">
                                {editPhotoPreview ? 'New Photo Selected' : 'Current Portrait'}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-400 font-bold uppercase">3:4</span>
                            </div>
                            <p className="text-[11px] text-neutral-400 leading-tight">
                              Used on player cards and profile.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <label
                                htmlFor="edit-portrait-input"
                                className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors"
                              >
                                Change
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
                                  setEditPhotoFile(null);
                                  setEditPhotoPreview(null);
                                  setEditPhotoUrl('');
                                  setRemovePhoto(true);
                                }}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <label
                        htmlFor="edit-portrait-input"
                        className="flex items-center gap-3.5 p-3.5 border-2 border-dashed border-neutral-700/80 hover:border-primary-500/60 hover:bg-neutral-800/40 rounded-xl cursor-pointer transition-all group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-neutral-800 group-hover:bg-primary-500/10 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-primary-400 transition-colors">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white group-hover:text-primary-300 transition-colors">
                            Upload Portrait Image
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            Recommended 600 × 800 px (3:4 ratio)
                          </div>
                        </div>
                      </label>
                    );
                  })()}
                </div>

                {/* Ranking Banner Upload / Edit Section */}
                <div className="pt-2">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Ranking Banner
                    </label>
                    <span className="text-[11px] text-neutral-400">Target: 1200 × 300 px (~4:1)</span>
                  </div>

                  <input
                    id="edit-banner-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (editRankingPhotoPreview) URL.revokeObjectURL(editRankingPhotoPreview);
                        setEditRankingPhotoFile(file);
                        setEditRankingPhotoPreview(URL.createObjectURL(file));
                        setRemoveRankingPhoto(false);
                      }
                      e.target.value = '';
                    }}
                  />

                  {(() => {
                    const activeBanner = editRankingPhotoPreview || (!removeRankingPhoto && editRankingPhotoUrl ? editRankingPhotoUrl : null);
                    if (activeBanner) {
                      return (
                        <div className="space-y-2 p-3 bg-neutral-800/60 rounded-xl border border-white/5">
                          <div className="w-full h-20 rounded-lg overflow-hidden border border-white/10 bg-black relative">
                            <img
                              src={activeBanner}
                              alt="Banner"
                              className="w-full h-full object-cover object-[center_20%]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/50 to-neutral-950 pointer-events-none" />
                            <div className="absolute top-2 left-2.5 text-[10px] font-bold text-white/90 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                              Leaderboard Preview
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[11px] text-neutral-400">
                              {editRankingPhotoPreview ? 'New banner selected' : 'Current ranking banner'}
                            </span>
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor="edit-banner-input"
                                className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors"
                              >
                                Change
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editRankingPhotoPreview) URL.revokeObjectURL(editRankingPhotoPreview);
                                  setEditRankingPhotoFile(null);
                                  setEditRankingPhotoPreview(null);
                                  setEditRankingPhotoUrl('');
                                  setRemoveRankingPhoto(true);
                                }}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1">
                        <label
                          htmlFor="edit-banner-input"
                          className="flex items-center gap-3.5 p-3.5 border-2 border-dashed border-neutral-700/80 hover:border-primary-500/60 hover:bg-neutral-800/40 rounded-xl cursor-pointer transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-neutral-800 group-hover:bg-primary-500/10 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-primary-400 transition-colors">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-white group-hover:text-primary-300 transition-colors">
                              Upload Ranking Banner
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              Wide horizontal banner (~4:1 ratio)
                            </div>
                          </div>
                        </label>
                        <p className="text-[10px] text-neutral-500 italic px-1">
                          Optional: If omitted, the leaderboard row will fall back to the player portrait.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {error && <p className="text-red-400 text-xs font-medium bg-red-400/10 border border-red-500/20 p-3 rounded-xl">{error}</p>}
              </div>

              <div className="p-4 sm:p-5 border-t border-neutral-800 flex justify-end gap-3 shrink-0 bg-neutral-900">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    resetEditForm();
                  }}
                  className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-bold bg-primary-500 text-black rounded-xl hover:bg-primary-400 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
