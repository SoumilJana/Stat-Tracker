/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Test Suite: frontend/src/pages/ActiveMatch/timer/__tests__/timerAdversarialM3.test.ts
 *
 * Adversarial Stress & Chaos Test Suite for Milestone 3:
 * 1. Stale Version Packet Injection (Lower versions, equal versions, out-of-order jitter storms)
 * 2. Unauthorized Non-Admin Broadcast Injection (Non-admin sender roles, client mutation hijacking)
 * 3. Malformed, Corrupted & Pathological Payloads (Cross-session leaks, NaN/infinite values, type mismatches)
 * 4. Rapid Successive Broadcasts & Multi-Client Concurrency Stress (Race conditions, spectator isolation)
 * 5. Extreme Clock Skew Boundaries (Multi-hour drift, paused clock stability, past expiration clamping)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  validateBroadcastPayload,
  setupTimerRealtimeSync,
} from '../timerSync';
import {
  createInitialTimerState,
  PLAYING_DURATION_MS,
  GOAL_BUFFER_DURATION_MS,
} from '../timerEngine';
import { loadTimerState } from '../timerStorage';
import { useWinnerStaysTimer } from '../useWinnerStaysTimer';
import type { TimerState, TimerBroadcastPayload } from '../types';

/**
 * Creates an in-memory mock Supabase Realtime message bus for multi-client testing.
 */
function createMockRealtimeBus() {
  type Listener = { event: string; callback: (envelope: any) => void };
  type MockChannelInternal = {
    id: string;
    topic: string;
    listeners: Listener[];
    state: string;
  };

  const topicMap = new Map<string, Map<string, MockChannelInternal>>();
  let idCounter = 0;

  return {
    channel(channelName: string) {
      if (!topicMap.has(channelName)) {
        topicMap.set(channelName, new Map());
      }
      const channelsForTopic = topicMap.get(channelName)!;

      const channelId = `mock-ch-${++idCounter}`;
      const internal: MockChannelInternal = {
        id: channelId,
        topic: channelName,
        listeners: [],
        state: 'closed',
      };
      channelsForTopic.set(channelId, internal);

      const mockChannel = {
        id: channelId,
        name: channelName,
        topic: channelName,
        get state() {
          return internal.state === 'SUBSCRIBED' ? 'joined' : 'closed';
        },
        on(_type: string, filter: { event: string }, callback: (envelope: any) => void) {
          internal.listeners.push({ event: filter.event, callback });
          return mockChannel;
        },
        subscribe(callback?: (status: string) => void) {
          internal.state = 'SUBSCRIBED';
          callback?.('SUBSCRIBED');
          return mockChannel;
        },
        async send(args: { type: string; event: string; payload: any }) {
          const currentChannels = topicMap.get(channelName);
          if (currentChannels) {
            for (const [targetId, targetChannel] of currentChannels.entries()) {
              if (targetId !== channelId) {
                const matchingListeners = targetChannel.listeners.filter(
                  (l) => l.event === args.event || l.event === '*'
                );
                for (const l of matchingListeners) {
                  l.callback({
                    type: 'broadcast',
                    event: args.event,
                    payload: args.payload,
                  });
                }
              }
            }
          }
          return 'ok' as const;
        },
      };

      return mockChannel;
    },
    removeChannel(channel: any) {
      if (channel && channel.name && channel.id) {
        const channelsForTopic = topicMap.get(channel.name);
        if (channelsForTopic) {
          channelsForTopic.delete(channel.id);
          if (channelsForTopic.size === 0) {
            topicMap.delete(channel.name);
          }
        }
      }
    },
    _getTopicMap() {
      return topicMap;
    },
  };
}

