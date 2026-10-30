import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface QueueManagerModalProps {
  isOpen: boolean;
  initialPitch: any[];
  initialWaiting: any[];
  onSave: (pitch: any[], waiting: any[]) => void;
  onClose: () => void;
}

export function QueueManagerModal({
  isOpen,
  initialPitch,
  initialWaiting,
  onSave,
  onClose
}: QueueManagerModalProps) {
  const [managedPitch, setManagedPitch] = useState<any[]>(initialPitch);
  const [managedWaiting, setManagedWaiting] = useState<any[]>(initialWaiting);

  useEffect(() => {
    setManagedPitch(initialPitch);
    setManagedWaiting(initialWaiting);
  }, [initialPitch, initialWaiting]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
        <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">
          Manage Match Order
        </h3>
        <p className="text-sm text-neutral-400 mb-6">Select the two teams playing right now, and order the waiting queue below.</p>

        <div className="space-y-6 mb-8 flex-1 overflow-y-auto pr-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">On Pitch (Select 2)</label>
            <div className="space-y-2">
              {[...managedPitch, ...managedWaiting].map(team => {
                const isSelected = managedPitch.find(t => t.id === team.id);
                return (
                  <button
                    key={`pitch-${team.id}`}
                    onClick={() => {
                      if (isSelected) {
                        if (managedPitch.length > 1) {
                          setManagedPitch(managedPitch.filter(t => t.id !== team.id));
                          setManagedWaiting([...managedWaiting, team]);
                        }
                      } else if (managedPitch.length < 2) {
                        setManagedWaiting(managedWaiting.filter(t => t.id !== team.id));
                        setManagedPitch([...managedPitch, team]);
                      }
                    }}
                    className={`w-full py-3 px-4 font-bold rounded-xl border transition-colors flex justify-between items-center cursor-pointer ${
                      isSelected
                        ? 'bg-primary-500/20 text-primary-400 border-primary-500/30'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-white border-white/5 opacity-50'
                    } ${!isSelected && managedPitch.length >= 2 ? 'cursor-not-allowed opacity-30' : ''}`}
                  >
                    <span>{team.name}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          {managedWaiting.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Waiting Queue (Order matters)</label>
              <div className="space-y-2">
                {managedWaiting.map((team, idx) => (
                  <div
                    key={`waiting-${team.id}`}
                    className="w-full py-3 px-4 font-bold rounded-xl border bg-neutral-800 text-white border-white/5 flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-500 w-4">{idx + 1}.</span>
                      <span>{team.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={idx === 0}
                        onClick={() => {
                          const newW = [...managedWaiting];
                          [newW[idx - 1], newW[idx]] = [newW[idx], newW[idx - 1]];
                          setManagedWaiting(newW);
                        }}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ▲
                      </button>
                      <button
                        disabled={idx === managedWaiting.length - 1}
                        onClick={() => {
                          const newW = [...managedWaiting];
                          [newW[idx + 1], newW[idx]] = [newW[idx], newW[idx + 1]];
                          setManagedWaiting(newW);
                        }}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-neutral-400 hover:text-white font-bold transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={managedPitch.length !== 2}
            onClick={() => onSave(managedPitch, managedWaiting)}
            className="flex-1 py-3 bg-primary-500 text-black font-black uppercase tracking-widest hover:bg-primary-400 transition-all rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Confirm Order
          </button>
        </div>
      </div>
    </div>
  );
}
