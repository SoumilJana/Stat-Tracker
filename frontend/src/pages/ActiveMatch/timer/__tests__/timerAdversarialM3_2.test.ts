/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Test Suite: frontend/src/pages/ActiveMatch/timer/__tests__/timerAdversarialM3_2.test.ts
 *
 * Adversarial Stress & Chaos Test Suite for Challenger M3_2:
 * 1. Host Clock 10 Seconds Ahead of Client Clock (+10,000ms skew compensation)
 * 2. Host Clock 10 Seconds Behind Client Clock (-10,000ms skew compensation)
 * 3. Client Receives Sync While Paused (ensuring remaining time is immune to clock skew)
 * 4. Channel Unsubscribe / Cleanup on Unmount (leak prevention, listener teardown, and idempotency)
 * 5. Disconnection, Offline State Progression, and Reconnect Catch-Up Handshake
 * 6. Malformed / Pathological Host Timestamp Resilience (NaN, Infinity, null, string)
 * 7. Extreme Multi-Hour Clock Drift and Past-Deadline Clamping
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  validateBroadcastPayload,
  createTimerBroadcastPayload,
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
  const removedChannels: any[] = [];

  return {
    channel(channelName: string) {
      if (!topicMap.has(channelName)) {
        topicMap.set(channelName, new Map());
      }
      const channelsForTopic = topicMap.get(channelName)!;

      const channelId = `ch-adv3-2-${++idCounter}`;
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
      removedChannels.push(channel);
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
    _getRemovedChannels() {
      return removedChannels;
    },
  };
}

