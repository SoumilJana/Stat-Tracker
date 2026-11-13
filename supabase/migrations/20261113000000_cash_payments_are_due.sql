-- Migration: Cash is due, not paid
-- Timestamp: 2026-11-13 00:00:00
--
-- Cash is handed over on game day, so a cash choice is a due amount, not a
-- payment claim. Cash now records as PENDING (shown as "Cash Due"), with no
-- squad priority over UPI claims. The admin confirms it after talking to the
-- player (admin_quick_verify_player / "Confirm Cash").

UPDATE public.game_payments
SET status = 'PENDING',
    updated_at = NOW()
WHERE method = 'CASH'
  AND status = 'AWAITING_VERIFICATION';

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit payment';
  END IF;

  IF p_method NOT IN ('UPI', 'CASH', 'LATER') THEN
    RAISE EXCEPTION 'Invalid payment method. Must be UPI, CASH, or LATER.';
  END IF;

  SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Check player registration
  SELECT * INTO v_reg FROM public.game_registrations WHERE game_id = p_game_id AND user_id = v_user_id;
  IF NOT FOUND OR v_reg.response <> 'IN' THEN
    RAISE EXCEPTION 'You must be registered IN for this game to submit payment.';
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

  -- Log to audit
  INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
  VALUES (
    v_payment_id,
    p_game_id,
    'SUBMIT_CLAIM',
    v_user_id,
    jsonb_build_object('method', p_method, 'utr', p_utr, 'status', v_target_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'status', v_target_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_payment(
  p_payment_id UUID,
  p_action TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment public.game_payments%ROWTYPE;
  v_new_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can verify or reject payments.';
  END IF;

  SELECT * INTO v_payment FROM public.game_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  -- Prevent self-verification
  IF v_payment.user_id = v_admin_id AND p_action = 'VERIFY' THEN
    RAISE EXCEPTION 'Admins cannot verify their own payment claims. Another admin must verify, or use cash checkmark.';
  END IF;

  IF p_action = 'VERIFY' THEN
    v_new_status := 'VERIFIED';
    UPDATE public.game_payments
    SET status = 'VERIFIED',
        verified_by = v_admin_id,
        verified_at = NOW(),
        rejection_reason = NULL,
        updated_at = NOW()
    WHERE id = p_payment_id;

  ELSIF p_action = 'REJECT' THEN
    v_new_status := 'REJECTED';
    UPDATE public.game_payments
    SET status = 'REJECTED',
        rejection_reason = COALESCE(NULLIF(TRIM(p_rejection_reason), ''), 'Payment not received in account'),
        verified_by = v_admin_id,
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payment_id;

  ELSIF p_action = 'REVERT' THEN
    -- UPI claims go back to review; cash/later go back to due
    v_new_status := CASE WHEN v_payment.method = 'UPI' THEN 'AWAITING_VERIFICATION' ELSE 'PENDING' END;
    UPDATE public.game_payments
    SET status = v_new_status,
        verified_by = NULL,
        verified_at = NULL,
        rejection_reason = NULL,
        updated_at = NOW()
    WHERE id = p_payment_id;

  ELSE
    RAISE EXCEPTION 'Invalid action. Must be VERIFY, REJECT, or REVERT.';
  END IF;

  -- Log audit
  INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
  VALUES (
    p_payment_id,
    v_payment.game_id,
    p_action,
    v_admin_id,
    jsonb_build_object('action', p_action, 'new_status', v_new_status, 'reason', p_rejection_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'status', v_new_status
  );
END;
$$;
