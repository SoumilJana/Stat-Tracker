-- Migration: Lock down payment_audit_logs inserts
-- Timestamp: 2026-11-12 00:00:00
--
-- The v5.0 policy allowed any authenticated user to INSERT arbitrary rows
-- (WITH CHECK (true)), so the audit trail could be forged from the client.
-- Every legitimate audit entry is written by a SECURITY DEFINER RPC
-- (submit_game_payment, admin_verify_payment, admin_quick_verify_player,
-- admin_settle_refund, admin_register_player(s)), which bypass RLS as the
-- function owner. No client code writes to this table directly.
--
-- With RLS enabled and no INSERT/UPDATE/DELETE policy, clients can only read.

DROP POLICY IF EXISTS "Payment audit logs insertable by authenticated users"
  ON public.payment_audit_logs;

-- Defence in depth: remove table-level write grants from client roles too.
REVOKE INSERT, UPDATE, DELETE ON public.payment_audit_logs FROM anon, authenticated;
