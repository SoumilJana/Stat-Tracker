/**
 * StatTracker - Session Domain Types
 * Module: frontend/src/types/session.ts
 *
 * Core TypeScript definitions for sessions and match modes.
 * Complies with erasableSyntaxOnly and verbatimModuleSyntax.
 */

export type SessionMode = 'STANDARD' | 'WINNER_STAYS' | 'SPECIAL_7V7';

export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Session {
  id: string;
  date: string;
  location?: string | null;
  notes?: string | null;
  mode: SessionMode;
  status: SessionStatus;
  created_at?: string;
}
