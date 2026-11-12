-- Migration: Weekly recurring game (default Saturday 07:00) with per-week overrides
-- Timestamp: 2026-11-12 03:00:00
--
-- How it works:
--   * game_schedule holds ONE row: the usual weekday/time/turf/fees.
--   * A daily pg_cron job calls create_scheduled_game(). When the next usual
--     game day is within `open_days_before` days (default 6 → opens on the
--     Sunday after the previous Saturday), it creates that week's game with
--     registration open.
--   * It never creates a game if ANY game (including a cancelled one) already
--     exists in that Monday–Sunday week. So:
--       - Different day/time this week → edit the auto-created game.
--       - Skip a week → cancel that week's game.
--       - Already scheduled one by hand → nothing is duplicated.

CREATE TABLE IF NOT EXISTS public.game_schedule (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),          -- single-row table
  active BOOLEAN NOT NULL DEFAULT true,
  weekday SMALLINT NOT NULL DEFAULT 6 CHECK (weekday BETWEEN 0 AND 6),  -- 0=Sun … 6=Sat
  start_time TIME NOT NULL DEFAULT '07:00',
  location TEXT NOT NULL DEFAULT 'Turf',
  amount_per_player NUMERIC NOT NULL DEFAULT 80.00,
  total_turf_cost NUMERIC NOT NULL DEFAULT 800.00,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  open_days_before SMALLINT NOT NULL DEFAULT 6 CHECK (open_days_before BETWEEN 1 AND 13),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed from the most recent game's turf/fee so the first auto game looks familiar
INSERT INTO public.game_schedule (id, location, amount_per_player, total_turf_cost, duration_minutes)
SELECT true,
       COALESCE((SELECT location FROM public.games ORDER BY game_date DESC LIMIT 1), 'Turf'),
       COALESCE((SELECT amount_per_player FROM public.games ORDER BY game_date DESC LIMIT 1), 80.00),
       800.00,
       60
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.game_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game schedule viewable by authenticated users"
  ON public.game_schedule FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Game schedule manageable by admins"
  ON public.game_schedule FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Next usual game date, and whether its week already has a game
CREATE OR REPLACE FUNCTION public.next_scheduled_game_date(p_from DATE DEFAULT NULL)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.game_schedule%ROWTYPE;
  v_now TIMESTAMP;
  v_today DATE;
  v_next DATE;
BEGIN
  SELECT * INTO s FROM public.game_schedule WHERE id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_now := NOW() AT TIME ZONE s.timezone;
  v_today := COALESCE(p_from, v_now::date);
  v_next := v_today + ((s.weekday - EXTRACT(DOW FROM v_today)::int + 7) % 7);

  -- Today is game day but kick-off has passed → next week
  IF v_next = v_today AND p_from IS NULL AND v_now::time >= s.start_time THEN
    v_next := v_next + 7;
  END IF;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_scheduled_game()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.game_schedule%ROWTYPE;
  v_today DATE;
  v_next DATE;
  v_week_start DATE;
  v_game_id UUID;
BEGIN
  SELECT * INTO s FROM public.game_schedule WHERE id FOR UPDATE;
  IF NOT FOUND OR NOT s.active THEN
    RETURN NULL;
  END IF;

  v_today := (NOW() AT TIME ZONE s.timezone)::date;
  v_next := public.next_scheduled_game_date();

  -- Too early to open registration for that game
  IF v_next - v_today > s.open_days_before THEN
    RETURN NULL;
  END IF;

  -- Any game already in that Monday–Sunday week (moved, manual, or cancelled = skipped)
  v_week_start := v_next - ((EXTRACT(ISODOW FROM v_next)::int) - 1);
  IF EXISTS (
    SELECT 1 FROM public.games
    WHERE game_date BETWEEN v_week_start AND v_week_start + 6
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.games (
    game_date, start_time, location, amount_per_player, total_turf_cost,
    duration_minutes, mode, status
  ) VALUES (
    v_next, s.start_time, s.location, s.amount_per_player, s.total_turf_cost,
    s.duration_minutes, 'STANDARD', 'REGISTRATION_OPEN'
  )
  RETURNING id INTO v_game_id;

  RETURN v_game_id;
END;
$$;

-- Only the cron job (postgres) and admins (via RPC) may trigger creation
REVOKE ALL ON FUNCTION public.create_scheduled_game() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_run_game_schedule()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can run the game schedule.';
  END IF;
  RETURN public.create_scheduled_game();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_run_game_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_run_game_schedule() TO authenticated;

-- Daily at 00:05 IST (18:35 UTC). Idempotent: does nothing when not due.
SELECT cron.unschedule('weekly-game-schedule')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-game-schedule');

SELECT cron.schedule(
  'weekly-game-schedule',
  '35 18 * * *',
  $$ SELECT public.create_scheduled_game(); $$
);
