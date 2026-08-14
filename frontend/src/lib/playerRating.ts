// =============================================================================
// Player Rating System — Centralized Calculation Engine
// =============================================================================
//
// Rating = (GoalScore × 0.50) + (AssistScore × 0.20)
//        + (ContributionScore × 0.20) + (ReliabilityScore × 0.10)
//
// All components are 0–10. Final rating is clamped to 0–10.
// The rating is a live cumulative tournament performance snapshot.
// =============================================================================

// ---------------------------------------------------------------------------
// Configurable Constants
// ---------------------------------------------------------------------------

export const RATING_CONFIG = {
  // Component weights (must sum to 1.00)
  GOAL_WEIGHT: 0.50,
  ASSIST_WEIGHT: 0.20,
  CONTRIBUTION_WEIGHT: 0.20,
  RELIABILITY_WEIGHT: 0.10,

  // Scoring benchmarks (adjusted GPG/APG value that maps to a perfect 10)
  GOAL_BENCHMARK: 3.0,
  ASSIST_BENCHMARK: 1.5,

  // Total contribution benchmark (G+A value that maps to a perfect 10)
  CONTRIBUTION_BENCHMARK: 20,

  // Bayesian smoothing: adds N virtual matches at league-average rate
  SMOOTHING_MATCHES: 2,

  // Reliability curve divisor (higher = slower saturation)
  RELIABILITY_DIVISOR: 3,
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
  photo_url?: string | null;
  total_goals: number;
  total_assists: number;
  games_played: number;
}

export interface TournamentAverages {
  leagueAvgGPG: number;
  leagueAvgAPG: number;
}

export interface RatingBreakdown {
  rating: number;
  goalScore: number;
  assistScore: number;
  contributionScore: number;
  reliabilityScore: number;
}

export type PlayerWithRating = PlayerStats & { rating: number };

// ---------------------------------------------------------------------------
// Tournament-Wide Averages
// ---------------------------------------------------------------------------

/**
 * Calculate tournament-wide average goals and assists per match.
 * Uses only players with at least 1 match to avoid skewing the average.
 * Returns sensible defaults if no data exists.
 */
export function calculateTournamentAverages(
  allPlayers: PlayerStats[]
): TournamentAverages {
  let totalGoals = 0;
  let totalAssists = 0;
  let totalMatches = 0;

  for (const p of allPlayers) {
    const matches = p.games_played ?? 0;
    if (matches > 0) {
      totalGoals += p.total_goals ?? 0;
      totalAssists += p.total_assists ?? 0;
      totalMatches += matches;
    }
  }

  if (totalMatches === 0) {
    return { leagueAvgGPG: 0, leagueAvgAPG: 0 };
  }

  return {
    leagueAvgGPG: totalGoals / totalMatches,
    leagueAvgAPG: totalAssists / totalMatches,
  };
}

// ---------------------------------------------------------------------------
// Player Rating Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a single player's rating breakdown from their cumulative stats
 * and the current tournament-wide averages.
 *
 * Identical inputs always produce identical outputs (deterministic).
 */
export function calculatePlayerRating(
  player: PlayerStats,
  averages: TournamentAverages
): RatingBreakdown {
  const goals = player.total_goals ?? 0;
  const assists = player.total_assists ?? 0;
  const matches = player.games_played ?? 0;

  const {
    GOAL_BENCHMARK,
    ASSIST_BENCHMARK,
    CONTRIBUTION_BENCHMARK,
    SMOOTHING_MATCHES,
    RELIABILITY_DIVISOR,
    GOAL_WEIGHT,
    ASSIST_WEIGHT,
    CONTRIBUTION_WEIGHT,
    RELIABILITY_WEIGHT,
  } = RATING_CONFIG;

  // --- Goal Performance (50%) ---
  // Bayesian-smoothed goals per game
  const adjustedGPG =
    (goals + averages.leagueAvgGPG * SMOOTHING_MATCHES) /
    (matches + SMOOTHING_MATCHES);
  const goalScore = Math.min(10, (adjustedGPG / GOAL_BENCHMARK) * 10);

  // --- Assist Performance (20%) ---
  // Bayesian-smoothed assists per game
  const adjustedAPG =
    (assists + averages.leagueAvgAPG * SMOOTHING_MATCHES) /
    (matches + SMOOTHING_MATCHES);
  const assistScore = Math.min(10, (adjustedAPG / ASSIST_BENCHMARK) * 10);

  // --- Total Contribution (20%) ---
  const totalContribution = goals + assists;
  const contributionScore = Math.min(
    10,
    (totalContribution / CONTRIBUTION_BENCHMARK) * 10
  );

  // --- Reliability / Sample Size (10%) ---
  const reliabilityScore =
    10 * (1 - Math.exp(-matches / RELIABILITY_DIVISOR));

  // --- Final Rating ---
  const rawRating =
    goalScore * GOAL_WEIGHT +
    assistScore * ASSIST_WEIGHT +
    contributionScore * CONTRIBUTION_WEIGHT +
    reliabilityScore * RELIABILITY_WEIGHT;

  const rating = Math.max(0, Math.min(10, rawRating));

  return {
    rating,
    goalScore,
    assistScore,
    contributionScore,
    reliabilityScore,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format a rating value to one decimal place for display. */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

// ---------------------------------------------------------------------------
// Convenience: Enrich an entire player list with ratings
// ---------------------------------------------------------------------------

/**
 * Compute tournament averages once, then attach a `rating` field to every player.
 * Returns a new array (does not mutate the input).
 */
export function enrichPlayersWithRatings(
  allPlayers: PlayerStats[]
): PlayerWithRating[] {
  const averages = calculateTournamentAverages(allPlayers);

  return allPlayers.map((player) => {
    const { rating } = calculatePlayerRating(player, averages);
    return { ...player, rating };
  });
}
