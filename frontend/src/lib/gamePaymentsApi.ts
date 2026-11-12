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
  PaymentMethod
} from '../types/gamePayment';

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
 * Fetch all payments recorded for a game
 */
export async function fetchGamePayments(gameId: string): Promise<GamePayment[]> {
  const { data, error } = await supabase
    .from('game_payments')
    .select(`
      *,
      recipient:payment_profiles (*),
      verifier:profiles!game_payments_verified_by_fkey (
        username
      )
    `)
    .eq('game_id', gameId);

  if (error) {
    console.error('Error fetching payments:', error);
    throw new Error(error.message);
  }

  return (data as any[]) || [];
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
  response: RegistrationResponse
): Promise<{ success: boolean; active_count: number; game_status: string }> {
  const { data, error } = await supabase.rpc('register_for_game', {
    p_game_id: gameId,
    p_response: response
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
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

