import { useState } from 'react';

interface BulkImportModalProps {
  isOpen: boolean;
  teamPlayers: Record<string, any[]>;
  onImport: (bulkPreview: any[]) => Promise<void>;
  onClose: () => void;
}

export function BulkImportModal({
  isOpen,
  teamPlayers,
  onImport,
  onClose
}: BulkImportModalProps) {
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleParseBulk = () => {
    const allPlayers = Object.entries(teamPlayers).flatMap(([teamId, players]) =>
      players.map(p => ({ ...p, teamId }))
    );

    const lines = bulkText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];

    for (const line of lines) {
      let name = line;
      let goals = 0;
      let assists = 0;

      const gMatch = line.match(/(\d+)\s*g/i);
      if (gMatch) {
        goals = parseInt(gMatch[1], 10);
        name = name.replace(gMatch[0], '');
      }

      const aMatch = line.match(/(\d+)\s*a/i);
      if (aMatch) {
        assists = parseInt(aMatch[1], 10);
        name = name.replace(aMatch[0], '');
      }

      name = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      if (name === 'rythym') name = 'rhythm';
      if (name === 'amber') name = 'ambar';
      if (name === 'bis') name = 'biswajit';
      if (name === 'aishik') name = 'aishikrc';

      const player = allPlayers.find(
        p => p.username.toLowerCase().includes(name) || (p.full_name && p.full_name.toLowerCase().includes(name))
      );

      parsed.push({
        rawLine: line,
        player_id: player?.id,
        team_id: player?.teamId,
        username: player?.username || 'Unknown',
        goals,
        assists,
        found: !!player
      });
    }
    setBulkPreview(parsed);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImport(bulkPreview);
      setBulkText('');
      setBulkPreview([]);
      onClose();
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    setBulkText('');
    setBulkPreview([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <h3 className="text-xl font-bold text-white mb-2">Bulk Import Stats</h3>
        <p className="text-neutral-400 text-sm mb-4">Paste stats text (e.g. `Tubu 3G 2A`)</p>

        <textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          className="w-full h-32 bg-black border border-white/5 rounded-xl p-3 text-white focus:border-primary-500 outline-none font-mono text-sm mb-4"
          placeholder={'Asmit 4G 3A\nAni 2G 3A'}
        />

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleParseBulk}
            className="flex-1 py-2 bg-neutral-800 text-white font-bold rounded-lg hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            Parse
          </button>
        </div>

        {bulkPreview.length > 0 && (
          <div className="flex-1 overflow-y-auto mb-4 border border-white/5 rounded-xl bg-black/50 p-2">
            <table className="w-full text-left text-sm text-white">
              <thead>
                <tr className="border-b border-white/10 text-neutral-500">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Goals</th>
                  <th className="pb-2">Assists</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {bulkPreview.map((p, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="py-2">{p.username}</td>
                    <td className="py-2 text-primary-400 font-bold">{p.goals > 0 ? p.goals : '-'}</td>
                    <td className="py-2 text-blue-400 font-bold">{p.assists > 0 ? p.assists : '-'}</td>
                    <td className="py-2">
                      {p.found ? (
                        <span className="text-green-400 text-xs px-2 py-1 bg-green-400/10 rounded">Matched</span>
                      ) : (
                        <span className="text-red-400 text-xs px-2 py-1 bg-red-400/10 rounded">Not Found</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-3 mt-auto">
          <button
            onClick={handleCancel}
            className="flex-1 py-3 text-neutral-400 hover:text-white font-bold transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={bulkPreview.length === 0 || importing}
            onClick={handleImport}
            className="flex-1 py-3 bg-primary-500 text-black font-black uppercase tracking-widest hover:bg-primary-400 transition-all rounded-xl disabled:opacity-50 cursor-pointer"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
