-- Migration: Admin Manual Player Registration & Enlistment
-- Timestamp: 2026-11-11 16:00:00

CREATE OR REPLACE FUNCTION public.admin_register_player(
  p_game_id UUID,
  p_user_id UUID,
  p_mark_as_paid BOOLEAN DEFAULT false,
  p_payment_method TEXT DEFAULT 'CASH'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_game public.games%ROWTYPE;
  v_active_count INTEGER;
  v_new_status TEXT;
  v_new_mode TEXT;
  v_new_duration INTEGER;
  v_new_turf_cost NUMERIC;
  v_payment_id UUID;
BEGIN
  -- Verify admin privilege
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can manually enlist players to the match roster.';
  END IF;

  -- Lock game row
  SELECT * INTO v_game
  FROM public.games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found.';
  END IF;

  IF v_game.status IN ('REGISTRATION_CLOSED', 'ROSTER_CONFIRMED', 'COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Registration is closed for this game.';
  END IF;

  -- Upsert registration as IN
  INSERT INTO public.game_registrations (game_id, user_id, response, joined_at, updated_at)
  VALUES (p_game_id, p_user_id, 'IN', NOW(), NOW())
  ON CONFLICT (game_id, user_id) DO UPDATE
  SET response = 'IN',
      joined_at = CASE 
        WHEN game_registrations.response <> 'IN' THEN NOW()
        ELSE game_registrations.joined_at
      END,
      updated_at = NOW();

  -- Recalculate active IN players
  SELECT COUNT(*) INTO v_active_count
  FROM public.game_registrations
  WHERE game_id = p_game_id AND response = 'IN';

  -- Evaluate threshold and auto-promotion
  v_new_status := v_game.status;
  v_new_mode := v_game.mode;
  v_new_duration := v_game.duration_minutes;
  v_new_turf_cost := v_game.total_turf_cost;

  IF v_active_count >= 10 AND v_game.payment_opened_at IS NULL THEN
    v_game.payment_opened_at := NOW();
    IF v_new_status = 'REGISTRATION_OPEN' THEN
      v_new_status := 'PAYMENT_OPEN';
    END IF;
  END IF;

  IF v_active_count >= 15 THEN
    v_new_mode := 'WINNER_STAYS';
    v_new_duration := 90;
    v_new_turf_cost := 1200.00;
  END IF;

  UPDATE public.games
  SET status = v_new_status,
      mode = v_new_mode,
      duration_minutes = v_new_duration,
      total_turf_cost = v_new_turf_cost,
      payment_opened_at = v_game.payment_opened_at,
      updated_at = NOW()
  WHERE id = p_game_id;

  -- If admin chose to mark as paid immediately
  IF p_mark_as_paid THEN
    INSERT INTO public.game_payments (
      game_id,
      user_id,
      amount,
      method,
      status,
      verified_by,
      verified_at,
      created_at,
      updated_at
    )
    VALUES (
      p_game_id,
      p_user_id,
      v_game.amount_per_player,
      COALESCE(p_payment_method, 'CASH'),
      'VERIFIED',
      v_admin_id,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (game_id, user_id) DO UPDATE
    SET amount = EXCLUDED.amount,
        method = EXCLUDED.method,
        status = 'VERIFIED',
        verified_by = v_admin_id,
        verified_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_payment_id;

    -- Audit log
    INSERT INTO public.payment_audit_logs (
      game_id,
      payment_id,
      actor_id,
      action,
      previous_status,
      new_status,
      notes
    )
    VALUES (
      p_game_id,
      v_payment_id,
      v_admin_id,
      'ADMIN_MANUAL_ENLIST',
      'UNREPORTED',
      'VERIFIED',
      'Player enlisted manually by admin with verified payment'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'active_count', v_active_count,
    'game_status', v_new_status,
    'paid', p_mark_as_paid
  );
END;
$$;