describe('Adversarial Challenge M3: Realtime Synchronization & Security Shielding', () => {
  const BASE_TIME = 1_700_000_000_000;
  const SESSION_ID = 'adversarial-session-m3';
  const adminProfile = { id: 'admin-superuser', role: 'admin' };
  const playerProfile = { id: 'player-malicious', role: 'player' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // Focus 1: Stale Version Packet Injection
  // ---------------------------------------------------------------------------
  describe('Focus 1: Stale Version Packet Injection', () => {
    it('rejects stale incoming versions lower than current local version', () => {
      const currentState: TimerState = {
        ...createInitialTimerState(BASE_TIME),
        version: 10,
      };

      const staleVersions = [1, 2, 5, 9];
      for (const ver of staleVersions) {
        const payload: TimerBroadcastPayload = {
          sessionId: SESSION_ID,
          senderRole: 'admin',
          senderId: 'admin-superuser',
          hostTimestamp: BASE_TIME,
          version: ver,
          state: {
            ...createInitialTimerState(BASE_TIME),
            version: ver,
          },
        };

        const result = validateBroadcastPayload(payload, currentState, BASE_TIME, SESSION_ID);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('STALE_VERSION');
        expect(result.adjustedState).toBeNull();
      }
    });

    it('rejects duplicate packet with equal version to prevent duplicate state shifts', () => {
      const currentState: TimerState = {
        ...createInitialTimerState(BASE_TIME),
        version: 7,
      };

      const duplicatePayload: TimerBroadcastPayload = {
        sessionId: SESSION_ID,
        senderRole: 'admin',
        senderId: 'admin-superuser',
        hostTimestamp: BASE_TIME,
        version: 7,
        state: {
          ...createInitialTimerState(BASE_TIME),
          version: 7,
        },
      };

      const result = validateBroadcastPayload(duplicatePayload, currentState, BASE_TIME, SESSION_ID);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STALE_VERSION');
      expect(result.adjustedState).toBeNull();
    });

    it('shields against out-of-order network jitter storms, strictly advancing monotonically', async () => {
      const mockBus = createMockRealtimeBus();
      const spectatorReceivedVersions: number[] = [];

      const spectatorSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: playerProfile,
        onSyncReceived: (st) => {
          spectatorReceivedVersions.push(st.version);
        },
        supabaseClient: mockBus,
      });

      // Simulated admin channel to inject raw broadcasts
      const adminChannel = mockBus.channel(`match-timer:${SESSION_ID}`);
      adminChannel.subscribe();

      // Scrambled sequence of version packets: 4, 2, 6, 3, 5, 7, 1
      const packetSequence = [4, 2, 6, 3, 5, 7, 1];

      for (const ver of packetSequence) {
        const payload: TimerBroadcastPayload = {
          sessionId: SESSION_ID,
          senderRole: 'admin',
          senderId: 'admin-superuser',
          hostTimestamp: BASE_TIME,
          version: ver,
          state: {
            ...createInitialTimerState(BASE_TIME),
            version: ver,
            remainingMs: 600_000 - ver * 1000,
          },
        };

        await act(async () => {
          await adminChannel.send({
            type: 'broadcast',
            event: 'TIMER_STATE_BROADCAST',
            payload,
          });
        });
      }

      // Expected progression:
      // ver 4 accepted (current = 4)
      // ver 2 rejected (2 <= 4)
      // ver 6 accepted (current = 6)
      // ver 3 rejected (3 <= 6)
      // ver 5 rejected (5 <= 6)
      // ver 7 accepted (current = 7)
      // ver 1 rejected (1 <= 7)
      expect(spectatorReceivedVersions).toEqual([4, 6, 7]);

      spectatorSync.cleanup();
    });

    it('rejects pathological non-numeric and non-finite versions', () => {
      const currentState = createInitialTimerState(BASE_TIME);

      const invalidVersions = [
        NaN,
        Infinity,
        -Infinity,
        '5' as any,
        null as any,
        undefined as any,
        {} as any,
        [] as any,
      ];

      for (const badVer of invalidVersions) {
        const payload = {
          sessionId: SESSION_ID,
          senderRole: 'admin',
          senderId: 'admin-superuser',
          hostTimestamp: BASE_TIME,
          version: badVer,
          state: createInitialTimerState(BASE_TIME),
        };

        const result = validateBroadcastPayload(payload, currentState, BASE_TIME, SESSION_ID);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('INVALID_VERSION');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Focus 2: Unauthorized Non-Admin Broadcast Injection
  // ---------------------------------------------------------------------------
  describe('Focus 2: Unauthorized Non-Admin Broadcast Injection', () => {
    it('strictly rejects broadcasts from player, anonymous, or spoofed sender roles', () => {
      const currentState = createInitialTimerState(BASE_TIME);

      const unauthorizedRoles = [
        'player',
        'anonymous',
        'spectator',
        'referee',
        'ADMIN', // case sensitive
        'admin ', // whitespace
        'root',
        '',
        null,
        undefined,
        123,
        true,
      ];

      for (const role of unauthorizedRoles) {
        const payload = {
          sessionId: SESSION_ID,
          senderRole: role,
          senderId: 'attacker-uuid',
          hostTimestamp: BASE_TIME,
          version: 10,
          state: {
            ...createInitialTimerState(BASE_TIME),
            version: 10,
          },
        };

        const result = validateBroadcastPayload(payload, currentState, BASE_TIME, SESSION_ID);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('UNAUTHORIZED_SENDER');
        expect(result.adjustedState).toBeNull();
      }
    });

    it('non-admin handle broadcastState immediately returns false without dispatching', async () => {
      const mockBus = createMockRealtimeBus();
      const broadcastSpy = vi.fn();

      const nonAdminSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: playerProfile,
        supabaseClient: mockBus,
      });

      // Listen on channel to verify nothing was dispatched
      const observerChannel = mockBus.channel(`match-timer:${SESSION_ID}`);
      observerChannel.on('broadcast', { event: 'TIMER_STATE_BROADCAST' }, broadcastSpy);
      observerChannel.subscribe();

      let success = true;
      await act(async () => {
        success = await nonAdminSync.broadcastState(createInitialTimerState(BASE_TIME));
      });

      expect(success).toBe(false);
      expect(broadcastSpy).not.toHaveBeenCalled();

      nonAdminSync.cleanup();
    });

    it('non-admin client receiving TIMER_REQUEST_SYNC never responds with TIMER_SYNC', async () => {
      const mockBus = createMockRealtimeBus();
      const syncResponseSpy = vi.fn();

      // Setup non-admin client
      const nonAdminSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: playerProfile,
        getCurrentState: () => createInitialTimerState(BASE_TIME),
        supabaseClient: mockBus,
      });

      // Observer listening for TIMER_SYNC response
      const observerChannel = mockBus.channel(`match-timer:${SESSION_ID}`);
      observerChannel.on('broadcast', { event: 'TIMER_SYNC' }, syncResponseSpy);
      observerChannel.subscribe();

      // Trigger request sync event on the bus
      await act(async () => {
        await observerChannel.send({
          type: 'broadcast',
          event: 'TIMER_REQUEST_SYNC',
          payload: {
            sessionId: SESSION_ID,
            requesterId: 'another-user',
            requesterRole: 'player',
            timestamp: BASE_TIME,
          },
        });
      });

      // Non-admin MUST NOT respond
      expect(syncResponseSpy).not.toHaveBeenCalled();

      nonAdminSync.cleanup();
    });
  });

  // ---------------------------------------------------------------------------
  // Focus 3: Malformed & Pathological Payload Shielding
  // ---------------------------------------------------------------------------
  describe('Focus 3: Malformed & Pathological Payload Shielding', () => {
    it('rejects cross-session broadcasts attempting to hijack another match', () => {
      const currentState = createInitialTimerState(BASE_TIME);
      const foreignPayload: TimerBroadcastPayload = {
        sessionId: 'foreign-session-999',
        senderRole: 'admin',
        senderId: 'admin-superuser',
        hostTimestamp: BASE_TIME,
        version: 5,
        state: {
          ...createInitialTimerState(BASE_TIME),
          version: 5,
        },
      };

      const result = validateBroadcastPayload(
        foreignPayload,
        currentState,
        BASE_TIME,
        SESSION_ID // expected session
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SESSION_MISMATCH');
    });

    it('rejects null, non-object, or empty payloads safely without throwing', () => {
      const corruptedInputs = [
        null,
        undefined,
        '',
        'corrupted-string',
        12345,
        true,
        [],
        [1, 2, 3],
      ];

      for (const input of corruptedInputs) {
        const result = validateBroadcastPayload(input);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('INVALID_PAYLOAD');
      }
    });

    it('rejects payload containing corrupted or impossible inner TimerState', () => {
      const payloadWithNegativeRemaining = {
        sessionId: SESSION_ID,
        senderRole: 'admin',
        senderId: 'admin-superuser',
        hostTimestamp: BASE_TIME,
        version: 5,
        state: {
          phase: 'PLAYING',
          status: 'RUNNING',
          deadline: BASE_TIME + 600_000,
          remainingMs: -999, // negative duration!
          phaseDurationMs: PLAYING_DURATION_MS,
          lastGoalEventId: null,
          version: 5,
          updatedAt: BASE_TIME,
        },
      };

      const res1 = validateBroadcastPayload(payloadWithNegativeRemaining, null, BASE_TIME, SESSION_ID);
      expect(res1.valid).toBe(false);
      expect(res1.reason).toBe('INVALID_STATE');

      const payloadWithInvalidPhase = {
        ...payloadWithNegativeRemaining,
        state: {
          ...payloadWithNegativeRemaining.state,
          remainingMs: 300_000,
          phase: 'CHAOS_PHASE', // invalid phase enum
        },
      };

      const res2 = validateBroadcastPayload(payloadWithInvalidPhase, null, BASE_TIME, SESSION_ID);
      expect(res2.valid).toBe(false);
      expect(res2.reason).toBe('INVALID_STATE');
    });
  });

  // ---------------------------------------------------------------------------
  // Focus 4: Rapid Successive Broadcasts & Multi-Client Concurrency Stress
  // ---------------------------------------------------------------------------
  describe('Focus 4: Multi-Client Concurrency & Spectator Isolation', () => {
    it('supports 1 admin broadcasting to 5 concurrent spectator clients flawlessly', async () => {
      const mockBus = createMockRealtimeBus();

      // 1 Admin hook
      const { result: adminHook } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: adminProfile,
          storageEnabled: false,
          supabaseClient: mockBus,
        })
      );

      // 5 Spectator hooks
      const spectatorHooks = Array.from({ length: 5 }, (_, idx) =>
        renderHook(() =>
          useWinnerStaysTimer({
            sessionId: SESSION_ID,
            session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
            profile: { id: `spectator-${idx}`, role: 'player' },
            storageEnabled: false,
            supabaseClient: mockBus,
          })
        )
      );

      // Verify all spectators start at IDLE 10:00 version 1
      for (const spectator of spectatorHooks) {
        expect(spectator.result.current.state.status).toBe('IDLE');
        expect(spectator.result.current.formattedTime).toBe('10:00');
        expect(spectator.result.current.state.version).toBe(1);
      }

      // Admin starts match
      act(() => {
        adminHook.current.start();
      });

      // All 5 spectators must now be RUNNING at version 2
      for (const spectator of spectatorHooks) {
        expect(spectator.result.current.state.status).toBe('RUNNING');
        expect(spectator.result.current.state.version).toBe(2);
      }

      // Admin pauses match
      act(() => {
        adminHook.current.pause();
      });

      // All 5 spectators must now be PAUSED at version 3
      for (const spectator of spectatorHooks) {
        expect(spectator.result.current.state.status).toBe('PAUSED');
        expect(spectator.result.current.state.version).toBe(3);
      }
    });

    it('spectators executing mutations concurrently are blocked and produce zero side-effects', async () => {
      const mockBus = createMockRealtimeBus();

      const { result: spectator1 } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: { id: 'spectator-1', role: 'player' },
          storageEnabled: true,
          supabaseClient: mockBus,
        })
      );

      const { result: spectator2 } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: { id: 'spectator-2', role: 'player' },
          storageEnabled: true,
          supabaseClient: mockBus,
        })
      );

      // Spectator 1 attempts all mutations
      act(() => {
        spectator1.current.start();
        spectator1.current.pause();
        spectator1.current.skip();
      });

      let resetResult = true;
      await act(async () => {
        resetResult = await spectator1.current.reset();
      });
      expect(resetResult).toBe(false);

      // Both spectators must remain completely un-mutated at IDLE version 1
      expect(spectator1.current.state.status).toBe('IDLE');
      expect(spectator1.current.state.version).toBe(1);
      expect(spectator2.current.state.status).toBe('IDLE');
      expect(spectator2.current.state.version).toBe(1);

      // LocalStorage must not have been corrupted with mutated versions
      const stored = loadTimerState(SESSION_ID);
      expect(stored?.version ?? 1).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Focus 5: Clock Skew Boundaries & Math Precision
  // ---------------------------------------------------------------------------
  describe('Focus 5: Extreme Clock Skew Boundaries', () => {
    it('compensates accurately when host clock is 1 hour in the future', () => {
      const receiverNow = BASE_TIME;
      const hostTimestamp = BASE_TIME + 3_600_000; // +1 hr
      const hostDeadline = hostTimestamp + 60_000; // 60s remaining

      const payload: TimerBroadcastPayload = {
        sessionId: SESSION_ID,
        senderRole: 'admin',
        senderId: 'admin-superuser',
        hostTimestamp,
        version: 2,
        state: {
          phase: 'GOAL_BUFFER',
          status: 'RUNNING',
          deadline: hostDeadline,
          remainingMs: 60_000,
          phaseDurationMs: GOAL_BUFFER_DURATION_MS,
          lastGoalEventId: 'goal-skew-1',
          version: 2,
          updatedAt: hostTimestamp,
          previousState: null,
        },
      };

      const result = validateBroadcastPayload(payload, null, receiverNow, SESSION_ID);
      expect(result.valid).toBe(true);
      expect(result.skew).toBe(3_600_000);
      // Adjusted deadline must translate to receiverNow + 60_000
      expect(result.adjustedState?.deadline).toBe(receiverNow + 60_000);
      expect(result.adjustedState?.remainingMs).toBe(60_000);
    });

    it('compensates accurately when host clock is 1 hour in the past', () => {
      const receiverNow = BASE_TIME + 3_600_000; // receiver is 1 hr ahead
      const hostTimestamp = BASE_TIME;
      const hostDeadline = hostTimestamp + 600_000; // 10 mins

      const payload: TimerBroadcastPayload = {
        sessionId: SESSION_ID,
        senderRole: 'admin',
        senderId: 'admin-superuser',
        hostTimestamp,
        version: 3,
        state: {
          phase: 'PLAYING',
          status: 'RUNNING',
          deadline: hostDeadline,
          remainingMs: 600_000,
          phaseDurationMs: PLAYING_DURATION_MS,
          lastGoalEventId: null,
          version: 3,
          updatedAt: hostTimestamp,
          previousState: null,
        },
      };

      const result = validateBroadcastPayload(payload, null, receiverNow, SESSION_ID);
      expect(result.valid).toBe(true);
      expect(result.skew).toBe(-3_600_000);
      expect(result.adjustedState?.deadline).toBe(receiverNow + 600_000);
      expect(result.adjustedState?.remainingMs).toBe(600_000);
    });

    it('clamps remainingMs to 0 when adjusted deadline has already passed on receiver', () => {
      const receiverNow = BASE_TIME + 700_000;
      const hostTimestamp = BASE_TIME + 700_000;
      const hostDeadline = BASE_TIME + 600_000; // expired 100s ago

      const payload: TimerBroadcastPayload = {
        sessionId: SESSION_ID,
        senderRole: 'admin',
        senderId: 'admin-superuser',
        hostTimestamp,
        version: 4,
        state: {
          phase: 'PLAYING',
          status: 'RUNNING',
          deadline: hostDeadline,
          remainingMs: 10_000, // un-updated remainingMs from sender
          phaseDurationMs: PLAYING_DURATION_MS,
          lastGoalEventId: null,
          version: 4,
          updatedAt: hostTimestamp,
          previousState: null,
        },
      };

      const result = validateBroadcastPayload(payload, null, receiverNow, SESSION_ID);
      expect(result.valid).toBe(true);
      expect(result.adjustedState?.remainingMs).toBe(0);
    });
  });
});
