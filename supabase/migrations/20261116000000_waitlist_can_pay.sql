-- Migration: Waitlisted players can pay to jump ahead of unpaid squad players
-- Timestamp: 2026-11-16 00:00:00
--
-- Once payment opens (10 IN), anyone who is IN may pay, not just the squad.
-- Squad order is already (VERIFIED, AWAITING_VERIFICATION, unpaid) then join
-- time, so a waitlisted UPI payer moves above unpaid squad players and the
-- lowest unpaid squad player drops to the waiting list.
--
-- Rules for a player who is NOT in the squad when they pay:
--   * Payment must be open (payment_opened_at set).
--   * Only UPI: cash and pay-later carry no squad priority, so they would
--     not move the player and would only create a due amount.
--   * At least one squad player must still be unpaid. If every squad spot is
--     paid, payment stays locked for the waiting list (no refund risk).
-- Returns bumped_user_ids (squad players moved to the waiting list) so the
-- client can send the PLAYER_BUMPED push.

CREATE OR REPLACE FUNCTION public.submit_game_payment(
  p_game_id UUID,
  p_method TEXT,
  p_recipient_profile_id UUID DEFAULT NULL,
  p_utr TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_game public.games%ROWTYPE;
  v_reg public.game_registrations%ROWTYPE;
  v_target_status TEXT;
  v_payment_id UUID;
  v_squad_before UUID[];
  v_squad_after UUID[];
  v_in_squad BOOLEAN;
  v_unpaid_in_squad INTEGER;
  v_bumped UUID[] := '{}'::UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit payment';
  END IF;

  IF p_method NOT IN ('UPI', 'CASH', 'LATER') THEN
    RAISE EXCEPTION 'Invalid payment method. Must be UPI, CASH, or LATER.';
  END IF;

  -- Lock the game row so concurrent waitlist payers are ordered
  SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Check player registration
  SELECT * INTO v_reg FROM public.game_registrations WHERE game_id = p_game_id AND user_id = v_user_id;
  IF NOT FOUND OR v_reg.response <> 'IN' THEN
    RAISE EXCEPTION 'You must be registered IN for this game to submit payment.';
  END IF;

  v_squad_before := public.game_squad_user_ids(p_game_id);
  v_in_squad := v_user_id = ANY (v_squad_before);

  IF NOT v_in_squad THEN
    IF v_game.payment_opened_at IS NULL THEN
      RAISE EXCEPTION 'Payment opens once 10 players are IN.';
    END IF;
    IF p_method <> 'UPI' THEN
      RAISE EXCEPTION 'Waiting list players can only pay by UPI to move into the squad.';
    END IF;

    SELECT COUNT(*) INTO v_unpaid_in_squad
    FROM unnest(v_squad_before) s(uid)
    LEFT JOIN public.game_payments p ON p.game_id = p_game_id AND p.user_id = s.uid
    WHERE COALESCE(p.status, '') NOT IN ('VERIFIED', 'AWAITING_VERIFICATION');

    IF v_unpaid_in_squad = 0 THEN
      RAISE EXCEPTION 'Every squad spot is already paid. Payment unlocks if a spot opens.';
    END IF;
  END IF;

  -- Determine initial status based on method
  IF p_method = 'UPI' THEN
    v_target_status := 'AWAITING_VERIFICATION';
  ELSE -- CASH or LATER: nothing paid yet, so it stays due
    v_target_status := 'PENDING';
  END IF;

  -- Upsert payment claim
  INSERT INTO public.game_payments (
    game_id, user_id, amount, method, recipient_profile_id, utr, status, updated_at
  ) VALUES (
    p_game_id, v_user_id, v_game.amount_per_player, p_method, p_recipient_profile_id, NULLIF(TRIM(p_utr), ''), v_target_status, NOW()
  )
  ON CONFLICT (game_id, user_id) DO UPDATE
  SET amount = EXCLUDED.amount,
      method = EXCLUDED.method,
      recipient_profile_id = EXCLUDED.recipient_profile_id,
      utr = EXCLUDED.utr,
      status = EXCLUDED.status,
      rejection_reason = NULL,
      updated_at = NOW()
  RETURNING id INTO v_payment_id;

  -- Who dropped out of the squad because of this payment
  v_squad_after := public.game_squad_user_ids(p_game_id);
  SELECT COALESCE(array_agg(u), '{}'::UUID[]) INTO v_bumped
  FROM unnest(v_squad_before) u
  WHERE u <> ALL (v_squad_after) AND u <> v_user_id;

  -- Log to audit
  INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
  VALUES (
    v_payment_id,
    p_game_id,
    'SUBMIT_CLAIM',
    v_user_id,
    jsonb_build_object(
      'method', p_method,
      'utr', p_utr,
      'status', v_target_status,
      'from_waitlist', NOT v_in_squad,
      'bumped_user_ids', to_jsonb(v_bumped)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'status', v_target_status,
    'joined_squad', (NOT v_in_squad) AND v_user_id = ANY (v_squad_after),
    'bumped_user_ids', to_jsonb(v_bumped)
  );
END;
$$;
