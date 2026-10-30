import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Trash2 } from 'lucide-react';
import type { Profile } from '../types';
import { updatePlayer } from '../../../lib/api';
import { processImageFile, PORTRAIT_PRESET, RANKING_BANNER_PRESET } from '../../../lib/imageProcessing';

interface PlayerEditModalProps {
  isOpen: boolean;
  player: Profile | null;
  onClose: () => void;
  onSuccess: (updatedPlayer?: Partial<Profile>) => void;
}

export function PlayerEditModal({ isOpen, player, onClose, onSuccess }: PlayerEditModalProps) {
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (player && isOpen) {
      setEditUsername(player.username || '');
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
    }
  }, [player, isOpen]);

  const resetForm = () => {
    if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
    if (editRankingPhotoPreview) URL.revokeObjectURL(editRankingPhotoPreview);
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setRemovePhoto(false);
    setEditRankingPhotoFile(null);
    setEditRankingPhotoPreview(null);
    setRemoveRankingPhoto(false);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) return;

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

      const response = await updatePlayer(player.id, {
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

      const updatedData: Partial<Profile> = {
        username: editUsername,
        full_name: editFullName || null,
        photo_url: response.photo_url || null,
        ranking_image_url: response.ranking_image_url || null,
        position: editPosition
      };

      resetForm();
      onSuccess(updatedData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update player');
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined' || !isOpen || !player) return null;

  const activePortrait = editPhotoPreview || (!removePhoto && editPhotoUrl ? editPhotoUrl : null);
  const activeBanner = editRankingPhotoPreview || (!removeRankingPhoto && editRankingPhotoUrl ? editRankingPhotoUrl : null);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-white">Edit Profile</h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
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
                onChange={e => setEditUsername(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Full Name</label>
              <input
                type="text"
                value={editFullName}
                onChange={e => setEditFullName(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors text-sm"
                placeholder="e.g. Soumil Jana"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Position</label>
              <select
                value={editPosition}
                onChange={e => setEditPosition(e.target.value as 'FWD' | 'MID' | 'DEF' | 'GK')}
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
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">Player Portrait</label>
                <span className="text-[11px] text-neutral-400">Target: 600 × 800 px (3:4)</span>
              </div>

              <input
                id="edit-portrait-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => {
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

              {activePortrait ? (
                <div className="flex items-center gap-4 p-3 bg-neutral-800/60 rounded-xl border border-white/5">
                  <div className="w-16 h-[85px] sm:w-20 sm:h-[106px] aspect-[3/4] rounded-lg overflow-hidden border border-white/10 bg-black shrink-0 relative">
                    <img src={activePortrait} alt="Portrait" className="w-full h-full object-cover object-[center_20%]" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {editPhotoPreview ? 'New Photo Selected' : 'Current Portrait'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-400 font-bold uppercase">3:4</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-tight">Used on player cards and profile.</p>
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
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
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
                    <div className="text-[11px] text-neutral-400">Recommended 600 × 800 px (3:4 ratio)</div>
                  </div>
                </label>
              )}
            </div>

            {/* Ranking Banner Upload / Edit Section */}
            <div className="pt-2">
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">Ranking Banner</label>
                <span className="text-[11px] text-neutral-400">Target: 1200 × 300 px (~4:1)</span>
              </div>

              <input
                id="edit-banner-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => {
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

              {activeBanner ? (
                <div className="space-y-2 p-3 bg-neutral-800/60 rounded-xl border border-white/5">
                  <div className="w-full h-20 rounded-lg overflow-hidden border border-white/10 bg-black relative">
                    <img src={activeBanner} alt="Banner" className="w-full h-full object-cover object-[center_20%]" />
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
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
                      <div className="text-[11px] text-neutral-400">Wide horizontal banner (~4:1 ratio)</div>
                    </div>
                  </label>
                  <p className="text-[10px] text-neutral-500 italic px-1">
                    Optional: If omitted, the leaderboard row will fall back to the player portrait.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-xs font-medium bg-red-400/10 border border-red-500/20 p-3 rounded-xl">{error}</p>
            )}
          </div>

          <div className="p-4 sm:p-5 border-t border-neutral-800 flex justify-end gap-3 shrink-0 bg-neutral-900">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-bold bg-primary-500 text-black rounded-xl hover:bg-primary-400 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
