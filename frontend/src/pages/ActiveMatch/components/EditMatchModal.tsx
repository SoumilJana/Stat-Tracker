import { useState, useEffect } from 'react';

interface EditMatchModalProps {
  isOpen: boolean;
  sessionDate: string | undefined;
  sessionLocation: string | undefined;
  onSave: (date: string, time: string, location: string) => Promise<void> | void;
  onClose: () => void;
}

export function EditMatchModal({
  isOpen,
  sessionDate,
  sessionLocation,
  onSave,
  onClose
}: EditMatchModalProps) {
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionDate) {
      const dateObj = new Date(sessionDate);
      const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
      setEditDate(localDate.toISOString().split('T')[0]);
      setEditTime(localDate.toISOString().split('T')[1].slice(0, 5));
    }
    setEditLocation(sessionLocation || '');
  }, [sessionDate, sessionLocation, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editDate, editTime, editLocation);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
        <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6">
          Edit Match Details
        </h3>

        <div className="space-y-4 mb-8 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Date</label>
            <input
              type="date"
              value={editDate}
              onChange={e => setEditDate(e.target.value)}
              className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Time</label>
            <input
              type="time"
              value={editTime}
              onChange={e => setEditTime(e.target.value)}
              className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Location</label>
            <input
              type="text"
              value={editLocation}
              onChange={e => setEditLocation(e.target.value)}
              placeholder="e.g. Turf 1"
              className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary-500 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-neutral-400 hover:text-white font-bold transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-3 bg-primary-500 text-black font-black uppercase tracking-widest hover:bg-primary-400 transition-all rounded-xl cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
