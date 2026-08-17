import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
}

export function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if running in standalone (installed) mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      // @ts-ignore
      || window.navigator.standalone === true;

    if (isStandalone) {
      return; // Do nothing if already installed
    }

    // Detect if Mobile Device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|blackberry|windows phone/g.test(userAgent);
    const iOS = /iphone|ipad|ipod/.test(userAgent);

    if (!isMobile) {
      return; // Hide on Desktop as requested
    }

    setIsIOS(iOS);

    // If it's Android/Chrome, listen for the native install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show the modal
    setIsVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleClose = () => {
    // Only hides for the current session (reloads will show it again)
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1C1C1E] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-300">
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-[#2C2C2E] rounded-2xl flex items-center justify-center shadow-inner">
            <Download className="w-8 h-8 text-[#0A84FF]" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-2">
          Install StatTracker
        </h2>
        
        <p className="text-white/70 text-center mb-6 text-sm">
          Get the full app experience. Receive push notifications, track your stats, and access faster than ever.
        </p>

        {isIOS ? (
          <div className="bg-[#2C2C2E] p-4 rounded-xl">
            <p className="text-white/80 text-sm flex flex-col items-center gap-3 text-center">
              <span>To install the app on iOS:</span>
              <span className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg w-full justify-center">
                Tap <Share className="w-4 h-4 text-[#0A84FF]" /> <strong>Share</strong>
              </span>
              <span className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg w-full justify-center">
                Select <strong>Add to Home Screen</strong>
              </span>
            </p>
          </div>
        ) : (
          <button
            onClick={handleInstallClick}
            disabled={!deferredPrompt}
            className="w-full bg-[#0A84FF] hover:bg-[#0A84FF]/90 disabled:bg-[#0A84FF]/50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {deferredPrompt ? 'Install App' : 'Instructions below or via browser menu'}
          </button>
        )}
      </div>
    </div>
  );
}
