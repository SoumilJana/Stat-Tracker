-- Migration: Admin can set any squad player's payment status
-- Timestamp: 2026-11-13 02:00:00
--
-- Lets the admin correct a payment from the roster (e.g. cash that was
-- approved as Paid under the old flow but is really due on game day).
--   PAID_UPI   -> UPI,   VERIFIED
--   PAID_CASH  -> CASH,  VERIFIED (cash received)
--   CASH_DUE   -> CASH,  PENDING
--   PAY_LATER  -> LATER, PENDING
--   NOT_PAID   -> payment row removed (shows as Due)

CREATE OR REPLACE FUNCTION public.admin_set_payment_status(
  p_game_id UUID,
  p_user_id UUID,
  p_choice TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_game public.games%ROWTYPE;
  v_old public.game_payments%ROWTYPE;
  v_had_payment BOOLEAN;
  v_method TEXT;
  v_status TEXT;
  v_payment_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can change payment status.';
  END IF;

  IF p_choice NOT IN ('PAID_UPI', 'PAID_CASH', 'CASH_DUE', 'PAY_LATER', 'NOT_PAID') THEN
    RAISE EXCEPTION 'Invalid payment status choice.';
  END IF;

  SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.game_registrations
    WHERE game_id = p_game_id AND user_id = p_user_id AND response = 'IN'
  ) THEN
    RAISE EXCEPTION 'That player is not IN for this game.';
  END IF;

  SELECT * INTO v_old FROM public.game_payments WHERE game_id = p_game_id AND user_id = p_user_id;
  v_had_payment := FOUND;

  IF p_choice = 'NOT_PAID' THEN
    IF v_had_payment THEN
      DELETE FROM public.game_payments WHERE id = v_old.id;
    END IF;

    INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
    VALUES (NULL, p_game_id, 'ADMIN_SET_STATUS', v_admin_id,
            jsonb_build_object('user_id', p_user_id, 'choice', p_choice,
                               'previous_status', v_old.status, 'previous_method', v_old.method));

    RETURN jsonb_build_object('success', true, 'payment_id', NULL, 'status', NULL);
  END IF;

  v_method := CASE p_choice WHEN 'PAID_UPI' THEN 'UPI' WHEN 'PAY_LATER' THEN 'LATER' ELSE 'CASH' END;
  v_status := CASE WHEN p_choice IN ('PAID_UPI', 'PAID_CASH') THEN 'VERIFIED' ELSE 'PENDING' END;

  INSERT INTO public.game_payments (
    game_id, user_id, amount, method, status, verified_by, verified_at, updated_at
  ) VALUES (
    p_game_id, p_user_id, v_game.amount_per_player, v_method, v_status,
    CASE WHEN v_status = 'VERIFIED' THEN v_admin_id END,
    CASE WHEN v_status = 'VERIFIED' THEN NOW() END,
    NOW()
  )
  ON CONFLICT (game_id, user_id) DO UPDATE
  SET method = EXCLUDED.method,
      status = EXCLUDED.status,
      verified_by = EXCLUDED.verified_by,
      verified_at = EXCLUDED.verified_at,
      rejection_reason = NULL,
      refund_from_status = NULL,
      updated_at = NOW()
  RETURNING id INTO v_payment_id;

  INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
  VALUES (v_payment_id, p_game_id, 'ADMIN_SET_STATUS', v_admin_id,
          jsonb_build_object('user_id', p_user_id, 'choice', p_choice,
                             'previous_status', v_old.status, 'previous_method', v_old.method,
                             'new_status', v_status, 'new_method', v_method));

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_payment_status(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_status(UUID, UUID, TEXT) TO authenticated;
