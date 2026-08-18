-- Indexes for 'events' table
CREATE INDEX IF NOT EXISTS idx_events_session_id ON public.events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_player_id ON public.events(player_id);
CREATE INDEX IF NOT EXISTS idx_events_team_id ON public.events(team_id);
CREATE INDEX IF NOT EXISTS idx_events_assisted_by ON public.events(assisted_by);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);

-- Indexes for 'team_players' table
CREATE INDEX IF NOT EXISTS idx_team_players_team_id ON public.team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_team_players_player_id ON public.team_players(player_id);

-- Indexes for 'teams' table
CREATE INDEX IF NOT EXISTS idx_teams_session_id ON public.teams(session_id);


-- Indexes for 'draft_captains' table
CREATE INDEX IF NOT EXISTS idx_draft_captains_draft_id ON public.draft_captains(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_captains_player_id ON public.draft_captains(player_id);

-- Indexes for 'draft_picks' table
CREATE INDEX IF NOT EXISTS idx_draft_picks_draft_id ON public.draft_picks(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_captain_id ON public.draft_picks(captain_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_player_id ON public.draft_picks(player_id);
