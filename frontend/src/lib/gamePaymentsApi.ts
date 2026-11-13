/**
 * StatTracker - Game Management & Payment API Client
 * Module: frontend/src/lib/gamePaymentsApi.ts
 *
 * Direct interface to Supabase for game lifecycle, registrations,
 * UPI payments, admin verifications, and realtime subscriptions.
 */

import { supabase } from './supabase';
import type {
  Game,
  GameRegistration,
  GamePayment,
  PaymentProfile,
  PlayerRosterItem,
  RegistrationResponse,
  PaymentMethod,
  GameSchedule
} from '../types/gamePayment';

/**
 * Fire-and-forget push notification. PAYMENT_VERIFIED / ROSTER_CONFIRMED are
 * admin-only; PLAYER_DROPPED is sent by the player who left or the admin who
 * removed them. Never blocks or fails the action that triggered it.
 */
export function sendGamePush(
  notificationType: 'PAYMENT_VERIFIED' | 'ROSTER_CONFIRMED' | 'PLAYER_DROPPED',
  body: { paymentId?: string; gameId?: string; droppedUserId?: string; promotedUserIds?: string[] }
): void {
  Promise.resolve()
    .then(() => supabase.functions.invoke('send-push-notification', { body: { notificationType, ...body } }))
    .catch((err) => console.error(`Failed to send ${notificationType} notification`, err));
}

/**
 * Fetch the latest active or upcoming game
 */
