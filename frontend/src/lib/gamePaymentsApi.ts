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
 * Merge registrations and payments into an ordered player roster view
 */
export function buildPlayerRoster(
  registrations: GameRegistration[],
  payments: GamePayment[]
): {
  activeSquad: PlayerRosterItem[];
  waitingList: PlayerRosterItem[];
  outList: PlayerRosterItem[];
} {
  const paymentsByUserId = new Map<string, GamePayment>();
  payments.forEach((p) => paymentsByUserId.set(p.user_id, p));

  const inRegistrations = registrations
    .filter((r) => r.response === 'IN')
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

  const outRegistrations = registrations
    .filter((r) => r.response === 'OUT')
    .sort((a, b) => new Date(b.updated_at || b.joined_at).getTime() - new Date(a.updated_at || a.joined_at).getTime());

  // Determine active threshold: 15 if 15 joined, otherwise top 10
  const activeCapacity = inRegistrations.length >= 15 ? 15 : 10;

  const activeSquad: PlayerRosterItem[] = inRegistrations.slice(0, activeCapacity).map((r, idx) => ({
    user_id: r.user_id,
    username: r.profile?.username || 'Unknown Player',
    photo_url: r.profile?.photo_url,
    jersey_number: r.profile?.jersey_number,
    position: r.profile?.position,
    response: 'IN',
    joined_at: r.joined_at,
    slot_number: idx + 1,
    is_waitlist: false,
    payment: paymentsByUserId.get(r.user_id) || null
  }));

  const waitingList: PlayerRosterItem[] = inRegistrations.slice(activeCapacity).map((r, idx) => ({
    user_id: r.user_id,
    username: r.profile?.username || 'Unknown Player',
    photo_url: r.profile?.photo_url,
    jersey_number: r.profile?.jersey_number,
    position: r.profile?.position,
    response: 'IN',
    joined_at: r.joined_at,
    slot_number: activeCapacity + idx + 1,
    is_waitlist: true,
    payment: paymentsByUserId.get(r.user_id) || null
  }));

  const outList: PlayerRosterItem[] = outRegistrations.map((r, idx) => ({
    user_id: r.user_id,
    username: r.profile?.username || 'Unknown Player',
    photo_url: r.profile?.photo_url,
    jersey_number: r.profile?.jersey_number,
    position: r.profile?.position,
    response: 'OUT',
    joined_at: r.joined_at,
    slot_number: idx + 1,
    is_waitlist: false,
    payment: paymentsByUserId.get(r.user_id) || null
  }));

  return { activeSquad, waitingList, outList };
}
