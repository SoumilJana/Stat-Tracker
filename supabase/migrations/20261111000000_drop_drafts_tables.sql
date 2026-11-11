-- Migration: Drop legacy drafts tables and related enum type
-- Reason: Deprecation of drafts feature in favor of payments module

-- 1. Drop foreign key indexes if they exist
DROP INDEX IF EXISTS public.idx_draft_picks_player_id;
DROP INDEX IF EXISTS public.idx_draft_picks_captain_id;
DROP INDEX IF EXISTS public.idx_draft_picks_draft_id;
DROP INDEX IF EXISTS public.idx_draft_captains_player_id;
DROP INDEX IF EXISTS public.idx_draft_captains_draft_id;

-- 2. Drop dependent tables (order: draft_picks -> draft_captains -> drafts)
DROP TABLE IF EXISTS public.draft_picks CASCADE;
DROP TABLE IF EXISTS public.draft_captains CASCADE;
DROP TABLE IF EXISTS public.drafts CASCADE;

-- 3. Drop enum type
DROP TYPE IF EXISTS public.draft_status;
