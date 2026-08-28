import { formatRating } from '../lib/playerRating';

interface PlayerRatingBadgeProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'boxed';
}

/**
 * Rating badge shown beside player names or as a box tag.
 */
export default function PlayerRatingBadge({
  rating,
  size = 'sm',
  variant = 'inline'
}: PlayerRatingBadgeProps) {
  const display = formatRating(rating);

  // Colour based on FIFA rating tier
  let colorClass = '';
  let boxClass = '';
  
  if (rating >= 90) {
    // Elite / Rare Gold
    colorClass = 'text-amber-300';
    boxClass = 'border-amber-400/50 bg-gradient-to-br from-amber-600/20 to-amber-400/10 shadow-[0_0_10px_rgba(251,191,36,0.3)]';
  } else if (rating >= 80) {
    // Gold
    colorClass = 'text-amber-500';
    boxClass = 'border-amber-500/30 bg-amber-500/10';
  } else if (rating >= 75) {
    // Silver
    colorClass = 'text-neutral-300';
    boxClass = 'border-neutral-400/30 bg-neutral-400/10';
  } else {
    // Bronze
    colorClass = 'text-orange-700';
    boxClass = 'border-orange-800/30 bg-orange-800/10';
  }

  if (variant === 'boxed') {
    return (
      <span
        className={`px-2 py-1 rounded border backdrop-blur-sm ${boxClass} ${colorClass} text-xs font-black tracking-widest tabular-nums flex items-center justify-center`}
        title={`OVR: ${display}`}
      >
        <span className="text-[9px] mr-1 opacity-70">OVR</span>
        {display}
      </span>
    );
  }

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span
      className={`${sizeClasses[size]} ${colorClass} font-black tabular-nums tracking-tight ml-2`}
      title={`OVR: ${display}`}
    >
      {display}
    </span>
  );
}
