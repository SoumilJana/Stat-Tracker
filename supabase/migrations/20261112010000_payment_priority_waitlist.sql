-- Migration: Payment-priority squad ordering & sticky 15-player capacity
-- Timestamp: 2026-11-12 01:00:00
--
-- Problem: the squad was strictly the first N players by join order, and N
-- fell from 15 back to 10 whenever the IN count dropped below 15. A single
-- dropout after 15 joined pushed players 11-14 onto the waiting list even if
-- they had already paid and been verified.
--
-- New rules:
--   1. Once a game reaches 15 IN players, its squad capacity stays at 15
--      (games.squad_capacity, never decreases automatically).
--   2. Squad order = VERIFIED payers, then AWAITING_VERIFICATION claims,
--      then everyone else; join order breaks ties within each group.
--      The waiting list is whoever falls beyond the capacity.

-- 1. Sticky squad capacity -------------------------------------------------
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS squad_capacity INTEGER NOT NULL DEFAULT 10
  CHECK (squad_capacity IN (10, 15));

-- Backfill: games already promoted to Winner Stays, or with 15+ IN players.
UPDATE public.games g
SET squad_capacity = 15
WHERE g.squad_capacity < 15
  AND (
    g.mode = 'WINNER_STAYS'
    OR (SELECT COUNT(*) FROM public.game_registrations r
        WHERE r.game_id = g.id AND r.response = 'IN') >= 15
  );

-- Keep capacity in sync from every registration path
-- (register_for_game, admin_register_player, admin_register_players).
CREATE OR REPLACE FUNCTION public.sync_game_squad_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.response = 'IN' THEN
    UPDATE public.games g
    SET squad_capacity = 15,
        updated_at = NOW()
    WHERE g.id = NEW.game_id
      AND g.squad_capacity < 15
      AND (SELECT COUNT(*) FROM public.game_registrations r
           WHERE r.game_id = NEW.game_id AND r.response = 'IN') >= 15;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_game_squad_capacity ON public.game_registrations;
CREATE TRIGGER trg_sync_game_squad_capacity
  AFTER INSERT OR UPDATE OF response ON public.game_registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_game_squad_capacity();

-- 2. Roster confirmation uses the same rules --------------------------------
-- Payment-priority ordering puts every VERIFIED payer at the top, so the squad
-- is fully verified exactly when the number of verified IN players reaches the
-- squad size (capacity, or fewer if fewer players are IN).
CREATE OR REPLACE FUNCTION public.admin_confirm_roster(
  p_game_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_active_count INTEGER;
  v_verified_count INTEGER;
  v_required_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can confirm the match roster.';
  END IF;

  SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.game_registrations
  WHERE game_id = p_game_id AND response = 'IN';

  IF v_active_count < 10 THEN
    RAISE EXCEPTION 'Cannot confirm roster with fewer than 10 players.';
  END IF;

  v_required_count := LEAST(v_game.squad_capacity, v_active_count);

  SELECT COUNT(*) INTO v_verified_count
  FROM public.game_registrations r
  JOIN public.game_payments p ON p.game_id = r.game_id AND p.user_id = r.user_id
  WHERE r.game_id = p_game_id
    AND r.response = 'IN'
    AND p.status = 'VERIFIED';

  IF v_verified_count < v_required_count THEN
    RAISE EXCEPTION 'Cannot confirm roster: only % of % required active players are verified.', v_verified_count, v_required_count;
  END IF;

  UPDATE public.games
  SET status = 'ROSTER_CONFIRMED',
      registration_closed_at = COALESCE(registration_closed_at, NOW()),
      roster_confirmed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_game_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'ROSTER_CONFIRMED',
    'verified_players', LEAST(v_verified_count, v_required_count),
    'mode', v_game.mode
  );
END;
$$;
