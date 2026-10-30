/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Test Suite: frontend/src/pages/ActiveMatch/timer/__tests__/timerSync.test.ts
 *
 * Comprehensive Unit and Integration Tests for Realtime Synchronization & Admin Authority:
 * 1. Payload Creation & Role Typing
 * 2. Role Enforcement (Rejects Non-Admin Senders)
 * 3. Session Isolation & Validation Shielding
 * 4. Monotonic Version Conflict Resolution (Higher version wins, stale rejected)
 * 5. Clock Skew Compensation (Sub-100ms multi-device accuracy)
 * 6. Channel Protocol & Join Handshake (TIMER_REQUEST_SYNC -> TIMER_SYNC)
 * 7. Disconnection, Cleanup & Re-sync
 * 8. End-to-End Hook Wiring in useWinnerStaysTimer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createTimerBroadcastPayload,
  validateBroadcastPayload,
  setupTimerRealtimeSync,
  broadcastTimerState,
  subscribeToTimerSync,
  getTimerChannelName,
} from '../timerSync';
import {
  createInitialTimerState,
  PLAYING_DURATION_MS,
} from '../timerEngine';
import { loadTimerState } from '../timerStorage';
import { useWinnerStaysTimer } from '../useWinnerStaysTimer';
import type { TimerState } from '../types';

/**
 * Creates an in-memory mock Supabase Realtime bus for multi-client testing.
 */
