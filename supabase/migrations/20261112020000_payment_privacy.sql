-- Migration: Payment privacy
-- Timestamp: 2026-11-12 02:00:00
--
-- Before: every logged-in user could read every game_payments row (UTRs,
-- recipient, rejection reasons) and the whole payment_audit_logs table.
-- After:
--   * game_payments rows: only the payer and admins.
--   * Everyone still sees WHO has paid via get_game_payment_statuses()
--     (user_id, status, method, amount only — no UTR / recipient / reasons).
--   * payment_audit_logs: admins, plus entries the user performed themselves.
--   * Any payment change touches games.updated_at so non-admin clients (who no
--     longer receive other players' game_payments realtime events) still get a
--     `games` realtime event and refresh the roster.

-- 1. game_payments: own rows + admins ---------------------------------------
DROP POLICY IF EXISTS "Game payments viewable by authenticated users" ON public.game_payments;
CREATE POLICY "Game payments viewable by payer or admins"
  ON public.game_payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- 2. Public, non-sensitive payment status per player -------------------------
CREATE OR REPLACE FUNCTION public.get_game_payment_statuses(p_game_id UUID)
RETURNS TABLE (user_id UUID, status TEXT, method TEXT, amount NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.status, p.method, p.amount
  FROM public.game_payments p
  WHERE p.game_id = p_game_id
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_game_payment_statuses(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_payment_statuses(UUID) TO authenticated;

-- 3. payment_audit_logs: admins + own actions --------------------------------
DROP POLICY IF EXISTS "Payment audit logs viewable by authenticated users" ON public.payment_audit_logs;
CREATE POLICY "Payment audit logs viewable by admins or performer"
  ON public.payment_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin() OR performed_by = auth.uid());

-- 4. Realtime nudge: bump the game row whenever a payment changes -------------
CREATE OR REPLACE FUNCTION public.touch_game_on_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.games
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.game_id, OLD.game_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_game_on_payment_change ON public.game_payments;
CREATE TRIGGER trg_touch_game_on_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON public.game_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_game_on_payment_change();
