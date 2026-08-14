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

  // Colour based on rating tier
  let colorClass = '';
  let boxClass = '';
  
  if (rating >= 9.0) {
    colorClass = 'text-amber-400';
    boxClass = 'border-amber-500/30 bg-amber-500/10';
  } else if (rating >= 7.5) {
    colorClass = 'text-primary-400';
    boxClass = 'border-primary-500/30 bg-primary-500/10';
  } else if (rating >= 6.0) {
    colorClass = 'text-primary-400/80';
    boxClass = 'border-primary-500/20 bg-primary-500/5';
  } else if (rating >= 4.0) {
    colorClass = 'text-neutral-300';
    boxClass = 'border-white/10 bg-white/5';
  } else {
    colorClass = 'text-neutral-500';
    boxClass = 'border-white/5 bg-white/5';
  }

  if (variant === 'boxed') {
    return (
      <span
        className={`px-2 py-1 rounded border backdrop-blur-sm ${boxClass} ${colorClass} text-[10px] font-bold tracking-widest uppercase tabular-nums`}
        title={`Rating: ${display}/10`}
      >
        ★ {display}
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
      className={`${sizeClasses[size]} ${colorClass} font-bold tabular-nums tracking-tight ml-2 opacity-80`}
      title={`Rating: ${display}/10`}
    >
      {display}
    </span>
  );
}
