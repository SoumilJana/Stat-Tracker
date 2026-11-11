-- Migration: Game Management & UPI Payment Tracking Module
-- Timestamp: 2026-11-11 14:50:00

-- ============================================================================
-- 1. TABLES CREATION
-- ============================================================================

-- A. Games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Turf',
  amount_per_player NUMERIC(10, 2) NOT NULL DEFAULT 80.00,
  total_turf_cost NUMERIC(10, 2) NOT NULL DEFAULT 800.00,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  mode TEXT NOT NULL DEFAULT 'STANDARD' CHECK (mode IN ('STANDARD', 'WINNER_STAYS', 'SPECIAL_7V7')),
  min_players INTEGER NOT NULL DEFAULT 10,
  max_players INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'REGISTRATION_OPEN' CHECK (
    status IN ('DRAFT', 'REGISTRATION_OPEN', 'PAYMENT_OPEN', 'REGISTRATION_CLOSED', 'ROSTER_CONFIRMED', 'COMPLETED', 'CANCELLED')
  ),
  payment_opened_at TIMESTAMPTZ,
  registration_closed_at TIMESTAMPTZ,
  roster_confirmed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B. Payment Profiles (Configured UPI Accounts)
CREATE TABLE IF NOT EXISTS public.payment_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  upi_id TEXT NOT NULL,
  qr_image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- C. Game Registrations (IN / OUT with exact join timestamps)
CREATE TABLE IF NOT EXISTS public.game_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('IN', 'OUT')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_game_registration UNIQUE (game_id, user_id)
);

-- D. Game Payments (Tracks payment attempts, claims, and verification)
CREATE TABLE IF NOT EXISTS public.game_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 80.00,
  method TEXT NOT NULL DEFAULT 'UPI' CHECK (method IN ('UPI', 'CASH', 'LATER')),
  recipient_profile_id UUID REFERENCES public.payment_profiles(id) ON DELETE SET NULL,
  utr TEXT,
  status TEXT NOT NULL DEFAULT 'UNREPORTED' CHECK (
    status IN ('UNREPORTED', 'AWAITING_VERIFICATION', 'PENDING', 'REJECTED', 'VERIFIED', 'REFUND_PENDING', 'REFUNDED')
  ),
  rejection_reason TEXT,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_game_payment UNIQUE (game_id, user_id),
  CONSTRAINT chk_no_self_verification CHECK (verified_by IS NULL OR verified_by <> user_id)
);

-- E. Payment Audit Logs
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.game_payments(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_game_date ON public.games(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_game_registrations_game_id ON public.game_registrations(game_id);
CREATE INDEX IF NOT EXISTS idx_game_registrations_user_id ON public.game_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_game_registrations_joined_at ON public.game_registrations(game_id, response, joined_at ASC);
CREATE INDEX IF NOT EXISTS idx_game_payments_game_id ON public.game_payments(game_id);
CREATE INDEX IF NOT EXISTS idx_game_payments_user_id ON public.game_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_game_payments_status ON public.game_payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_payment_id ON public.payment_audit_logs(payment_id);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Games policies
CREATE POLICY "Games viewable by authenticated users"
  ON public.games FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Games manageable by admins"
  ON public.games FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Payment Profiles policies
CREATE POLICY "Payment profiles viewable by authenticated users"
  ON public.payment_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Payment profiles manageable by admins"
  ON public.payment_profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Game Registrations policies
CREATE POLICY "Game registrations viewable by authenticated users"
  ON public.game_registrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own game registration"
  ON public.game_registrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own game registration"
  ON public.game_registrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage any game registration"
  ON public.game_registrations FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Game Payments policies
CREATE POLICY "Game payments viewable by authenticated users"
  ON public.game_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own payment claim"
  ON public.game_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    status IN ('UNREPORTED', 'AWAITING_VERIFICATION', 'PENDING') AND
    verified_by IS NULL AND
    verified_at IS NULL
  );

CREATE POLICY "Users can update own payment claim"
  ON public.game_payments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid() AND
    status IN ('UNREPORTED', 'AWAITING_VERIFICATION', 'PENDING') AND
    verified_by IS NULL AND
    verified_at IS NULL
  );

CREATE POLICY "Admins can manage any payment"
  ON public.game_payments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Payment Audit Logs policies
CREATE POLICY "Payment audit logs viewable by authenticated users"
  ON public.payment_audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Payment audit logs insertable by authenticated users"
  ON public.payment_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 4. CONCURRENCY-SAFE STORED PROCEDURES (RPCs)
-- ============================================================================

