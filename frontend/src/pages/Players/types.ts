export type Profile = {
  id: string;
  username: string;
  full_name?: string | null;
  role?: string;
  position?: 'FWD' | 'MID' | 'DEF' | 'GK';
  photo_url?: string | null;
  ranking_image_url?: string | null;
  total_goals?: number;
  total_assists?: number;
  games_played?: number;
  rating?: number;
  onFire?: boolean;
  leaderboardRank?: number;
  isTopAssister?: boolean;
  best_defender_awards?: number;
  best_gk_awards?: number;
  total_wins?: number;
  total_mini_matches?: number;
};

export type PositionFilter = 'ALL' | 'FWD' | 'MID' | 'DEF' | 'GK';

export type SortOption = 'rank' | 'ovr' | 'goals' | 'assists' | 'matches';
