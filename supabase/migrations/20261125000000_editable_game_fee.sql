-- Migration: Fee per player and turf cost can change at any time
-- Timestamp: 2026-11-25 00:00:00
--
-- Rules:
--   * game_payments.amount is what the player actually paid (or owes).
--   * When games.amount_per_player changes, unpaid rows (cash due, pay later,
--     rejected, unreported) follow the new fee.
--   * Paid rows (VERIFIED / AWAITING_VERIFICATION) keep the amount paid.
--     The difference (amount - fee) is a refund owed (> 0) or a top-up owed
--     (< 0). The admin returns or collects it and taps Settle, which sets
--     amount to the current fee.
--   * A paid player who withdraws is refunded `amount` (unchanged rule), so a
--     full refund already accounts for any settled difference.

-- 1. Unpaid rows follow the fee ----------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_game_fee_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.game_payments
  SET amount = NEW.amount_per_player,
      updated_at = NOW()
  WHERE game_id = NEW.id
    AND status IN ('PENDING', 'UNREPORTED', 'REJECTED');

  INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
  VALUES (NULL, NEW.id, 'FEE_CHANGED', auth.uid(),
          jsonb_build_object('old_fee', OLD.amount_per_player, 'new_fee', NEW.amount_per_player));

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_game_fee_change ON public.games;
CREATE TRIGGER trg_game_fee_change
  AFTER UPDATE OF amount_per_player ON public.games
  FOR EACH ROW
  WHEN (OLD.amount_per_player IS DISTINCT FROM NEW.amount_per_player)
  EXECUTE FUNCTION public.handle_game_fee_change();

-- 2. Admin settles a paid player's fee difference ----------------------------
CREATE OR REPLACE FUNCTION public.admin_settle_fee_difference(
  p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.game_payments%ROWTYPE;
  v_fee NUMERIC(10, 2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can settle fee differences.';
  END IF;

  SELECT * INTO v_payment FROM public.game_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  IF v_payment.status NOT IN ('VERIFIED', 'AWAITING_VERIFICATION') THEN
    RAISE EXCEPTION 'Only paid players have a fee difference to settle.';
  END IF;

  SELECT amount_per_player INTO v_fee FROM public.games WHERE id = v_payment.game_id;

  IF v_payment.amount = v_fee THEN
    RAISE EXCEPTION 'Nothing to settle: this player paid the current fee.';
  END IF;

  UPDATE public.game_payments
  SET amount = v_fee,
      updated_at = NOW()
  WHERE id = p_payment_id;

  INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
  VALUES (p_payment_id, v_payment.game_id, 'SETTLE_FEE_DIFFERENCE', auth.uid(),
          jsonb_build_object('user_id', v_payment.user_id, 'paid', v_payment.amount, 'fee', v_fee,
                             'difference', v_payment.amount - v_fee));

  RETURN jsonb_build_object('success', true, 'amount', v_fee, 'difference', v_payment.amount - v_fee);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_settle_fee_difference(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_settle_fee_difference(UUID) TO authenticated;
