/**
 * StatTracker - Game Management & UPI Payments Domain Types
 * Module: frontend/src/types/gamePayment.ts
 *
 * Full TypeScript interfaces, enums, and utility helper types for:
 * - Game lifecycle & scheduling
 * - Player registrations (join order & waitlisting)
 * - UPI recipient payment profiles
 * - Payment states, audits, and verification
 */

export type GameStatus =
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'PAYMENT_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'ROSTER_CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED';

export type RegistrationResponse = 'IN' | 'OUT';

export type PaymentMethod = 'UPI' | 'CASH' | 'LATER';

export type PaymentStatus =
  | 'UNREPORTED'
  | 'AWAITING_VERIFICATION'
  | 'PENDING'
  | 'REJECTED'
  | 'VERIFIED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface Game {
  id: string;
  game_date: string;
  start_time: string;
  location: string;
  amount_per_player: number;
  total_turf_cost: number;
  duration_minutes: number;
  mode: 'STANDARD' | 'WINNER_STAYS' | 'SPECIAL_7V7';
  min_players: number;
  max_players: number;
  /** 15 once the game has ever reached 15 IN players, else 10 */
  squad_capacity?: number;
  status: GameStatus;
  payment_opened_at?: string | null;
  registration_closed_at?: string | null;
  roster_confirmed_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentProfile {
  id: string;
  owner_user_id?: string | null;
  display_name: string;
  upi_id: string;
  qr_image_url?: string | null;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface GameRegistration {
  id: string;
  game_id: string;
  user_id: string;
  response: RegistrationResponse;
  joined_at: string;
  created_at?: string;
  updated_at?: string;
  profile?: {
    id: string;
    username: string;
    photo_url?: string | null;
    jersey_number?: number | null;
    position?: string | null;
  } | null;
}

export interface GamePayment {
  id: string;
  game_id: string;
  user_id: string;
  amount: number;
  method: PaymentMethod;
  recipient_profile_id?: string | null;
  utr?: string | null;
  status: PaymentStatus;
  rejection_reason?: string | null;
  /** Status before a dropout flagged it REFUND_PENDING (restored if they rejoin) */
  refund_from_status?: 'VERIFIED' | 'AWAITING_VERIFICATION' | null;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
  recipient?: PaymentProfile | null;
  verifier?: {
    username: string;
  } | null;
}

export interface PaymentAuditLog {
  id: string;
  payment_id?: string | null;
  game_id?: string | null;
  action: string;
  performed_by?: string | null;
  details: Record<string, any>;
  created_at: string;
  performer?: {
    username: string;
  } | null;
}

/**
 * Composite view of a player's active game attendance + payment status
 */
export interface PlayerRosterItem {
  user_id: string;
  username: string;
  photo_url?: string | null;
  jersey_number?: number | null;
  position?: string | null;
  response: RegistrationResponse;
  joined_at: string;
  slot_number: number;
  is_waitlist: boolean;
  payment?: GamePayment | null;
}

/**
 * Single-row weekly schedule used to auto-create the usual game
 * (default: Saturday 07:00). weekday: 0=Sun … 6=Sat.
 */
export interface GameSchedule {
  active: boolean;
  weekday: number;
  start_time: string;
  location: string;
  amount_per_player: number;
  total_turf_cost: number;
  duration_minutes: number;
  open_days_before: number;
  timezone?: string;
  updated_at?: string;
}