function createMockRealtimeClient() {
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

      const channelId = `ch-${++idCounter}`;
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
          // Deliver to all other registered clients on this topic (self: false)
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

describe('Timer Realtime Synchronization (timerSync.ts)', () => {
  const BASE_TIME = 1_700_000_000_000;
  const SESSION_ID = 'test-session-123';
  const adminProfile = { id: 'admin-uuid', role: 'admin' };
  const playerProfile = { id: 'player-uuid', role: 'player' };

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
  // 1. Payload Creation & Typing
  // ---------------------------------------------------------------------------
  describe('1. createTimerBroadcastPayload', () => {
    it('creates authoritative broadcast payload for admin', () => {
      const state = createInitialTimerState(BASE_TIME);
      const payload = createTimerBroadcastPayload(state, SESSION_ID, adminProfile, BASE_TIME);

      expect(payload).toEqual({
        sessionId: SESSION_ID,
        state,
        senderRole: 'admin',
        senderId: 'admin-uuid',
        hostTimestamp: BASE_TIME,
        version: 1,
      });
    });

    it('assigns player and anonymous roles accurately', () => {
      const state = createInitialTimerState(BASE_TIME);
      const playerPayload = createTimerBroadcastPayload(state, SESSION_ID, playerProfile, BASE_TIME);
      expect(playerPayload.senderRole).toBe('player');
      expect(playerPayload.senderId).toBe('player-uuid');

      const anonPayload = createTimerBroadcastPayload(state, SESSION_ID, null, BASE_TIME);
      expect(anonPayload.senderRole).toBe('anonymous');
      expect(anonPayload.senderId).toBe('anonymous');
    });

    it('includes deep copy of timer state so mutations do not taint original', () => {
      const state = createInitialTimerState(BASE_TIME);
      const payload = createTimerBroadcastPayload(state, SESSION_ID, adminProfile, BASE_TIME);

      state.version = 99;
      expect(payload.state.version).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Role Enforcement & Permission Shielding
  // ---------------------------------------------------------------------------
  describe('2. Role Enforcement & Authorization Gating', () => {
    it('accepts valid broadcast sent by authoritative admin', () => {
      const state = createInitialTimerState(BASE_TIME);
      const payload = createTimerBroadcastPayload(state, SESSION_ID, adminProfile, BASE_TIME);

      const result = validateBroadcastPayload(payload, null, BASE_TIME, SESSION_ID);
      expect(result.valid).toBe(true);
      expect(result.adjustedState).toBeDefined();
      expect(result.reason).toBeUndefined();
    });

    it('rejects broadcast sent by a player (non-admin)', () => {
      const state = createInitialTimerState(BASE_TIME);
      const payload = createTimerBroadcastPayload(state, SESSION_ID, playerProfile, BASE_TIME);

      const result = validateBroadcastPayload(payload, null, BASE_TIME, SESSION_ID);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('UNAUTHORIZED_SENDER');
      expect(result.adjustedState).toBeNull();
    });

    it('rejects broadcast sent by unauthenticated / anonymous user', () => {
      const state = createInitialTimerState(BASE_TIME);
      const payload = createTimerBroadcastPayload(state, SESSION_ID, null, BASE_TIME);

      const result = validateBroadcastPayload(payload, null, BASE_TIME, SESSION_ID);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('UNAUTHORIZED_SENDER');
      expect(result.adjustedState).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Session Isolation & Malformed Payload Shielding
  // ---------------------------------------------------------------------------
  describe('3. Session Isolation & Malformed Payload Shielding', () => {
    it('rejects payload with mismatched session ID', () => {
      const state = createInitialTimerState(BASE_TIME);
      const payload = createTimerBroadcastPayload(state, 'wrong-session', adminProfile, BASE_TIME);

      const result = validateBroadcastPayload(payload, null, BASE_TIME, SESSION_ID);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SESSION_MISMATCH');
    });

    it('rejects malformed non-object payloads', () => {
      expect(validateBroadcastPayload(null).valid).toBe(false);
      expect(validateBroadcastPayload(undefined).valid).toBe(false);
      expect(validateBroadcastPayload('string-payload').valid).toBe(false);
      expect(validateBroadcastPayload([1, 2, 3]).valid).toBe(false);
    });

    it('rejects payloads with corrupted or invalid inner TimerState', () => {
      const corruptPayload = {
        sessionId: SESSION_ID,
        senderRole: 'admin',
        senderId: 'admin-1',
        hostTimestamp: BASE_TIME,
        version: 5,
        state: {
          phase: 'INVALID_PHASE', // invalid enum
          status: 'RUNNING',
          remainingMs: -100, // negative duration
        },
      };

      const result = validateBroadcastPayload(corruptPayload, null, BASE_TIME, SESSION_ID);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_STATE');
    });

    it('rejects payloads with invalid version fields', () => {
      const payloadNoVersion = {
        sessionId: SESSION_ID,
        senderRole: 'admin',
        senderId: 'admin-1',
        hostTimestamp: BASE_TIME,
        version: NaN,
        state: createInitialTimerState(BASE_TIME),
      };

      const result = validateBroadcastPayload(payloadNoVersion, null, BASE_TIME, SESSION_ID);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_VERSION');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Monotonic Version Conflict Resolution
  // ---------------------------------------------------------------------------
  describe('4. Monotonic Version Conflict Resolution', () => {
    it('accepts higher version update over lower local state', () => {
      const localState = { ...createInitialTimerState(BASE_TIME), version: 2 };
      const incomingState = { ...createInitialTimerState(BASE_TIME), version: 3 };

      const payload = createTimerBroadcastPayload(incomingState, SESSION_ID, adminProfile, BASE_TIME);
      const result = validateBroadcastPayload(payload, localState, BASE_TIME, SESSION_ID);

      expect(result.valid).toBe(true);
      expect(result.adjustedState?.version).toBe(3);
    });

    it('rejects stale incoming version lower than local state', () => {
      const localState = { ...createInitialTimerState(BASE_TIME), version: 5 };
      const staleIncomingState = { ...createInitialTimerState(BASE_TIME), version: 4 };

      const payload = createTimerBroadcastPayload(staleIncomingState, SESSION_ID, adminProfile, BASE_TIME);
      const result = validateBroadcastPayload(payload, localState, BASE_TIME, SESSION_ID);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STALE_VERSION');
      expect(result.adjustedState).toBeNull();
    });

    it('rejects equal version to prevent redundant duplicate re-renders', () => {
      const localState = { ...createInitialTimerState(BASE_TIME), version: 3 };
      const incomingState = { ...createInitialTimerState(BASE_TIME), version: 3 };

      const payload = createTimerBroadcastPayload(incomingState, SESSION_ID, adminProfile, BASE_TIME);
      const result = validateBroadcastPayload(payload, localState, BASE_TIME, SESSION_ID);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STALE_VERSION');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Clock Skew Compensation Math
  // ---------------------------------------------------------------------------
  describe('5. Clock Skew Compensation Math', () => {
    it('compensates accurately when host clock is ahead of spectator clock', () => {
      // Host is 4,000 ms ahead
      const receiverNow = BASE_TIME; // 1,700,000,000,000
      const hostTimestamp = BASE_TIME + 4_000; // 1,700,000,004,000
      const hostDeadline = hostTimestamp + 60_000; // 60s buffer -> expires at 1,700,000,064,000

      const hostState: TimerState = {
        phase: 'GOAL_BUFFER',
        status: 'RUNNING',
        deadline: hostDeadline,
        remainingMs: 60_000,
        phaseDurationMs: 60_000,
        lastGoalEventId: 'g-1',
        version: 2,
        updatedAt: hostTimestamp,
        previousState: null,
      };

      const payload = createTimerBroadcastPayload(hostState, SESSION_ID, adminProfile, hostTimestamp);
      const result = validateBroadcastPayload(payload, null, receiverNow, SESSION_ID);

      expect(result.valid).toBe(true);
      expect(result.skew).toBe(4_000);
      // Adjusted deadline should be hostDeadline - skew = hostDeadline - 4000 = receiverNow + 60,000
      expect(result.adjustedState?.deadline).toBe(receiverNow + 60_000);
      expect(result.adjustedState?.remainingMs).toBe(60_000);
    });

    it('compensates accurately when host clock is behind spectator clock', () => {
      // Host is 3,500 ms behind receiver
      const receiverNow = BASE_TIME + 10_000;
      const hostTimestamp = BASE_TIME + 6_500;
      const hostDeadline = hostTimestamp + 300_000; // 5 mins left from host perspective

      const hostState: TimerState = {
        phase: 'PLAYING',
        status: 'RUNNING',
        deadline: hostDeadline,
        remainingMs: 300_000,
        phaseDurationMs: PLAYING_DURATION_MS,
        lastGoalEventId: null,
        version: 3,
        updatedAt: hostTimestamp,
        previousState: null,
      };

      const payload = createTimerBroadcastPayload(hostState, SESSION_ID, adminProfile, hostTimestamp);
      const result = validateBroadcastPayload(payload, null, receiverNow, SESSION_ID);

      expect(result.valid).toBe(true);
      expect(result.skew).toBe(-3_500);
      // Adjusted deadline: hostDeadline - (-3500) = hostDeadline + 3500
      // hostDeadline = hostTimestamp + 300_000 = (receiverNow - 3500) + 300_000
      // adjustedDeadline = (receiverNow - 3500 + 300000) + 3500 = receiverNow + 300_000
      expect(result.adjustedState?.deadline).toBe(receiverNow + 300_000);
      expect(result.adjustedState?.remainingMs).toBe(300_000);
    });

    it('leaves deadline null when timer is PAUSED or IDLE without skewing remainingMs', () => {
      const hostTimestamp = BASE_TIME + 5_000;
      const receiverNow = BASE_TIME;

      const pausedState: TimerState = {
        phase: 'PLAYING',
        status: 'PAUSED',
        deadline: null,
        remainingMs: 420_000, // 7:00
        phaseDurationMs: PLAYING_DURATION_MS,
        lastGoalEventId: null,
        version: 4,
        updatedAt: hostTimestamp,
        previousState: null,
      };

      const payload = createTimerBroadcastPayload(pausedState, SESSION_ID, adminProfile, hostTimestamp);
      const result = validateBroadcastPayload(payload, null, receiverNow, SESSION_ID);

      expect(result.valid).toBe(true);
      expect(result.adjustedState?.deadline).toBeNull();
      expect(result.adjustedState?.remainingMs).toBe(420_000);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Channel Protocol & Join Handshake
  // ---------------------------------------------------------------------------
  describe('6. Realtime Channel Protocol & Join Handshake', () => {
    it('spectator sends TIMER_REQUEST_SYNC on mount, and admin responds with TIMER_SYNC', async () => {
      const mockBus = createMockRealtimeClient();
      let adminCurrentState = {
        ...createInitialTimerState(BASE_TIME),
        status: 'RUNNING' as const,
        remainingMs: 500_000,
        deadline: BASE_TIME + 500_000,
        version: 4,
      };

      const spectatorReceivedStates: TimerState[] = [];

      // 1. Setup Admin listener
      const adminSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: true,
        profile: adminProfile,
        getCurrentState: () => adminCurrentState,
        supabaseClient: mockBus,
      });

      // 2. Setup Spectator listener
      const spectatorSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: playerProfile,
        onSyncReceived: (state) => {
          spectatorReceivedStates.push(state);
        },
        supabaseClient: mockBus,
      });

      // 3. Trigger spectator sync request
      await act(async () => {
        await spectatorSync.requestSync();
      });

      // Expect spectator received admin's current authoritative state via TIMER_SYNC
      expect(spectatorReceivedStates.length).toBe(1);
      expect(spectatorReceivedStates[0].version).toBe(4);
      expect(spectatorReceivedStates[0].status).toBe('RUNNING');
      expect(spectatorReceivedStates[0].remainingMs).toBe(500_000);

      adminSync.cleanup();
      spectatorSync.cleanup();
    });

    it('admin broadcasts state update, and spectator receives it', async () => {
      const mockBus = createMockRealtimeClient();
      const spectatorReceivedStates: TimerState[] = [];

      const adminSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: true,
        profile: adminProfile,
        supabaseClient: mockBus,
      });

      const spectatorSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: playerProfile,
        onSyncReceived: (state) => {
          spectatorReceivedStates.push(state);
        },
        supabaseClient: mockBus,
      });

      // Admin broadcasts state version 2
      const nextState: TimerState = {
        ...createInitialTimerState(BASE_TIME),
        phase: 'GOAL_BUFFER',
        status: 'RUNNING',
        remainingMs: 60_000,
        deadline: BASE_TIME + 60_000,
        version: 2,
        lastGoalEventId: 'goal-99',
      };

      await act(async () => {
        const ok = await adminSync.broadcastState(nextState);
        expect(ok).toBe(true);
      });

      expect(spectatorReceivedStates.length).toBe(1);
      expect(spectatorReceivedStates[0].version).toBe(2);
      expect(spectatorReceivedStates[0].phase).toBe('GOAL_BUFFER');
      expect(spectatorReceivedStates[0].lastGoalEventId).toBe('goal-99');

      adminSync.cleanup();
      spectatorSync.cleanup();
    });

    it('spectator calling broadcastState is rejected and does not dispatch', async () => {
      const mockBus = createMockRealtimeClient();
      const adminReceivedStates: TimerState[] = [];

      const spectatorSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: playerProfile,
        supabaseClient: mockBus,
      });

      const adminSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: true,
        profile: adminProfile,
        onSyncReceived: (state) => {
          adminReceivedStates.push(state);
        },
        supabaseClient: mockBus,
      });

      let broadcastResult: boolean = true;
      await act(async () => {
        broadcastResult = await spectatorSync.broadcastState(createInitialTimerState(BASE_TIME));
      });

      expect(broadcastResult).toBe(false);
      expect(adminReceivedStates.length).toBe(0);

      spectatorSync.cleanup();
      adminSync.cleanup();
    });

    it('channels use exact naming format match-timer:${sessionId}', () => {
      expect(getTimerChannelName('abc-xyz')).toBe('match-timer:abc-xyz');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Disconnection, Cleanup & Re-sync
  // ---------------------------------------------------------------------------
  describe('7. Disconnection, Cleanup & Re-sync', () => {
    it('cleans up channel subscription on unmount', () => {
      const mockBus = createMockRealtimeClient();
      const sync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: true,
        profile: adminProfile,
        supabaseClient: mockBus,
      });

      expect(mockBus._getTopicMap().has(`match-timer:${SESSION_ID}`)).toBe(true);
      sync.cleanup();
      expect(mockBus._getTopicMap().has(`match-timer:${SESSION_ID}`)).toBe(false);
    });

    it('re-subscribes cleanly and catches up to admin state on re-connect', async () => {
      const mockBus = createMockRealtimeClient();
      let adminState: TimerState = {
        ...createInitialTimerState(BASE_TIME),
        version: 5,
        status: 'PAUSED',
        remainingMs: 360_000,
      };

      const adminSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: true,
        profile: adminProfile,
        getCurrentState: () => adminState,
        supabaseClient: mockBus,
      });

      // Spectator connects initially
      let spectatorState: TimerState | null = null;
      let spectatorSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: playerProfile,
        onSyncReceived: (st) => {
          spectatorState = st;
        },
        supabaseClient: mockBus,
      });

      await act(async () => {
        await spectatorSync.requestSync();
      });
      expect((spectatorState as TimerState | null)?.version).toBe(5);

      // Spectator disconnects (e.g. lost tunnel / page unmount)
      spectatorSync.cleanup();

      // Admin mutates state to version 6 while spectator is gone
      adminState = {
        ...adminState,
        version: 6,
        status: 'RUNNING',
        deadline: BASE_TIME + 360_000,
      };

      // Spectator reconnects
      spectatorSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: playerProfile,
        onSyncReceived: (st) => {
          spectatorState = st;
        },
        supabaseClient: mockBus,
      });

      await act(async () => {
        await spectatorSync.requestSync();
      });

      expect((spectatorState as TimerState | null)?.version).toBe(6);
      expect((spectatorState as TimerState | null)?.status).toBe('RUNNING');

      adminSync.cleanup();
      spectatorSync.cleanup();
    });
  });

  // ---------------------------------------------------------------------------
  // 8. End-to-End Hook Wiring in useWinnerStaysTimer
  // ---------------------------------------------------------------------------
  describe('8. End-to-End Hook Wiring (useWinnerStaysTimer)', () => {
    it('admin starting the timer automatically broadcasts new state to spectator', async () => {
      const mockBus = createMockRealtimeClient();

      // Admin Hook
      const { result: adminResult } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: adminProfile,
          storageEnabled: true,
          supabaseClient: mockBus,
        })
      );

      // Spectator Hook
      const { result: spectatorResult } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: playerProfile,
          storageEnabled: true,
          supabaseClient: mockBus,
        })
      );

      // Initial state: spectator is at IDLE 10:00 version 1
      expect(spectatorResult.current.state.status).toBe('IDLE');
      expect(spectatorResult.current.formattedTime).toBe('10:00');

      // Admin clicks Start
      act(() => {
        adminResult.current.start();
      });

      expect(adminResult.current.state.status).toBe('RUNNING');
      expect(adminResult.current.state.version).toBe(2);

      // Spectator automatically updated to RUNNING version 2!
      expect(spectatorResult.current.state.status).toBe('RUNNING');
      expect(spectatorResult.current.state.version).toBe(2);

      // Verify localStorage was updated on spectator as well
      const persisted = loadTimerState(SESSION_ID);
      expect(persisted?.status).toBe('RUNNING');
      expect(persisted?.version).toBe(2);
    });

    it('admin pausing and skipping buffer synchronizes in real time to spectator', async () => {
      const mockBus = createMockRealtimeClient();

      const { result: admin } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: adminProfile,
          storageEnabled: false,
          supabaseClient: mockBus,
        })
      );

      const { result: spectator } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: playerProfile,
          storageEnabled: false,
          supabaseClient: mockBus,
        })
      );

      // 1. Admin starts
      act(() => {
        admin.current.start();
      });
      expect(spectator.current.state.status).toBe('RUNNING');

      // 2. Admin pauses
      act(() => {
        admin.current.pause();
      });
      expect(admin.current.state.status).toBe('PAUSED');
      expect(spectator.current.state.status).toBe('PAUSED');
      expect(spectator.current.state.version).toBe(admin.current.state.version);
    });

    it('spectator controls remain strictly blocked and do not mutate admin', async () => {
      const mockBus = createMockRealtimeClient();

      const { result: admin } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: adminProfile,
          storageEnabled: false,
          supabaseClient: mockBus,
        })
      );

      const { result: spectator } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: playerProfile,
          storageEnabled: false,
          supabaseClient: mockBus,
        })
      );

      expect(spectator.current.isAdmin).toBe(false);

      // Spectator tries to start
      act(() => {
        spectator.current.start();
      });
      expect(spectator.current.state.status).toBe('IDLE');
      expect(admin.current.state.status).toBe('IDLE');

      // Spectator tries to pause
      act(() => {
        spectator.current.pause();
      });
      expect(spectator.current.state.status).toBe('IDLE');

      // Spectator tries to skip
      act(() => {
        spectator.current.skip();
      });
      expect(spectator.current.state.phase).toBe('PLAYING');
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Convenience Wrappers (PROJECT.md API compatibility)
  // ---------------------------------------------------------------------------
  describe('9. Standalone Convenience Helpers', () => {
    it('broadcastTimerState and subscribeToTimerSync function accurately', async () => {
      const mockBus = createMockRealtimeClient();
      const received: TimerState[] = [];

      const unsub = subscribeToTimerSync(
        SESSION_ID,
        (st) => {
          received.push(st);
        },
        mockBus as any
      );

      const state = { ...createInitialTimerState(BASE_TIME), version: 10 };
      await act(async () => {
        const ok = await broadcastTimerState(SESSION_ID, state, adminProfile, mockBus as any);
        expect(ok).toBe(true);
      });

      expect(received.length).toBe(1);
      expect(received[0].version).toBe(10);

      unsub();
    });
  });
});
