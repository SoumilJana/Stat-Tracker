import React from 'react';
import { BookOpen } from 'lucide-react';

export default function Rules() {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary-500/20 p-3 rounded-2xl">
          <BookOpen className="w-8 h-8 text-primary-400" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-white">Rulebook</h2>
          <p className="text-neutral-400 text-sm mt-1">Official rules and edge-case resolutions</p>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-8">
        <section>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-primary-400 text-sm">1</span>
            Winner Stays - Draws
          </h3>
          <div className="text-neutral-300 space-y-2 text-sm md:text-base leading-relaxed bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <p>If a match ends in a <strong>Draw</strong> in "Winner Stays" mode:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>If there are <strong>2 or more teams waiting</strong>, BOTH playing teams rotate out to the back of the queue, and the next 2 teams step on the pitch.</li>
              <li>If there is only <strong>1 team waiting</strong>, the incumbent (the team that won the previous match) stays on the pitch, and the challenger rotates out.</li>
            </ul>
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-blue-400 text-sm">2</span>
            Man of the Season Tie-Breaker
          </h3>
          <div className="text-neutral-300 space-y-2 text-sm md:text-base leading-relaxed bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <p>If multiple players have the exact same number of Man of the Match (MOTM) awards in a single season:</p>
            <ul className="list-decimal pl-5 space-y-1 mt-2">
              <li>The player with the most <strong>Goals</strong> in that specific season wins the award.</li>
            </ul>
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-orange-400 text-sm">3</span>
            Best Defender Tie-Breaker
          </h3>
          <div className="text-neutral-300 space-y-2 text-sm md:text-base leading-relaxed bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <p>If multiple players have the exact same number of Best Defender awards in a single season:</p>
            <ul className="list-decimal pl-5 space-y-1 mt-2">
              <li>First Tie-breaker: The player with the most <strong>Goals</strong> in that specific season wins.</li>
              <li>Second Tie-breaker: If still tied, the player with the most <strong>Assists</strong> in that specific season wins.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
