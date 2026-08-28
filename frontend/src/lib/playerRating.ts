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
    weights: { GOAL: 0.60, ASSIST: 0.20, WIN: 0.10, RELIABILITY: 0.10 },
    benchmarks: { GOAL: 3.0, ASSIST: 1.0, WIN_PCT: 0.60 }
  },
  MID: {
    weights: { GOAL: 0.30, ASSIST: 0.40, WIN: 0.20, RELIABILITY: 0.10 },
    benchmarks: { GOAL: 1.5, ASSIST: 2.0, WIN_PCT: 0.60 }
  },
  DEF: {
    weights: { GAA: 0.40, AWARD: 0.30, OFFENSE: 0.20, RELIABILITY: 0.10 },
    benchmarks: { GAA: 0.8, AWARD: 0.33, OFFENSE: 1.5 } // Offense = Goals + Assists
  },
  GK: {
    weights: { GAA: 0.40, AWARD: 0.30, WIN: 0.20, RELIABILITY: 0.10 },
    benchmarks: { GAA: 0.8, AWARD: 0.33, WIN_PCT: 0.60 }
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
  
  const wins = player.total_wins ?? 0;
  const miniMatches = player.total_mini_matches ?? 0;
  const conceded = player.total_goals_conceded ?? 0;

  // Compute per-session or per-mini-match averages
  const gpg = goals / matches;
  const apg = assists / matches;
  const offPerGame = (goals + assists) / matches;
  const defAwardsPerGame = defAwards / matches;
  const gkAwardsPerGame = gkAwards / matches;
  
  const winPct = miniMatches > 0 ? (wins / miniMatches) : 0.5; // default to 50% if no data
  const gaa = miniMatches > 0 ? (conceded / miniMatches) : 1.0; // default to 1.0 if no data

  // Calculate Reliability
  const reliabilityScore = 1 - Math.exp(-matches / RELIABILITY_DIVISOR);
  
  let performanceScore = 0;

  if (position === 'FWD') {
    const cfg = config as typeof POSITIONS_CONFIG.FWD;
    const goalScore = Math.min(1.0, gpg / cfg.benchmarks.GOAL);
    const assistScore = Math.min(1.0, apg / cfg.benchmarks.ASSIST);
    const winScore = Math.min(1.0, winPct / cfg.benchmarks.WIN_PCT);
    
    performanceScore = 
      goalScore * cfg.weights.GOAL +
      assistScore * cfg.weights.ASSIST +
      winScore * cfg.weights.WIN +
      reliabilityScore * cfg.weights.RELIABILITY;
  } 
  else if (position === 'MID') {
    const cfg = config as typeof POSITIONS_CONFIG.MID;
    const goalScore = Math.min(1.0, gpg / cfg.benchmarks.GOAL);
    const assistScore = Math.min(1.0, apg / cfg.benchmarks.ASSIST);
    const winScore = Math.min(1.0, winPct / cfg.benchmarks.WIN_PCT);
    
    performanceScore = 
      goalScore * cfg.weights.GOAL +
      assistScore * cfg.weights.ASSIST +
      winScore * cfg.weights.WIN +
      reliabilityScore * cfg.weights.RELIABILITY;
  }
  else if (position === 'DEF') {
    const cfg = config as typeof POSITIONS_CONFIG.DEF;
    // For GAA, lower is better. 0 conceded = 1.0 score. If GAA > benchmark*2, score 0.
    const maxGaaLimit = cfg.benchmarks.GAA * 2;
    const gaaScore = Math.max(0, 1.0 - (gaa / maxGaaLimit));
    const awardScore = Math.min(1.0, defAwardsPerGame / cfg.benchmarks.AWARD);
    const offScore = Math.min(1.0, offPerGame / cfg.benchmarks.OFFENSE);
    
    performanceScore = 
      gaaScore * cfg.weights.GAA +
      awardScore * cfg.weights.AWARD +
      offScore * cfg.weights.OFFENSE +
      reliabilityScore * cfg.weights.RELIABILITY;
  }
  else if (position === 'GK') {
    const cfg = config as typeof POSITIONS_CONFIG.GK;
    const maxGaaLimit = cfg.benchmarks.GAA * 2;
    const gaaScore = Math.max(0, 1.0 - (gaa / maxGaaLimit));
    const awardScore = Math.min(1.0, gkAwardsPerGame / cfg.benchmarks.AWARD);
    const winScore = Math.min(1.0, winPct / cfg.benchmarks.WIN_PCT);
    
    performanceScore = 
      gaaScore * cfg.weights.GAA +
      awardScore * cfg.weights.AWARD +
      winScore * cfg.weights.WIN +
      reliabilityScore * cfg.weights.RELIABILITY;
  }

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

  // Sort using standard leaderboard logic
  enriched.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;

    const aGoals = a.total_goals || 0;
    const bGoals = b.total_goals || 0;
    if (bGoals !== aGoals) return bGoals - aGoals;

    const aAssists = a.total_assists || 0;
    const bAssists = b.total_assists || 0;
    if (bAssists !== aAssists) return bAssists - aAssists;

    const aMatches = a.games_played || 0;
    const bMatches = b.games_played || 0;
    if (bMatches !== aMatches) return bMatches - aMatches;

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