-- Function: register_for_game
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

  IF v_game.status IN ('REGISTRATION_CLOSED', 'ROSTER_CONFIRMED', 'COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Registration is closed for this game.';
  END IF;

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
    'mode', v_new_mode
  );
END;
$$;

-- Function: submit_game_payment
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
  ELSIF p_method = 'CASH' THEN
    v_target_status := 'AWAITING_VERIFICATION';
  ELSE -- LATER
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

-- Function: admin_verify_payment
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
    v_new_status := 'AWAITING_VERIFICATION';
    UPDATE public.game_payments
    SET status = 'AWAITING_VERIFICATION',
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

-- Function: admin_quick_verify_player (1-Click checkmark from IN list)
CREATE OR REPLACE FUNCTION public.admin_quick_verify_player(
  p_game_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_game public.games%ROWTYPE;
  v_payment_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can perform quick verification.';
  END IF;

  SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Upsert verified payment record
  INSERT INTO public.game_payments (
    game_id, user_id, amount, method, status, verified_by, verified_at, updated_at
  ) VALUES (
    p_game_id, p_target_user_id, v_game.amount_per_player, 'CASH', 'VERIFIED', v_admin_id, NOW(), NOW()
  )
  ON CONFLICT (game_id, user_id) DO UPDATE
  SET status = 'VERIFIED',
      verified_by = v_admin_id,
      verified_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
  RETURNING id INTO v_payment_id;

  -- Log audit
  INSERT INTO public.payment_audit_logs (payment_id, game_id, action, performed_by, details)
  VALUES (
    v_payment_id,
    p_game_id,
    'QUICK_VERIFY_CHECKMARK',
    v_admin_id,
    jsonb_build_object('target_user_id', p_target_user_id, 'amount', v_game.amount_per_player)
  );

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'status', 'VERIFIED');
END;
$$;

-- Function: admin_confirm_roster
CREATE OR REPLACE FUNCTION public.admin_confirm_roster(
  p_game_id UUID
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

  -- Determine active squad count (15 if 15 joined, else 10)
  SELECT COUNT(*) INTO v_active_count
  FROM public.game_registrations
  WHERE game_id = p_game_id AND response = 'IN';

  IF v_active_count < 10 THEN
    RAISE EXCEPTION 'Cannot confirm roster with fewer than 10 players.';
  END IF;

  IF v_active_count >= 15 THEN
    v_required_count := 15;
  ELSE
    v_required_count := 10;
  END IF;

  -- Count verified active players
  SELECT COUNT(*) INTO v_verified_count
  FROM (
    SELECT r.user_id
    FROM public.game_registrations r
    JOIN public.game_payments p ON p.game_id = r.game_id AND p.user_id = r.user_id
    WHERE r.game_id = p_game_id 
      AND r.response = 'IN' 
      AND p.status = 'VERIFIED'
    ORDER BY r.joined_at ASC
    LIMIT v_required_count
  ) active_verified;

  IF v_verified_count < v_required_count THEN
    RAISE EXCEPTION 'Cannot confirm roster: only % of % required active players are verified.', v_verified_count, v_required_count;
  END IF;

  -- Lock game roster
  UPDATE public.games
  SET status = 'ROSTER_CONFIRMED',
      registration_closed_at = COALESCE(registration_closed_at, NOW()),
      roster_confirmed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_game_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'ROSTER_CONFIRMED',
    'verified_players', v_verified_count,
    'mode', v_game.mode
  );
END;
$$;

-- Function: admin_settle_refund
CREATE OR REPLACE FUNCTION public.admin_settle_refund(
  p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can mark refunds as settled.';
  END IF;

  UPDATE public.game_payments
  SET status = 'REFUNDED',
      updated_at = NOW()
  WHERE id = p_payment_id AND status = 'REFUND_PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found or not in REFUND_PENDING status.';
  END IF;

  INSERT INTO public.payment_audit_logs (payment_id, action, performed_by, details)
  VALUES (p_payment_id, 'SETTLE_REFUND', v_admin_id, jsonb_build_object('settled_at', NOW()));

  RETURN jsonb_build_object('success', true, 'status', 'REFUNDED');
END;
$$;

-- ============================================================================
-- 5. INITIAL DATA SEED (Soumil Jana - super.money UPI)
-- ============================================================================
INSERT INTO public.payment_profiles (
  display_name,
  upi_id,
  qr_image_url,
  active,
  sort_order
)
VALUES (
  'Soumil Jana',
  '9432938110@superyes',
  '/qr/soumil-qr.png',
  true,
  1
)
ON CONFLICT DO NOTHING;
