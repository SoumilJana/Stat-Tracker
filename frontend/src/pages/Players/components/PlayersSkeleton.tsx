export function PlayersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-neutral-800/70 rounded-xl skeleton-shimmer" />
          <div className="h-4 w-44 bg-neutral-800/40 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-10 w-28 bg-neutral-800/50 rounded-xl skeleton-shimmer" />
      </div>

      {/* Roster Navigation Skeleton */}
      <div className="space-y-2.5 pt-1">
        <div className="flex gap-2.5">
          <div className="h-10 flex-1 bg-neutral-800/50 rounded-xl skeleton-shimmer" />
          <div className="h-10 w-36 bg-neutral-800/50 rounded-xl skeleton-shimmer" />
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-8 w-16 bg-neutral-800/40 rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>

      {/* Grid of Modern Cards */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div
            key={i}
            className="aspect-[3/4] bg-neutral-900/60 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between skeleton-shimmer relative overflow-hidden"
          >
            {/* Top row tags & rating */}
            <div className="flex justify-between items-start gap-2">
              <div className="flex gap-1.5">
                <div className="h-5 w-12 bg-neutral-800/60 rounded-lg" />
                <div className="h-5 w-14 bg-neutral-800/40 rounded-lg" />
              </div>
              <div className="h-6 w-9 bg-neutral-800/50 rounded-lg" />
            </div>

            {/* Bottom info & athletic stats strip */}
            <div className="space-y-2.5 mt-auto">
              <div className="space-y-1">
                <div className="h-6 w-28 bg-neutral-800/70 rounded" />
                <div className="h-3 w-16 bg-neutral-800/40 rounded" />
              </div>

              <div className="grid grid-cols-4 gap-1.5 pt-2.5 border-t border-white/5">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className="h-11 bg-neutral-800/40 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