describe('Challenger M3_2: Clock Skew Compensation & Channel Disconnection Handling', () => {
  const BASE_TIME = 1_700_000_000_000;
  const SESSION_ID = 'session-challenger-m3-2';
  const adminProfile = { id: 'admin-host-uuid', role: 'admin' };
  const spectatorProfile = { id: 'spectator-uuid', role: 'player' };

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
  // 1. Host Clock 10 Seconds Ahead (+10,000ms Skew)
  // ---------------------------------------------------------------------------
  describe('Focus 1: Host Clock 10 Seconds Ahead of Client Clock', () => {
    it('compensates +10,000ms skew exactly when host starts 60s buffer', () => {
      const clientReceiveNow = BASE_TIME;
      const hostTimestamp = BASE_TIME + 10_000; // Host is 10s ahead
      const hostDeadline = hostTimestamp + GOAL_BUFFER_DURATION_MS; // 1,700,000,070,000

      const hostState: TimerState = {
        phase: 'GOAL_BUFFER',
        status: 'RUNNING',
        deadline: hostDeadline,
        remainingMs: GOAL_BUFFER_DURATION_MS,
        phaseDurationMs: GOAL_BUFFER_DURATION_MS,
        lastGoalEventId: 'goal-skew-ahead',
        version: 2,
        updatedAt: hostTimestamp,
        previousState: null,
      };

      const payload = createTimerBroadcastPayload(hostState, SESSION_ID, adminProfile, hostTimestamp);
      const validation = validateBroadcastPayload(payload, null, clientReceiveNow, SESSION_ID);

      expect(validation.valid).toBe(true);
      expect(validation.skew).toBe(10_000);
      // Adjusted deadline must map to client's timeline: clientReceiveNow + 60,000
      expect(validation.adjustedState?.deadline).toBe(clientReceiveNow + 60_000);
      expect(validation.adjustedState?.remainingMs).toBe(60_000);
    });

    it('maintains synchronized countdown across host and client when host is +10s ahead', async () => {
      const mockBus = createMockRealtimeBus();

      // Host starts playing at host time (BASE_TIME + 10_000)
      const hostNow = BASE_TIME + 10_000;

      const hostRunningState: TimerState = {
        phase: 'PLAYING',
        status: 'RUNNING',
        deadline: hostNow + 400_000, // 400s left
        remainingMs: 400_000,
        phaseDurationMs: PLAYING_DURATION_MS,
        lastGoalEventId: null,
        version: 3,
        updatedAt: hostNow,
      };

      const { result: clientHook } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: spectatorProfile,
          storageEnabled: false,
          supabaseClient: mockBus,
        })
      );

      const payload = createTimerBroadcastPayload(hostRunningState, SESSION_ID, adminProfile, hostNow);

      const adminSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: true,
        profile: adminProfile,
        now: () => hostNow,
        supabaseClient: mockBus,
      });

      await act(async () => {
        await mockBus.channel(`match-timer:${SESSION_ID}`).send({
          type: 'broadcast',
          event: 'TIMER_STATE_BROADCAST',
          payload,
        });
      });

      // Client should show exactly 400,000 ms (06:40) despite 10s clock disparity
      expect(clientHook.current.state.status).toBe('RUNNING');
      expect(clientHook.current.remainingMs).toBe(400_000);
      expect(clientHook.current.formattedTime).toBe('06:40');

      // Advance client time by 15 seconds
      act(() => {
        vi.advanceTimersByTime(15_000);
      });

      expect(clientHook.current.remainingMs).toBe(385_000);
      expect(clientHook.current.formattedTime).toBe('06:25');

      adminSync.cleanup();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Host Clock 10 Seconds Behind (-10,000ms Skew)
  // ---------------------------------------------------------------------------
  describe('Focus 2: Host Clock 10 Seconds Behind Client Clock', () => {
    it('compensates -10,000ms skew accurately when host starts 10m playing', () => {
      const clientReceiveNow = BASE_TIME + 10_000; // Client is at BASE_TIME + 10s
      const hostTimestamp = BASE_TIME; // Host is 10s behind
      const hostDeadline = hostTimestamp + PLAYING_DURATION_MS; // 1,700,000,600,000

      const hostState: TimerState = {
        phase: 'PLAYING',
        status: 'RUNNING',
        deadline: hostDeadline,
        remainingMs: PLAYING_DURATION_MS,
        phaseDurationMs: PLAYING_DURATION_MS,
        lastGoalEventId: null,
        version: 2,
        updatedAt: hostTimestamp,
        previousState: null,
      };

      const payload = createTimerBroadcastPayload(hostState, SESSION_ID, adminProfile, hostTimestamp);
      const validation = validateBroadcastPayload(payload, null, clientReceiveNow, SESSION_ID);

      expect(validation.valid).toBe(true);
      expect(validation.skew).toBe(-10_000);
      // Adjusted deadline must be hostDeadline - (-10,000) = hostDeadline + 10,000 = clientReceiveNow + 600,000
      expect(validation.adjustedState?.deadline).toBe(clientReceiveNow + PLAYING_DURATION_MS);
      expect(validation.adjustedState?.remainingMs).toBe(PLAYING_DURATION_MS);
    });

    it('countdown remains accurate when client is 10s ahead of host', async () => {
      const mockBus = createMockRealtimeBus();

      const hostTimestamp = BASE_TIME;
      const clientTimestamp = BASE_TIME + 10_000;
      vi.setSystemTime(clientTimestamp);

      const hostRunningState: TimerState = {
        phase: 'PLAYING',
        status: 'RUNNING',
        deadline: hostTimestamp + 250_000, // 250s left
        remainingMs: 250_000,
        phaseDurationMs: PLAYING_DURATION_MS,
        lastGoalEventId: null,
        version: 2,
        updatedAt: hostTimestamp,
      };

      const { result: clientHook } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: spectatorProfile,
          storageEnabled: false,
          supabaseClient: mockBus,
        })
      );

      const payload = createTimerBroadcastPayload(hostRunningState, SESSION_ID, adminProfile, hostTimestamp);

      await act(async () => {
        await mockBus.channel(`match-timer:${SESSION_ID}`).send({
          type: 'broadcast',
          event: 'TIMER_STATE_BROADCAST',
          payload,
        });
      });

      expect(clientHook.current.state.status).toBe('RUNNING');
      expect(clientHook.current.remainingMs).toBe(250_000);
      expect(clientHook.current.formattedTime).toBe('04:10');

      act(() => {
        vi.advanceTimersByTime(20_000);
      });

      expect(clientHook.current.remainingMs).toBe(230_000);
      expect(clientHook.current.formattedTime).toBe('03:50');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Client Receives Sync While Paused
  // ---------------------------------------------------------------------------
  describe('Focus 3: Client Receives Sync While Paused', () => {
    it('ensures remainingMs is strictly immune to clock skew when timer is PAUSED', () => {
      const clientNow = BASE_TIME;
      const hostTimestamp = BASE_TIME + 10_000; // 10s skew

      const pausedState: TimerState = {
        phase: 'PLAYING',
        status: 'PAUSED',
        deadline: null,
        remainingMs: 442_500, // 07:22.500
        phaseDurationMs: PLAYING_DURATION_MS,
        lastGoalEventId: null,
        version: 6,
        updatedAt: hostTimestamp,
        previousState: null,
      };

      const payload = createTimerBroadcastPayload(pausedState, SESSION_ID, adminProfile, hostTimestamp);
      const validation = validateBroadcastPayload(payload, null, clientNow, SESSION_ID);

      expect(validation.valid).toBe(true);
      // Deadline MUST remain null
      expect(validation.adjustedState?.deadline).toBeNull();
      // remainingMs MUST NOT be shifted by the 10,000ms clock skew!
      expect(validation.adjustedState?.remainingMs).toBe(442_500);
    });

    it('client hook freezes visual countdown and persists PAUSED state upon receiving paused sync', async () => {
      const mockBus = createMockRealtimeBus();

      const { result: clientHook } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: spectatorProfile,
          storageEnabled: true,
          supabaseClient: mockBus,
        })
      );

      // 1. First sync: Running at 500_000
      const runningState: TimerState = {
        ...createInitialTimerState(BASE_TIME),
        status: 'RUNNING',
        deadline: BASE_TIME + 500_000,
        remainingMs: 500_000,
        version: 2,
      };

      await act(async () => {
        await mockBus.channel(`match-timer:${SESSION_ID}`).send({
          type: 'broadcast',
          event: 'TIMER_STATE_BROADCAST',
          payload: createTimerBroadcastPayload(runningState, SESSION_ID, adminProfile, BASE_TIME),
        });
      });

      expect(clientHook.current.state.status).toBe('RUNNING');

      // 2. Second sync: Admin pauses at 480_000 (host is 10s ahead)
      const pausedState: TimerState = {
        ...runningState,
        status: 'PAUSED',
        deadline: null,
        remainingMs: 480_000,
        version: 3,
      };

      await act(async () => {
        await mockBus.channel(`match-timer:${SESSION_ID}`).send({
          type: 'broadcast',
          event: 'TIMER_STATE_BROADCAST',
          payload: createTimerBroadcastPayload(pausedState, SESSION_ID, adminProfile, BASE_TIME + 10_000),
        });
      });

      expect(clientHook.current.state.status).toBe('PAUSED');
      expect(clientHook.current.remainingMs).toBe(480_000);
      expect(clientHook.current.formattedTime).toBe('08:00');

      // Advance time by 30 seconds: verify paused clock does NOT tick
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(clientHook.current.state.status).toBe('PAUSED');
      expect(clientHook.current.remainingMs).toBe(480_000);
      expect(clientHook.current.formattedTime).toBe('08:00');

      // LocalStorage reflects paused state
      const persisted = loadTimerState(SESSION_ID);
      expect(persisted?.status).toBe('PAUSED');
      expect(persisted?.remainingMs).toBe(480_000);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Channel Unsubscribe / Cleanup on Unmount
  // ---------------------------------------------------------------------------
  describe('Focus 4: Channel Cleanup & Unmount Lifecycle', () => {
    it('unsubscribes and calls removeChannel upon hook unmount', () => {
      const mockBus = createMockRealtimeBus();

      const { unmount } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: SESSION_ID,
          session: { id: SESSION_ID, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          profile: spectatorProfile,
          supabaseClient: mockBus,
        })
      );

      const topicMap = mockBus._getTopicMap();
      expect(topicMap.has(`match-timer:${SESSION_ID}`)).toBe(true);

      // Unmount hook
      unmount();

      // Channel should be cleanly removed from the bus
      expect(topicMap.has(`match-timer:${SESSION_ID}`)).toBe(false);
      expect(mockBus._getRemovedChannels().length).toBeGreaterThanOrEqual(1);
    });

    it('cleanup handle is strictly idempotent and does not throw on repeated calls', () => {
      const mockBus = createMockRealtimeBus();

      const sync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: spectatorProfile,
        supabaseClient: mockBus,
      });

      expect(() => {
        sync.cleanup();
        sync.cleanup(); // Second call must be a safe no-op
      }).not.toThrow();

      expect(mockBus._getRemovedChannels().length).toBe(1);
    });

    it('unmounted subscriber does not receive subsequent broadcasts', async () => {
      const mockBus = createMockRealtimeBus();
      let syncReceivedCount = 0;

      const sync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: spectatorProfile,
        onSyncReceived: () => {
          syncReceivedCount++;
        },
        supabaseClient: mockBus,
      });

      // Broadcast 1: Should be received
      const state1 = { ...createInitialTimerState(BASE_TIME), version: 2 };
      await act(async () => {
        await mockBus.channel(`match-timer:${SESSION_ID}`).send({
          type: 'broadcast',
          event: 'TIMER_STATE_BROADCAST',
          payload: createTimerBroadcastPayload(state1, SESSION_ID, adminProfile, BASE_TIME),
        });
      });
      expect(syncReceivedCount).toBe(1);

      // Cleanup
      sync.cleanup();

      // Broadcast 2: Must NOT be received
      const state2 = { ...createInitialTimerState(BASE_TIME), version: 3 };
      await act(async () => {
        await mockBus.channel(`match-timer:${SESSION_ID}`).send({
          type: 'broadcast',
          event: 'TIMER_STATE_BROADCAST',
          payload: createTimerBroadcastPayload(state2, SESSION_ID, adminProfile, BASE_TIME),
        });
      });
      expect(syncReceivedCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Disconnection, Offline Mutations & Reconnect Catch-Up
  // ---------------------------------------------------------------------------
  describe('Focus 5: Disconnect, State Progression & Reconnect Catch-Up', () => {
    it('catches up smoothly across disconnect, offline state mutation, and reconnect handshake', async () => {
      const mockBus = createMockRealtimeBus();
      let adminState: TimerState = {
        ...createInitialTimerState(BASE_TIME),
        status: 'RUNNING',
        remainingMs: 600_000,
        deadline: BASE_TIME + 600_000,
        version: 2,
      };

      const adminSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: true,
        profile: adminProfile,
        getCurrentState: () => adminState,
        supabaseClient: mockBus,
      });

      // Spectator initial connection
      let spectatorState: TimerState | null = null;
      let spectatorSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: spectatorProfile,
        onSyncReceived: (st) => {
          spectatorState = st;
        },
        supabaseClient: mockBus,
      });

      await act(async () => {
        await spectatorSync.requestSync();
      });
      expect((spectatorState as TimerState | null)?.version).toBe(2);

      // Spectator tunnel breaks / disconnects
      spectatorSync.cleanup();

      // While spectator is disconnected:
      // 1. 200 seconds pass
      vi.advanceTimersByTime(200_000);
      const currentTime = BASE_TIME + 200_000;

      // 2. Goal is scored -> GOAL_BUFFER 60s
      adminState = {
        phase: 'GOAL_BUFFER',
        status: 'RUNNING',
        deadline: currentTime + 60_000,
        remainingMs: 60_000,
        phaseDurationMs: GOAL_BUFFER_DURATION_MS,
        lastGoalEventId: 'offline-goal-m3-2',
        version: 5,
        updatedAt: currentTime,
        previousState: null,
      };

      // Spectator reconnects
      spectatorSync = setupTimerRealtimeSync({
        sessionId: SESSION_ID,
        isAdmin: false,
        profile: spectatorProfile,
        onSyncReceived: (st) => {
          spectatorState = st;
        },
        supabaseClient: mockBus,
      });

      // Spectator sends TIMER_REQUEST_SYNC handshake
      await act(async () => {
        await spectatorSync.requestSync();
      });

      // Spectator instantly synchronizes to new phase, version, and remaining time
      expect((spectatorState as TimerState | null)?.version).toBe(5);
      expect((spectatorState as TimerState | null)?.phase).toBe('GOAL_BUFFER');
      expect((spectatorState as TimerState | null)?.lastGoalEventId).toBe('offline-goal-m3-2');
      expect((spectatorState as TimerState | null)?.remainingMs).toBe(60_000);

      adminSync.cleanup();
      spectatorSync.cleanup();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Malformed / Corrupted hostTimestamp Resilience
  // ---------------------------------------------------------------------------
  describe('Focus 6: Malformed hostTimestamp Shielding', () => {
    it('gracefully handles non-numeric or missing hostTimestamp by defaulting skew to 0', () => {
      const receiveNow = BASE_TIME;
      const baseState = { ...createInitialTimerState(BASE_TIME), version: 2 };

      const malformedPayloads: Array<{ hostTimestamp: any }> = [
        { hostTimestamp: NaN },
        { hostTimestamp: Infinity },
        { hostTimestamp: 'not-a-number' as any },
        { hostTimestamp: null as any },
        { hostTimestamp: undefined },
      ];

      for (const bad of malformedPayloads) {
        const payload: TimerBroadcastPayload = {
          sessionId: SESSION_ID,
          state: baseState,
          senderRole: 'admin',
          senderId: 'admin-1',
          hostTimestamp: bad.hostTimestamp,
          version: 2,
        };

        const result = validateBroadcastPayload(payload, null, receiveNow, SESSION_ID);
        expect(result.valid).toBe(true);
        expect(result.skew).toBe(0);
        expect(result.adjustedState).not.toBeNull();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Extreme Multi-Hour Clock Drift and Expiry Clamping
  // ---------------------------------------------------------------------------
  describe('Focus 7: Extreme Drift and Clamping', () => {
    it('compensates extreme skew of +2 hours without overflow or NaN', () => {
      const clientNow = BASE_TIME;
      const hostTimestamp = BASE_TIME + 7_200_000; // 2 hours ahead
      const hostDeadline = hostTimestamp + 180_000; // 3 mins left

      const hostState: TimerState = {
        phase: 'PLAYING',
        status: 'RUNNING',
        deadline: hostDeadline,
        remainingMs: 180_000,
        phaseDurationMs: PLAYING_DURATION_MS,
        lastGoalEventId: null,
        version: 4,
        updatedAt: hostTimestamp,
      };

      const payload = createTimerBroadcastPayload(hostState, SESSION_ID, adminProfile, hostTimestamp);
      const validation = validateBroadcastPayload(payload, null, clientNow, SESSION_ID);

      expect(validation.valid).toBe(true);
      expect(validation.skew).toBe(7_200_000);
      expect(validation.adjustedState?.deadline).toBe(clientNow + 180_000);
      expect(validation.adjustedState?.remainingMs).toBe(180_000);
    });

    it('safely clamps remainingMs to 0 when packet arrives after deadline expired', () => {
      const clientNow = BASE_TIME + 70_000;
      const hostTimestamp = BASE_TIME + 70_000;
      // Host deadline was 60s from BASE_TIME, so expired 10s ago
      const hostDeadline = BASE_TIME + 60_000;

      const hostState: TimerState = {
        phase: 'GOAL_BUFFER',
        status: 'RUNNING',
        deadline: hostDeadline,
        remainingMs: 0,
        phaseDurationMs: GOAL_BUFFER_DURATION_MS,
        lastGoalEventId: 'g1',
        version: 5,
        updatedAt: hostTimestamp,
      };

      const payload = createTimerBroadcastPayload(hostState, SESSION_ID, adminProfile, hostTimestamp);
      const validation = validateBroadcastPayload(payload, null, clientNow, SESSION_ID);

      expect(validation.valid).toBe(true);
      expect(validation.adjustedState?.remainingMs).toBe(0);
      expect(validation.adjustedState?.remainingMs).not.toBeLessThan(0);
    });
  });
});