export async function fetchLatestGame(): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .not('status', 'eq', 'CANCELLED')
    .order('game_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest game:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Fetch a specific game by ID
 */
export async function fetchGameById(gameId: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error) {
    console.error(`Error fetching game ${gameId}:`, error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Fetch all registrations for a game with player profile details in join order
 */
export async function fetchGameRegistrations(gameId: string): Promise<GameRegistration[]> {
  const { data, error } = await supabase
    .from('game_registrations')
    .select(`
      id,
      game_id,
      user_id,
      response,
      joined_at,
      created_at,
      updated_at,
      profile:profiles (
        id,
        username,
        photo_url,
        jersey_number,
        position
      )
    `)
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('Error fetching registrations:', error);
    throw new Error(error.message);
  }

  return (data as any[]) || [];
}

/**
 * Fetch all payments recorded for a game.
 *
 * RLS only returns full rows (UTR, recipient, verifier) for the current user's
 * own payment, or every row for admins. Everyone else's payment is filled in
 * from get_game_payment_statuses(), which exposes status/method/amount only.
 */
export async function fetchGamePayments(gameId: string): Promise<GamePayment[]> {
  const [fullRes, statusRes] = await Promise.all([
    supabase
      .from('game_payments')
      .select(`
        *,
        recipient:payment_profiles (*),
        verifier:profiles!game_payments_verified_by_fkey (
          username
        )
      `)
      .eq('game_id', gameId),
    supabase.rpc('get_game_payment_statuses', { p_game_id: gameId })
  ]);

  if (fullRes.error) {
    console.error('Error fetching payments:', fullRes.error);
    throw new Error(fullRes.error.message);
  }
  if (statusRes.error) {
    console.error('Error fetching payment statuses:', statusRes.error);
    throw new Error(statusRes.error.message);
  }

  const full = (fullRes.data as GamePayment[]) || [];
  const seen = new Set(full.map((p) => p.user_id));
  const statusOnly: GamePayment[] = ((statusRes.data as Array<Pick<GamePayment, 'user_id' | 'status' | 'method' | 'amount'>>) || [])
    .filter((s) => !seen.has(s.user_id))
    .map((s) => ({
      id: `status-${s.user_id}`,
      game_id: gameId,
      user_id: s.user_id,
      status: s.status,
      method: s.method,
      amount: Number(s.amount)
    }));

  return [...full, ...statusOnly];
}

/**
 * Fetch configured UPI payment profiles
 */
export async function fetchPaymentProfiles(includeInactive = false): Promise<PaymentProfile[]> {
  let query = supabase
    .from('payment_profiles')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!includeInactive) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching payment profiles:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Join or leave a game with concurrency-safe RPC
 */
export async function registerForGame(
  gameId: string,
  response: RegistrationResponse,
  userId?: string
): Promise<{ success: boolean; active_count: number; game_status: string; dropped_out?: boolean; promoted_user_ids?: string[] }> {
  const { data, error } = await supabase.rpc('register_for_game', {
    p_game_id: gameId,
    p_response: response
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data?.dropped_out && userId) {
    sendGamePush('PLAYER_DROPPED', { gameId, droppedUserId: userId, promotedUserIds: data.promoted_user_ids || [] });
  }
  return data;
}

/**
 * Admin action: remove a player from the game. A paid player is flagged for a
 * refund, an unpaid one is cleared, and the waiting list moves up.
 */
export async function adminRemovePlayer(
  gameId: string,
  userId: string
): Promise<{ success: boolean; active_count: number; promoted_user_ids: string[] }> {
  const { data, error } = await supabase.rpc('admin_remove_player', {
    p_game_id: gameId,
    p_user_id: userId
  });

  if (error) {
    throw new Error(error.message);
  }

  sendGamePush('PLAYER_DROPPED', { gameId, droppedUserId: userId, promotedUserIds: data?.promoted_user_ids || [] });
  return data;
}

/**
 * Kickoff as a local Date (game_date + start_time), or null if unparseable.
 */
export function gameKickoff(game: Pick<Game, 'game_date' | 'start_time'>): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(game.start_time || '');
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(game.game_date || '');
  if (!m || !d) return null;
  return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(m[1]), Number(m[2]));
}

/**
 * Submit payment claim (UPI / CASH / LATER)
 */
export async function submitGamePayment(
  gameId: string,
  method: PaymentMethod,
  recipientProfileId?: string | null,
  utr?: string | null
): Promise<{ success: boolean; payment_id: string; status: string }> {
  const { data, error } = await supabase.rpc('submit_game_payment', {
    p_game_id: gameId,
    p_method: method,
    p_recipient_profile_id: recipientProfileId || null,
    p_utr: utr || null
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Admin action: Verify, Reject, or Revert a payment
 */
export async function adminVerifyPayment(
  paymentId: string,
  action: 'VERIFY' | 'REJECT' | 'REVERT',
  rejectionReason?: string
): Promise<{ success: boolean; status: string }> {
  const { data, error } = await supabase.rpc('admin_verify_payment', {
    p_payment_id: paymentId,
    p_action: action,
    p_rejection_reason: rejectionReason || null
  });

  if (error) {
    throw new Error(error.message);
  }

  if (action === 'VERIFY') sendGamePush('PAYMENT_VERIFIED', { paymentId });
  return data;
}

/**
 * Admin action: Quick 1-tap checkmark directly from the IN list
 */
export async function adminQuickVerifyPlayer(
  gameId: string,
  userId: string
): Promise<{ success: boolean; payment_id: string; status: string }> {
  const { data, error } = await supabase.rpc('admin_quick_verify_player', {
    p_game_id: gameId,
    p_target_user_id: userId
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data?.payment_id) sendGamePush('PAYMENT_VERIFIED', { paymentId: data.payment_id });
  return data;
}

export type PaymentStatusChoice = 'PAID_UPI' | 'PAID_CASH' | 'CASH_DUE' | 'PAY_LATER' | 'NOT_PAID';

/**
 * Admin action: set a squad player's payment status directly
 * (e.g. turn an old cash "Paid" back into Cash Due).
 */
export async function adminSetPaymentStatus(
  gameId: string,
  userId: string,
  choice: PaymentStatusChoice
): Promise<{ success: boolean; payment_id: string | null; status: string | null }> {
  const { data, error } = await supabase.rpc('admin_set_payment_status', {
    p_game_id: gameId,
    p_user_id: userId,
    p_choice: choice
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data?.status === 'VERIFIED' && data.payment_id) sendGamePush('PAYMENT_VERIFIED', { paymentId: data.payment_id });
  return data;
}

/**
 * Admin action: Confirm & lock final match roster for next day
 */
export async function adminConfirmRoster(
  gameId: string
): Promise<{ success: boolean; status: string; verified_players: number; mode: string }> {
  const { data, error } = await supabase.rpc('admin_confirm_roster', {
    p_game_id: gameId
  });

  if (error) {
    throw new Error(error.message);
  }

  sendGamePush('ROSTER_CONFIRMED', { gameId });
  return data;
}

/**
 * Admin action: Settle refund for paid dropout
 */
export async function adminSettleRefund(
  paymentId: string
): Promise<{ success: boolean; status: string }> {
  const { data, error } = await supabase.rpc('admin_settle_refund', {
    p_payment_id: paymentId
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Admin action: Create or update a game
 */
export async function createOrUpdateGame(
  gameData: Partial<Game>
): Promise<Game> {
  if (gameData.id) {
    const { data, error } = await supabase
      .from('games')
      .update({
        game_date: gameData.game_date,
        start_time: gameData.start_time,
        location: gameData.location,
        amount_per_player: gameData.amount_per_player,
        total_turf_cost: gameData.total_turf_cost,
        duration_minutes: gameData.duration_minutes,
        status: gameData.status,
        mode: gameData.mode,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameData.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await supabase
      .from('games')
      .insert({
        game_date: gameData.game_date,
        start_time: gameData.start_time,
        location: gameData.location || 'Turf',
        amount_per_player: gameData.amount_per_player ?? 80.00,
        total_turf_cost: gameData.total_turf_cost ?? 800.00,
        duration_minutes: gameData.duration_minutes ?? 60,
        mode: gameData.mode || 'STANDARD',
        status: 'REGISTRATION_OPEN'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

/**
 * Squad priority for a payment: verified payers first, then claims awaiting
 * verification, then everyone else. Mirrors admin_confirm_roster in SQL.
 */
export function paymentPriority(payment?: GamePayment | null): number {
  if (payment?.status === 'VERIFIED') return 0;
  if (payment?.status === 'AWAITING_VERIFICATION') return 1;
  return 2;
}

/**
 * Squad size: 15 once the game has ever reached 15 IN players (sticky via
 * games.squad_capacity), otherwise 10.
 */
export function resolveSquadCapacity(inCount: number, squadCapacity?: number | null): number {
  return inCount >= 15 || (squadCapacity ?? 10) >= 15 ? 15 : 10;
}

/**
 * Merge registrations and payments into an ordered player roster view.
 * Squad = top `capacity` IN players by (payment priority, join time);
 * anyone beyond that is on the waiting list.
 */
export function buildPlayerRoster(
  registrations: GameRegistration[],
  payments: GamePayment[],
  squadCapacity?: number | null
): {
  activeSquad: PlayerRosterItem[];
  waitingList: PlayerRosterItem[];
  outList: PlayerRosterItem[];
} {
  const paymentsByUserId = new Map<string, GamePayment>();
  payments.forEach((p) => paymentsByUserId.set(p.user_id, p));

  const toItem = (r: GameRegistration, slot: number, isWaitlist: boolean): PlayerRosterItem => ({
    user_id: r.user_id,
    username: r.profile?.username || 'Unknown Player',
    photo_url: r.profile?.photo_url,
    jersey_number: r.profile?.jersey_number,
    position: r.profile?.position,
    response: r.response,
    joined_at: r.joined_at,
    slot_number: slot,
    is_waitlist: isWaitlist,
    payment: paymentsByUserId.get(r.user_id) || null
  });

  const inRegistrations = registrations
    .filter((r) => r.response === 'IN')
    .sort(
      (a, b) =>
        paymentPriority(paymentsByUserId.get(a.user_id)) - paymentPriority(paymentsByUserId.get(b.user_id)) ||
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    );

  const outRegistrations = registrations
    .filter((r) => r.response === 'OUT')
    .sort((a, b) => new Date(b.updated_at || b.joined_at).getTime() - new Date(a.updated_at || a.joined_at).getTime());

  const activeCapacity = resolveSquadCapacity(inRegistrations.length, squadCapacity);

  const activeSquad = inRegistrations.slice(0, activeCapacity).map((r, idx) => toItem(r, idx + 1, false));
  const waitingList = inRegistrations
    .slice(activeCapacity)
    .map((r, idx) => toItem(r, activeCapacity + idx + 1, true));
  const outList = outRegistrations.map((r, idx) => toItem(r, idx + 1, false));

  return { activeSquad, waitingList, outList };
}

/**
 * Admin manually register/enlist a player into the game
 */
export async function adminRegisterPlayer(
  gameId: string,
  userId: string,
  markAsPaid = false,
  paymentMethod: PaymentMethod = 'CASH'
): Promise<{ success: boolean; active_count: number; game_status: string; paid: boolean }> {
  const { data, error } = await supabase.rpc('admin_register_player', {
    p_game_id: gameId,
    p_user_id: userId,
    p_mark_as_paid: markAsPaid,
    p_payment_method: paymentMethod
  });

  if (error) {
    console.error('Error admin registering player:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Admin manually register/enlist multiple players into the game in a batch
 */
export async function adminRegisterPlayers(
  gameId: string,
  userIds: string[],
  markAsPaid = false,
  paymentMethod: PaymentMethod = 'CASH'
): Promise<{ success: boolean; enlisted_count: number; active_count: number; game_status: string; paid: boolean }> {
  const { data, error } = await supabase.rpc('admin_register_players', {
    p_game_id: gameId,
    p_user_ids: userIds,
    p_mark_as_paid: markAsPaid,
    p_payment_method: paymentMethod
  });

  if (error) {
    console.error('Error admin batch registering players:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Fetch profiles available to be enlisted (exclude players already marked IN)
 */
export async function fetchAvailableProfilesForGame(
  alreadyInUserIds: string[]
): Promise<Array<{ id: string; username: string; photo_url?: string; jersey_number?: number }>> {
  let query = supabase
    .from('profiles')
    .select('id, username, photo_url, jersey_number')
    .order('username', { ascending: true });

  if (alreadyInUserIds.length > 0) {
    query = query.not('id', 'in', `(${alreadyInUserIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching available profiles:', error);
    throw new Error(error.message);
  }

  return data || [];
}


/**
 * Weekly schedule (single row) used by the daily auto-create job
 */
export async function fetchGameSchedule(): Promise<GameSchedule | null> {
  const { data, error } = await supabase.from('game_schedule').select('*').maybeSingle();
  if (error) {
    console.error('Error fetching game schedule:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function saveGameSchedule(schedule: GameSchedule): Promise<GameSchedule> {
  const { data, error } = await supabase
    .from('game_schedule')
    .update({
      active: schedule.active,
      weekday: schedule.weekday,
      start_time: schedule.start_time,
      location: schedule.location,
      amount_per_player: schedule.amount_per_player,
      total_turf_cost: schedule.total_turf_cost,
      duration_minutes: schedule.duration_minutes,
      open_days_before: schedule.open_days_before,
      updated_at: new Date().toISOString()
    })
    .eq('id', true)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Admin: run the schedule now. Returns the new game id, or null when nothing
 * was due (too early, schedule paused, or that week already has a game).
 */
export async function runGameScheduleNow(): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_run_game_schedule');
  if (error) throw new Error(error.message);
  return data ?? null;
}

/**
 * Next usual game date from a schedule (local dates, YYYY-MM-DD). Mirrors
 * next_scheduled_game_date() in SQL for display purposes.
 */
export function nextScheduledDate(schedule: Pick<GameSchedule, 'weekday' | 'start_time'>, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let add = (schedule.weekday - d.getDay() + 7) % 7;
  const [h, m] = schedule.start_time.split(':').map(Number);
  if (add === 0 && now.getHours() * 60 + now.getMinutes() >= h * 60 + m) add = 7;
  d.setDate(d.getDate() + add);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
