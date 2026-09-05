import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpinWheelProps {
  candidates: { id: string; name: string }[];
  winnerId: string;
  onFinished: () => void;
}

const WHEEL_COLORS = [
  '#f97316', // Primary Orange (orange-500)
  '#171717', // Dark Gray (neutral-900)
  '#c2410c', // Darker Orange (orange-700)
  '#262626', // Medium Gray (neutral-800)
];

const getTextColor = () => {
  return '#ffffff'; // White text looks great on all of these dark/orange backgrounds
};

export function SpinWheel({ candidates, winnerId, onFinished }: SpinWheelProps) {
  const [hasSpun, setHasSpun] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const displayCandidates = candidates.length > 0 ? candidates : [{ id: 'none', name: 'Unknown' }];
  const N = displayCandidates.length;
  const sliceAngle = 360 / N;
  
  const winnerIndex = displayCandidates.findIndex(c => c.id === winnerId);
  const safeWinnerIndex = winnerIndex === -1 ? 0 : winnerIndex;
  
  // Calculate target rotation.
  // Wheel starts at 0deg. Pointer is at 0deg (Right/3 o'clock).
  // The center of the winning slice is at: safeWinnerIndex * sliceAngle + sliceAngle / 2
  // We want to rotate the wheel backwards so the winning slice ends up at 0deg.
  // Add 6 full rotations (360 * 6) for a long spin effect.
  const sliceCenter = safeWinnerIndex * sliceAngle + (sliceAngle / 2);
  const targetRotation = (360 * 6) - sliceCenter;

  const gradientStops = displayCandidates.map((_, i) => {
    const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
    const start = i * sliceAngle;
    const end = (i + 1) * sliceAngle;
    return `${color} ${start}deg ${end}deg`;
  }).join(', ');

  const background = `conic-gradient(from 90deg, ${gradientStops})`;

  const handleSpin = () => {
    if (hasSpun) return;
    setHasSpun(true);
    
    // 4s animation
    setTimeout(() => {
      setIsFinished(true);
      setTimeout(() => {
        onFinished();
      }, 1500); // wait 1.5s after finishing before dismissing
    }, 4000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasSpun && (e.key === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleSpin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSpun]);

  return (
    <div className="fixed inset-0 w-screen h-screen z-[100] flex flex-col items-center justify-center bg-neutral-950/60 backdrop-blur-md p-4 overflow-hidden">
      
      {/* Sleek Text Overlay Above Wheel */}
      <AnimatePresence>
        {!hasSpun && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-[15%] sm:top-[20%] z-30 flex flex-col items-center gap-2 text-center px-6"
          >
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-wide">
              Tap to Spin
            </h2>
            <p className="text-neutral-300 font-medium text-sm sm:text-base uppercase tracking-widest">
              or press space
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex flex-col items-center justify-center w-full max-w-lg mt-10">
        
        {/* Wheel Container */}
        <div className="relative w-[18rem] h-[18rem] sm:w-[26rem] sm:h-[26rem]">
          
          {/* Pointer (Right Side) */}
          <div className="absolute top-1/2 -right-3 sm:-right-5 -translate-y-1/2 z-20 w-0 h-0 
               border-y-[12px] sm:border-y-[16px] border-y-transparent 
               border-r-[24px] sm:border-r-[32px] border-r-white drop-shadow-md" />

          {/* The Circular Wheel */}
          <motion.div 
            className="w-full h-full rounded-full overflow-hidden shadow-2xl cursor-pointer relative ring-4 ring-neutral-900/50"
            style={{ background }}
            initial={{ rotate: 0 }}
            animate={{ rotate: hasSpun ? targetRotation : 0 }}
            transition={{ duration: 4, ease: [0.1, 0.85, 0.15, 1] }}
            onClick={handleSpin}
          >
            {displayCandidates.map((c, i) => {
              const rotation = i * sliceAngle + (sliceAngle / 2);
              const textColor = getTextColor();

              return (
                <div 
                  key={c.id}
                  className="absolute top-1/2 left-1/2 w-[50%] h-10 -mt-5 origin-left flex items-center justify-end pr-6 sm:pr-10"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  <span 
                    className="font-bold text-lg sm:text-2xl truncate tracking-wide"
                    style={{ color: textColor }}
                  >
                    {c.name}
                  </span>
                </div>
              );
            })}

            {/* Inner Center Circle - Sleek Dark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 bg-neutral-900 border-[3px] border-neutral-950 rounded-full shadow-inner z-10" />
          </motion.div>
        </div>

        <AnimatePresence>
          {isFinished && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-20 z-30 text-center"
            >
              <h3 className="text-xl sm:text-2xl font-bold text-primary-500 uppercase tracking-widest">
                Captain Selected
              </h3>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
