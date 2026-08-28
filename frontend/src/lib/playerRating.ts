// =============================================================================
// Player Rating System — Centralized Calculation Engine
// =============================================================================
// Position-specific rating system.
// OVR is 70-99.
// =============================================================================

export const BASE_OVR = 70;
export const MAX_OVR = 99;

export const RELIABILITY_DIVISOR = 3; // For matches (sessions) played

// Goals/Assists/Awards benchmarks are PER SESSION (since games_played = sessions)
// We also use mini-match (team wins/losses) where available.

export const POSITIONS_CONFIG = {
  FWD: {
    weights: { GOAL: 0.40, ASSIST: 0.15, GAA: 0.20, AWARD: 0.15, RELIABILITY: 0.10 },
    benchmarks: { GOAL: 4.0, ASSIST: 1.0, GAA: 0.8, AWARD: 0.33 }
  },
  MID: {
    weights: { GOAL: 0.20, ASSIST: 0.30, GAA: 0.25, AWARD: 0.15, RELIABILITY: 0.10 },
    benchmarks: { GOAL: 2.0, ASSIST: 2.0, GAA: 0.8, AWARD: 0.33 }
  },
  DEF: {
    weights: { GOAL: 0.15, ASSIST: 0.15, GAA: 0.40, AWARD: 0.20, RELIABILITY: 0.10 },
    benchmarks: { GOAL: 1.0, ASSIST: 1.0, GAA: 0.8, AWARD: 0.33 }
  },
  GK: {
    weights: { GOAL: 0.05, ASSIST: 0.05, GAA: 0.50, AWARD: 0.30, RELIABILITY: 0.10 },
    benchmarks: { GOAL: 0.5, ASSIST: 0.5, GAA: 0.8, AWARD: 0.33 }
  }
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerStats {
  player_id?: string;
  id?: string;
  username: string;
  full_name?: string | null;
  role?: string;
  position?: 'FWD' | 'MID' | 'DEF' | 'GK';
  photo_url?: string | null;
  total_goals: number;
  total_assists: number;
  games_played: number; // sessions played
  total_wins?: number;
  total_mini_matches?: number;
  total_goals_conceded?: number;
  best_defender_awards?: number;
  best_gk_awards?: number;
}

export type PlayerWithRating = PlayerStats & { 
  rating: number; 
  onFire?: boolean;
  leaderboardRank?: number;
  isTopAssister?: boolean;
};

// ---------------------------------------------------------------------------
// Player Rating Calculation
// ---------------------------------------------------------------------------

export function calculatePlayerRating(player: PlayerStats): { rating: number } {
  const position = player.position || 'FWD';
  const config = POSITIONS_CONFIG[position];
  
  const matches = player.games_played ?? 0;
  if (matches <= 0) return { rating: BASE_OVR };

  const goals = player.total_goals ?? 0;
  const assists = player.total_assists ?? 0;
  const defAwards = player.best_defender_awards ?? 0;
  const gkAwards = player.best_gk_awards ?? 0;
  
  const miniMatches = player.total_mini_matches ?? 0;
  const conceded = player.total_goals_conceded ?? 0;

  // Compute per-session or per-mini-match averages
  const gpg = goals / matches;
  const apg = assists / matches;
  
  // Combine all awards
  const totalAwards = defAwards + gkAwards;
  const awardsPerGame = totalAwards / matches;
  
  // Goals against average per mini-match
  const gaa = miniMatches > 0 ? (conceded / miniMatches) : 1.0;

  // Calculate Reliability Score
  const reliabilityScore = 1 - Math.exp(-matches / RELIABILITY_DIVISOR);
  
  // Calculate Universal Metric Scores
  const goalScore = Math.min(1.0, gpg / config.benchmarks.GOAL);
  const assistScore = Math.min(1.0, apg / config.benchmarks.ASSIST);
  const awardScore = Math.min(1.0, awardsPerGame / config.benchmarks.AWARD);
  
  // For GAA, lower is better. 0 conceded = 1.0 score. If GAA > benchmark*2, score 0.
  const maxGaaLimit = config.benchmarks.GAA * 2;
  const gaaScore = Math.max(0, 1.0 - (gaa / maxGaaLimit));

  // Apply Positional Weights
  const performanceScore = 
    goalScore * config.weights.GOAL +
    assistScore * config.weights.ASSIST +
    gaaScore * config.weights.GAA +
    awardScore * config.weights.AWARD +
    reliabilityScore * config.weights.RELIABILITY;

  const earnablePoints = MAX_OVR - BASE_OVR;
  const rawRating = BASE_OVR + (earnablePoints * performanceScore);
  const rating = Math.round(Math.max(BASE_OVR, Math.min(MAX_OVR, rawRating)));

  return { rating };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatRating(rating: number): string {
  return Math.round(rating).toString();
}

// ---------------------------------------------------------------------------
// Convenience: Enrich an entire player list with ratings
// ---------------------------------------------------------------------------

export function enrichPlayersWithRatings(
  allPlayers: PlayerStats[],
  onFirePlayers?: Set<string>
): PlayerWithRating[] {
  let enriched = allPlayers.map((player) => {
    const { rating } = calculatePlayerRating(player);
    const playerId = player.id || player.player_id || '';
    const onFire = onFirePlayers ? onFirePlayers.has(playerId) : false;
    return { ...player, rating, onFire } as PlayerWithRating;
  });

  // Sort using standard leaderboard logic requested by user: goals - assists - matches played - awards won
  enriched.sort((a, b) => {
    const aGoals = a.total_goals || 0;
    const bGoals = b.total_goals || 0;
    if (bGoals !== aGoals) return bGoals - aGoals;

    const aAssists = a.total_assists || 0;
    const bAssists = b.total_assists || 0;
    if (bAssists !== aAssists) return bAssists - aAssists;

    const aMatches = a.games_played || 0;
    const bMatches = b.games_played || 0;
    if (bMatches !== aMatches) return bMatches - aMatches;

    const aAwards = (a.best_defender_awards || 0) + (a.best_gk_awards || 0);
    const bAwards = (b.best_defender_awards || 0) + (b.best_gk_awards || 0);
    if (bAwards !== aAwards) return bAwards - aAwards;

    return a.username.localeCompare(b.username);
  });

  // Assign Rankings
  enriched.forEach((p, index) => {
    p.leaderboardRank = index + 1;
  });

  // Assign Top Assist
  let maxAssists = -1;
  enriched.forEach(p => {
    const a = p.total_assists || 0;
    if (a > maxAssists) maxAssists = a;
  });

  if (maxAssists > 0) {
    enriched.forEach(p => {
      if ((p.total_assists || 0) === maxAssists) {
        p.isTopAssister = true;
      }
    });
  }

  return enriched;
}
