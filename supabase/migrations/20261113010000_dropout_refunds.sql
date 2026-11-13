-- Migration: Late dropouts, automatic refund flags and admin "Remove player"
-- Timestamp: 2026-11-13 01:00:00
--
-- Rules:
--   * Players may tap OUT even after the roster is locked, until kickoff.
--     Tapping IN stays blocked once the roster is locked/closed.
--   * IN -> OUT: a VERIFIED or AWAITING_VERIFICATION payment becomes
--     REFUND_PENDING (the admin returns the money and taps Mark Settled).
--     Any other payment (cash due, pay later, rejected) is cleared: they owe nothing.
--   * OUT -> IN (only possible before the lock): an unsettled refund is
--     cancelled and the payment goes back to what it was.
--   * Admins can remove a player (same rules, no kickoff limit).
--   * Both paths return who moved from the waiting list into the squad, so
--     the client can send the PLAYER_DROPPED push.

-- 1. Remember what a payment was before it was flagged for refund ------------
ALTER TABLE public.game_payments
  ADD COLUMN IF NOT EXISTS refund_from_status TEXT
  CHECK (refund_from_status IS NULL OR refund_from_status IN ('VERIFIED', 'AWAITING_VERIFICATION'));

-- 2. Current squad (same ordering as buildPlayerRoster / admin_confirm_roster)
CREATE OR REPLACE FUNCTION public.game_squad_user_ids(p_game_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ins AS (
    SELECT r.user_id,
           r.joined_at,
           CASE p.status WHEN 'VERIFIED' THEN 0 WHEN 'AWAITING_VERIFICATION' THEN 1 ELSE 2 END AS prio
    FROM public.game_registrations r
    LEFT JOIN public.game_payments p ON p.game_id = r.game_id AND p.user_id = r.user_id
    WHERE r.game_id = p_game_id AND r.response = 'IN'
  ),
  cap AS (
    SELECT CASE
             WHEN (SELECT COUNT(*) FROM ins) >= 15
               OR COALESCE((SELECT squad_capacity FROM public.games WHERE id = p_game_id), 10) >= 15
             THEN 15 ELSE 10
           END AS n
  )
  SELECT COALESCE(array_agg(s.user_id ORDER BY s.prio, s.joined_at), '{}'::UUID[])
  FROM (
    SELECT user_id, prio, joined_at FROM ins
    ORDER BY prio, joined_at
    LIMIT (SELECT n FROM cap)
  ) s;
$$;

REVOKE ALL ON FUNCTION public.game_squad_user_ids(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_squad_user_ids(UUID) TO service_role;

-- 3. Kickoff time of a game (NULL if start_time can't be parsed) ------------
CREATE OR REPLACE FUNCTION public.game_kickoff_at(p_game public.games)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz TEXT;
BEGIN
  SELECT timezone INTO v_tz FROM public.game_schedule LIMIT 1;
  RETURN (p_game.game_date + p_game.start_time::time) AT TIME ZONE COALESCE(v_tz, 'Asia/Kolkata');
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.game_kickoff_at(public.games) FROM PUBLIC, anon, authenticated;

-- 4. Payment side effects of IN <-> OUT, whatever path changed it -----------
CREATE OR REPLACE FUNCTION public.handle_registration_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.game_payments%ROWTYPE;
BEGIN
  IF OLD.response = 'IN' AND NEW.response = 'OUT' THEN
    SELECT * INTO v_payment FROM public.game_payments
    WHERE game_id = NEW.game_id AND user_id = NEW.user_id;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    IF v_payment.status IN ('VERIFIED', 'AWAITING_VERIFICATION') THEN
      UPDATE public.game_payments
      SET status = 'REFUND_PENDING',
          refund_from_status = v_payment.status,
          updated_at = NOW()
      WHERE id = v_payment.id;

      INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
      VALUES (v_payment.id, NEW.game_id, 'DROPOUT_REFUND_PENDING', auth.uid(),
              jsonb_build_object('user_id', NEW.user_id, 'previous_status', v_payment.status,
                                 'method', v_payment.method, 'amount', v_payment.amount));

    ELSIF v_payment.status IN ('PENDING', 'UNREPORTED', 'REJECTED') THEN
      DELETE FROM public.game_payments WHERE id = v_payment.id;

      -- payment_id is NULL because the row is gone; the game keeps the record
      INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
      VALUES (NULL, NEW.game_id, 'DROPOUT_CLEARED', auth.uid(),
              jsonb_build_object('user_id', NEW.user_id, 'previous_status', v_payment.status,
                                 'method', v_payment.method, 'amount', v_payment.amount));
    END IF;

  ELSIF OLD.response = 'OUT' AND NEW.response = 'IN' THEN
    UPDATE public.game_payments
    SET status = COALESCE(refund_from_status, 'AWAITING_VERIFICATION'),
        refund_from_status = NULL,
        updated_at = NOW()
    WHERE game_id = NEW.game_id AND user_id = NEW.user_id AND status = 'REFUND_PENDING'
    RETURNING * INTO v_payment;

    IF FOUND THEN
      INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
      VALUES (v_payment.id, NEW.game_id, 'REJOIN_REFUND_CANCELLED', auth.uid(),
              jsonb_build_object('user_id', NEW.user_id, 'restored_status', v_payment.status));
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_registration_payment_change ON public.game_registrations;
CREATE TRIGGER trg_registration_payment_change
  AFTER UPDATE OF response ON public.game_registrations
  FOR EACH ROW
  WHEN (OLD.response IS DISTINCT FROM NEW.response)
  EXECUTE FUNCTION public.handle_registration_payment_change();

-- 5. register_for_game: OUT allowed after the lock (until kickoff) ----------
CREATE OR REPLACE FUNCTION public.register_for_game(
  p_game_id UUID,
  p_response TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_game public.games%ROWTYPE;
  v_active_count INTEGER;
  v_new_status TEXT;
  v_new_mode TEXT;
  v_new_duration INTEGER;
  v_new_turf_cost NUMERIC;
  v_kickoff TIMESTAMPTZ;
  v_squad_before UUID[];
  v_squad_after UUID[];
  v_was_in BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register for games';
  END IF;

  IF p_response NOT IN ('IN', 'OUT') THEN
    RAISE EXCEPTION 'Invalid response. Must be IN or OUT.';
  END IF;

  -- Lock game row for concurrency protection
  SELECT * INTO v_game
  FROM public.games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF v_game.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Registration is closed for this game.';
  END IF;

  IF p_response = 'IN' AND v_game.status IN ('REGISTRATION_CLOSED', 'ROSTER_CONFIRMED') THEN
    RAISE EXCEPTION 'The roster is locked. Ask the admin to add you.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.game_registrations
    WHERE game_id = p_game_id AND user_id = v_user_id AND response = 'IN'
  ) INTO v_was_in;

  IF p_response = 'OUT' AND v_was_in THEN
    v_kickoff := public.game_kickoff_at(v_game);
    IF v_kickoff IS NOT NULL AND NOW() >= v_kickoff THEN
      RAISE EXCEPTION 'The game has already started. Message the admin if you can''t play.';
    END IF;
  END IF;

  v_squad_before := public.game_squad_user_ids(p_game_id);

  -- Upsert registration
  INSERT INTO public.game_registrations (game_id, user_id, response, joined_at, updated_at)
  VALUES (p_game_id, v_user_id, p_response, NOW(), NOW())
  ON CONFLICT (game_id, user_id) DO UPDATE
  SET response = EXCLUDED.response,
      joined_at = CASE
        -- If switching back to IN, reset join timestamp to current time (appends to end of queue)
        WHEN game_registrations.response <> 'IN' AND EXCLUDED.response = 'IN' THEN NOW()
        ELSE game_registrations.joined_at
      END,
      updated_at = NOW();

  v_squad_after := public.game_squad_user_ids(p_game_id);

  -- Recalculate active IN players
  SELECT COUNT(*) INTO v_active_count
  FROM public.game_registrations
  WHERE game_id = p_game_id AND response = 'IN';

  -- Evaluate 10-player threshold and 15-player auto-promotion
  v_new_status := v_game.status;
  v_new_mode := v_game.mode;
  v_new_duration := v_game.duration_minutes;
  v_new_turf_cost := v_game.total_turf_cost;

  -- 10-player threshold: unlocks payments permanently once reached
  IF v_active_count >= 10 AND v_game.payment_opened_at IS NULL THEN
    v_game.payment_opened_at := NOW();
    IF v_new_status = 'REGISTRATION_OPEN' THEN
      v_new_status := 'PAYMENT_OPEN';
    END IF;
  END IF;

  -- 15-player promotion: auto-switches to 3 Teams Winner Stays (1.5 hrs @ 1200)
  IF v_active_count >= 15 THEN
    v_new_mode := 'WINNER_STAYS';
    v_new_duration := 90;
    v_new_turf_cost := 1200.00;
  END IF;

  -- Update game record if changed
  UPDATE public.games
  SET status = v_new_status,
      mode = v_new_mode,
      duration_minutes = v_new_duration,
      total_turf_cost = v_new_turf_cost,
      payment_opened_at = v_game.payment_opened_at,
      updated_at = NOW()
  WHERE id = p_game_id;

  RETURN jsonb_build_object(
    'success', true,
    'response', p_response,
    'active_count', v_active_count,
    'game_status', v_new_status,
    'payment_opened', (v_game.payment_opened_at IS NOT NULL),
    'mode', v_new_mode,
    'dropped_out', (p_response = 'OUT' AND v_was_in),
    'promoted_user_ids', to_jsonb(ARRAY(
      SELECT u FROM unnest(v_squad_after) u
      WHERE u <> ALL (v_squad_before) AND u <> v_user_id
    ))
  );
END;
$$;

-- 6. Admin: remove a player from the game ----------------------------------
CREATE OR REPLACE FUNCTION public.admin_remove_player(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_squad_before UUID[];
  v_squad_after UUID[];
  v_active_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can remove players.';
  END IF;

  SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF v_game.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'This game is already finished.';
  END IF;

  v_squad_before := public.game_squad_user_ids(p_game_id);

  UPDATE public.game_registrations
  SET response = 'OUT',
      updated_at = NOW()
  WHERE game_id = p_game_id AND user_id = p_user_id AND response = 'IN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That player is not IN for this game.';
  END IF;

  v_squad_after := public.game_squad_user_ids(p_game_id);

  SELECT COUNT(*) INTO v_active_count
  FROM public.game_registrations
  WHERE game_id = p_game_id AND response = 'IN';

  UPDATE public.games SET updated_at = NOW() WHERE id = p_game_id;

  INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
  VALUES (NULL, p_game_id, 'ADMIN_REMOVE_PLAYER', auth.uid(), jsonb_build_object('user_id', p_user_id));

  RETURN jsonb_build_object(
    'success', true,
    'active_count', v_active_count,
    'promoted_user_ids', to_jsonb(ARRAY(
      SELECT u FROM unnest(v_squad_after) u
      WHERE u <> ALL (v_squad_before) AND u <> p_user_id
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_player(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_player(UUID, UUID) TO authenticated;
