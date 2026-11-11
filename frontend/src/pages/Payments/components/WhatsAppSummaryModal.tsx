import { useState } from 'react';
import { Copy, Check, MessageSquare, ExternalLink, X } from 'lucide-react';
import { formatWhatsAppSummary, getWhatsAppShareUrl } from '../../../lib/whatsappSummary';
import { copyToClipboard } from '../../../lib/upiUtils';
import type { Game, PlayerRosterItem } from '../../../types/gamePayment';

export interface WhatsAppSummaryModalProps {
  game: Game;
  activeSquad: PlayerRosterItem[];
  waitingList: PlayerRosterItem[];
  onClose: () => void;
}

export function WhatsAppSummaryModal({
  game,
  activeSquad,
  waitingList,
  onClose
}: WhatsAppSummaryModalProps) {
  const [copied, setCopied] = useState(false);

  const summaryText = formatWhatsAppSummary({
    game,
    activeSquad,
    waitingList,
    appUrl: window.location.origin + '/payments'
  });

  const shareUrl = getWhatsAppShareUrl(summaryText);

  const handleCopy = async () => {
    const success = await copyToClipboard(summaryText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-5 sm:p-7 w-full max-w-lg shadow-2xl relative my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">WhatsApp Game Summary</h3>
              <p className="text-xs text-neutral-400">Dynamic format updating as players join and pay</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Text Preview Area */}
        <div className="py-4 overflow-y-auto flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
            Message Preview:
          </label>
          <div className="bg-neutral-950 p-4 rounded-2xl border border-white/5 font-mono text-xs text-neutral-200 whitespace-pre-wrap select-all leading-relaxed max-h-72 overflow-y-auto shadow-inner">
            {summaryText}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-white/10 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs sm:text-sm border border-white/10 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
