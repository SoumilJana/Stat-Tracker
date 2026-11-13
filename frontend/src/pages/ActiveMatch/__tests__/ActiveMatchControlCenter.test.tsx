import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ActiveMatch from '../../ActiveMatch';
import * as refereeAudio from '../timer/refereeAudio';
import * as refereeSensors from '../timer/useRefereeSensors';

// Mock Web Audio API & Sensors globally for clock test isolation
class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockOscillatorNode {
  type = 'sine';
  frequency = {
    value: 440,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 100;
  destination = {};
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });
  close = vi.fn().mockResolvedValue(undefined);
}

// Default Test Data
const adminProfile = {
  id: 'admin-uuid-1',
  username: 'AdminReferee',
  role: 'admin',
};

const spectatorProfile = {
  id: 'user-uuid-2',
  username: 'SpectatorFan',
  role: 'player',
};

const winnerStaysSession = {
  id: 'match-ws-101',
  mode: 'WINNER_STAYS',
  status: 'IN_PROGRESS',
  date: '2026-10-31T10:00:00Z',
  location: 'Main Pitch',
};

const baseTeams = [
  { id: 'team-a', name: 'Team Green' },
  { id: 'team-b', name: 'Team Blue' },
  { id: 'team-c', name: 'Team Orange' },
];

const baseTeamPlayers = {
  'team-a': [
    { id: 'p1', username: 'Alice', name: 'Alice' },
    { id: 'p2', username: 'Bob', name: 'Bob' },
    { id: 'p3', username: 'Charlie', name: 'Charlie' },
    { id: 'p4', username: 'David', name: 'David' },
  ],
  'team-b': [
    { id: 'p5', username: 'Eve', name: 'Eve' },
    { id: 'p6', username: 'Frank', name: 'Frank' },
    { id: 'p7', username: 'Grace', name: 'Grace' },
    { id: 'p8', username: 'Heidi', name: 'Heidi' },
    { id: 'p9', username: 'Ivan', name: 'Ivan' },
  ],
  'team-c': [
    { id: 'p10', username: 'Judy', name: 'Judy' },
    { id: 'p11', username: 'Mallory', name: 'Mallory' },
    { id: 'p12', username: 'Niaj', name: 'Niaj' },
    { id: 'p13', username: 'Olivia', name: 'Olivia' },
    { id: 'p14', username: 'Peggy', name: 'Peggy' },
    { id: 'p15', username: 'Rupert', name: 'Rupert' },
  ],
};

let currentMockData: any = {};
let setMockDataState: ((data: any) => void) | null = null;
let mockProfile: any = adminProfile;

export function updateMockData(partial: any) {
  currentMockData = { ...currentMockData, ...partial };
  const setter = setMockDataState;
  if (setter) {
    act(() => {
      setter(currentMockData);
    });
  }
}

vi.mock('../hooks/useActiveMatchData', () => ({
  useActiveMatchData: () => {
    const [state, setState] = useState(currentMockData);
    setMockDataState = setState;
    return state;
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfile,
    user: mockProfile ? { id: mockProfile.id, email: `${mockProfile.username}@example.com` } : null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

function renderActiveMatch(sessionId = 'match-ws-101') {
  return render(
    <MemoryRouter initialEntries={[`/matches/${sessionId}`]}>
      <Routes>
        <Route path="/matches/:id" element={<ActiveMatch />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ActiveMatchControlCenter Integration Suite', () => {
  let playBufferStartWhistleSpy: any;
  let playBufferEndWhistleSpy: any;
  let playMatchEndWhistleSpy: any;
  let triggerHapticSpy: any;

  beforeEach(() => {
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    (window as any).AudioContext = MockAudioContext;

    playBufferStartWhistleSpy = vi.spyOn(refereeAudio, 'playBufferStartWhistle');
    playBufferEndWhistleSpy = vi.spyOn(refereeAudio, 'playBufferEndWhistle');
    playMatchEndWhistleSpy = vi.spyOn(refereeAudio, 'playMatchEndWhistle');
    triggerHapticSpy = vi.spyOn(refereeSensors, 'triggerHaptic');

    mockProfile = adminProfile;
    currentMockData = {
      session: { ...winnerStaysSession },
      teams: [...baseTeams],
      teamPlayers: { ...baseTeamPlayers },
      events: [],
      pollVotes: [],
      loading: false,
      isOffline: false,
      isSyncing: false,
      overlayEvent: null,
      recordGoal: vi.fn().mockResolvedValue(undefined),
      recordSwapTeam: vi.fn().mockResolvedValue(undefined),
      recordTimeUp: vi.fn().mockResolvedValue(undefined),
      undoEvent: vi.fn().mockResolvedValue(undefined),
      saveQueueOrder: vi.fn().mockResolvedValue(undefined),
      castPollVote: vi.fn().mockResolvedValue(undefined),
      submitBulkStats: vi.fn().mockResolvedValue(undefined),
      saveMatchDetails: vi.fn().mockResolvedValue(undefined),
      deleteMatch: vi.fn().mockResolvedValue(undefined),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    setMockDataState?.(currentMockData);
  });

  afterEach(() => {
    setMockDataState = null;
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    delete (window as any).AudioContext;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Single-Screen Mobile Layout Assembly
  // =========================================================================
  describe('1. Single-Screen Mobile Layout Assembly', () => {
    it('renders compact MatchHeader, slim clock and the side-by-side board in a Winner Stays in-progress match', () => {
      renderActiveMatch();

      // Compact Header present with back link, branding actions, and status
      const backLink = screen.getByRole('link', { name: /Back to Matches/i });
      expect(backLink).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Edit Match/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Match/i })).toBeInTheDocument();

      // The separate score box is replaced by scores inside the board
      expect(screen.queryByText('VS')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Team Green score/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Team Blue score/i)).toBeInTheDocument();

      // Winner Stays Clock present with countdown display and control action
      const timerDisplay = screen.getByTestId('timer-display');
      expect(timerDisplay).toBeInTheDocument();
      expect(timerDisplay).toHaveTextContent('10:00');
      expect(screen.getByTestId('start-timer-btn')).toBeInTheDocument();

      // Both teams visible at once, no tabs
      expect(screen.queryByRole('tablist', { name: /Team Switcher/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('player-card-p1')).toBeInTheDocument();
      expect(screen.getByTestId('player-card-p5')).toBeInTheDocument();
    });

    it('positions control center elements in primary screen area above the below-the-fold divider', () => {
      const { container } = renderActiveMatch();

      const belowFoldDivider = container.querySelector('.border-t.border-white\\/5.grid');
      expect(belowFoldDivider).toBeInTheDocument();

      const timerSection = screen.getByTestId('winner-stays-clock');
      const board = screen.getByTestId('live-column-A');
      expect(timerSection).toBeInTheDocument();

      expect(belowFoldDivider?.compareDocumentPosition(board)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
      expect(belowFoldDivider?.compareDocumentPosition(timerSection)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    });

    it('shows the waiting teams in a Next up row under the board', () => {
      renderActiveMatch();
      const nextUp = screen.getByTestId('next-up');
      expect(nextUp).toHaveTextContent(/Next up/i);
      expect(nextUp).toHaveTextContent('Team Orange');
    });
  });

  // =========================================================================
  // 2. Side-by-side board
  // =========================================================================
  describe('2. Side-by-side board', () => {
    it('shows both teams at once with green and blue identities', () => {
      renderActiveMatch();

      const colA = screen.getByTestId('live-column-A');
      const colB = screen.getByTestId('live-column-B');
      expect(colA).toHaveTextContent(/Team Green/i);
      expect(colB).toHaveTextContent(/Team Blue/i);
      expect(colA.querySelector('h4')?.className).toContain('text-primary-400');
      expect(colB.querySelector('h4')?.className).toContain('text-blue-400');

      ['p1', 'p2'].forEach((id) => expect(within(colA).getByTestId(`player-card-${id}`)).toBeInTheDocument());
      ['p5', 'p6', 'p7', 'p8', 'p9'].forEach((id) =>
        expect(within(colB).getByTestId(`player-card-${id}`)).toBeInTheDocument()
      );
    });

    it('keeps 44px touch targets for 4, 5 and 6 player rosters', () => {
      renderActiveMatch();

      const cardsIn = (side: 'A' | 'B') =>
        screen.getByTestId(`live-column-${side}`).querySelectorAll('button[data-testid^="player-card-"]');

      expect(cardsIn('A')).toHaveLength(4);
      expect(cardsIn('B')).toHaveLength(5);
      [...cardsIn('A'), ...cardsIn('B')].forEach((card) => expect(card.className).toContain('min-h-[44px]'));

      updateMockData({
        teamPlayers: {
          ...baseTeamPlayers,
          'team-a': baseTeamPlayers['team-c'], // Team C has 6 players
        },
      });

      expect(cardsIn('A')).toHaveLength(6);
      cardsIn('A').forEach((card) => expect(card.className).toContain('min-h-[44px]'));
    });

    it('displays match goal count badges accurately on player cards', () => {
      // Mock match events with 2 goals for Alice and 1 goal for Bob
      currentMockData.events = [
        { id: 'ev-1', event_type: 'GOAL', player_id: 'p1', team_id: 'team-a' },
        { id: 'ev-2', event_type: 'GOAL', player_id: 'p1', team_id: 'team-a' },
        { id: 'ev-3', event_type: 'GOAL', player_id: 'p2', team_id: 'team-a' },
      ];

      renderActiveMatch();

      // Alice (p1) has 2G badge
      const aliceBadge = screen.getByTestId('goal-badge-p1');
      expect(aliceBadge).toBeInTheDocument();
      expect(aliceBadge).toHaveTextContent('⚽2');

      // Bob (p2) has 1G badge
      const bobBadge = screen.getByTestId('goal-badge-p2');
      expect(bobBadge).toBeInTheDocument();
      expect(bobBadge).toHaveTextContent('⚽1');

      // Charlie (p3) has 0 goals -> no badge rendered
      expect(screen.queryByTestId('goal-badge-p3')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Existing AssistModal Integration
  // =========================================================================
  describe('3. Existing AssistModal Integration', () => {
    it('opens existing AssistModal with correct player and team context when a player name is tapped', () => {
      renderActiveMatch();

      // Click + GOAL on Alice (p1)
      const aliceCard = screen.getByTestId('player-card-p1');
      fireEvent.click(aliceCard);

      // AssistModal opens
      expect(screen.getByText('Who assisted?')).toBeInTheDocument();
      expect(screen.getByText('Goal by Alice')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No Assist' })).toBeInTheDocument();

      // Teammates listed as assist candidates (Bob, Charlie, David)
      expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Charlie' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'David' })).toBeInTheDocument();

      // Alice herself is not listed as an assister
      const assistModalContainer = screen.getByText('Who assisted?').closest('.bg-neutral-900');
      expect(within(assistModalContainer as HTMLElement).queryByRole('button', { name: 'Alice' })).toBeNull();
    });

    it('records goal with assist attribution when a teammate is selected in AssistModal', async () => {
      renderActiveMatch();

      // Initiate goal for Alice
      fireEvent.click(screen.getByTestId('player-card-p1'));

      // Confirm assist by Bob (p2)
      const bobAssistBtn = screen.getByRole('button', { name: 'Bob' });
      await act(async () => {
        fireEvent.click(bobAssistBtn);
      });

      // recordGoal called with scorer: p1, team: team-a, assist: p2
      expect(currentMockData.recordGoal).toHaveBeenCalledTimes(1);
      expect(currentMockData.recordGoal).toHaveBeenCalledWith('p1', 'team-a', 'p2');

      // Modal closed
      expect(screen.queryByText('Who assisted?')).not.toBeInTheDocument();
    });

    it('records unassisted goal when "No Assist" is clicked in AssistModal', async () => {
      renderActiveMatch();

      // Initiate goal for Bob (p2)
      fireEvent.click(screen.getByTestId('player-card-p2'));

      // Click No Assist
      const noAssistBtn = screen.getByRole('button', { name: 'No Assist' });
      await act(async () => {
        fireEvent.click(noAssistBtn);
      });

      // recordGoal called with scorer: p2, team: team-a, assist: null
      expect(currentMockData.recordGoal).toHaveBeenCalledTimes(1);
      expect(currentMockData.recordGoal).toHaveBeenCalledWith('p2', 'team-a', null);

      // Modal closed
      expect(screen.queryByText('Who assisted?')).not.toBeInTheDocument();
    });

    it('cancels modal and dismisses without recording a goal when "Cancel" is clicked', async () => {
      renderActiveMatch();

      // Initiate goal for Charlie (p3)
      fireEvent.click(screen.getByTestId('player-card-p3'));
      expect(screen.getByText('Who assisted?')).toBeInTheDocument();

      // Click Cancel
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      // Dismissed without mutation
      expect(currentMockData.recordGoal).not.toHaveBeenCalled();
      expect(screen.queryByText('Who assisted?')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Duplicate Submission Protection
  // =========================================================================
  describe('4. Duplicate Submission Protection', () => {
    it('disables player goal buttons during in-flight network requests and prevents duplicate submissions', async () => {
      let resolveGoalNetwork: () => void;
      const inFlightPromise = new Promise<void>((resolve) => {
        resolveGoalNetwork = resolve;
      });

      currentMockData.recordGoal = vi.fn().mockImplementation(() => inFlightPromise);

      renderActiveMatch();

      // Click Alice card to open AssistModal
      fireEvent.click(screen.getByTestId('player-card-p1'));

      // Confirm with No Assist to launch network request
      const noAssistBtn = screen.getByRole('button', { name: 'No Assist' });
      await act(async () => {
        fireEvent.click(noAssistBtn);
      });

      expect(currentMockData.recordGoal).toHaveBeenCalledTimes(1);

      // While request is in-flight:
      // Player cards are disabled and have pointer-events-none styling
      const aliceCard = screen.getByTestId('player-card-p1');
      const bobCard = screen.getByTestId('player-card-p2');

      expect(aliceCard).toBeDisabled();
      expect(bobCard).toBeDisabled();
      expect(aliceCard.className).toContain('cursor-not-allowed');
      expect(aliceCard.className).toContain('opacity-50');

      // Attempting to click another player card while submitting does nothing
      fireEvent.click(bobCard);
      expect(screen.queryByText('Who assisted?')).not.toBeInTheDocument();

      // Now resolve network request
      await act(async () => {
        resolveGoalNetwork();
      });

      // Cards are re-enabled
      expect(aliceCard).not.toBeDisabled();
      expect(bobCard).not.toBeDisabled();
    });

    it('synchronous ref lock blocks concurrent goal confirmation calls', async () => {
      let resolveGoalNetwork: () => void;
      const inFlightPromise = new Promise<void>((resolve) => {
        resolveGoalNetwork = resolve;
      });

      currentMockData.recordGoal = vi.fn().mockImplementation(() => inFlightPromise);

      renderActiveMatch();

      // Initiate goal
      fireEvent.click(screen.getByTestId('player-card-p1'));

      // Trigger first confirm
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'No Assist' }));
      });

      expect(currentMockData.recordGoal).toHaveBeenCalledTimes(1);

      // Attempt secondary click on card while in flight
      fireEvent.click(screen.getByTestId('player-card-p1'));
      expect(currentMockData.recordGoal).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveGoalNetwork();
      });
    });
  });

  // =========================================================================
  // 5. Winner Stays Match Clock Lifecycle
  // =========================================================================
  describe('5. Winner Stays Match Clock Lifecycle', () => {
    it('initiates 60s transition buffer phase upon goal confirmation and plays whistle and haptics', async () => {
      renderActiveMatch();

      // Initially clock is at 10:00 PLAYING
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');

      // Start the clock
      const startBtn = screen.getByTestId('start-timer-btn');
      await act(async () => {
        fireEvent.click(startBtn);
      });

      // Confirm a goal event arrives in the match events stream
      await act(async () => {
        updateMockData({
          events: [
            {
              id: 'goal-event-101',
              event_type: 'GOAL',
              team_id: 'team-a',
              player_id: 'p1',
              timestamp: Date.now(),
            },
          ],
        });
      });

      // Clock transitions to GOAL BUFFER phase (60 seconds countdown)
      const bufferBadge = screen.getByTestId('phase-badge-buffer');
      expect(bufferBadge).toBeInTheDocument();
      expect(bufferBadge).toHaveTextContent(/Goal Buffer/i);

      // Audio whistle & haptic feedback triggered on buffer start
      expect(playBufferStartWhistleSpy).toHaveBeenCalledTimes(1);
      expect(triggerHapticSpy).toHaveBeenCalledWith(refereeSensors.HAPTIC_PATTERNS.bufferStart);
    });

    it('Skip Buffer button immediately transitions clock back to 10m countdown with double whistle cue', async () => {
      renderActiveMatch();

      // Trigger goal to enter buffer
      await act(async () => {
        updateMockData({
          events: [
            {
              id: 'goal-event-102',
              event_type: 'GOAL',
              team_id: 'team-a',
              player_id: 'p1',
              timestamp: Date.now(),
            },
          ],
        });
      });

      // Skip Buffer button is visible during buffer phase
      const skipBtn = screen.getByTestId('skip-buffer-btn');
      expect(skipBtn).toBeInTheDocument();

      // Click Skip Buffer
      await act(async () => {
        fireEvent.click(skipBtn);
      });

      // Clock returns to PLAYING phase with fresh 10:00 countdown
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');

      // Double whistle and buffer-end haptic triggered
      expect(playBufferEndWhistleSpy).toHaveBeenCalledTimes(1);
      expect(triggerHapticSpy).toHaveBeenCalledWith(refereeSensors.HAPTIC_PATTERNS.bufferEnd);
    });

    it('buffer expiration automatically transitions clock back to 10m countdown and triggers cues', async () => {
      vi.useFakeTimers();

      renderActiveMatch();

      // Trigger goal to enter buffer
      await act(async () => {
        updateMockData({
          events: [
            {
              id: 'goal-event-103',
              event_type: 'GOAL',
              team_id: 'team-a',
              player_id: 'p1',
              timestamp: Date.now(),
            },
          ],
        });
      });

      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

      // Advance timers by full 60 seconds buffer duration
      await act(async () => {
        vi.advanceTimersByTime(60_100);
      });

      // Automatically transitions to PLAYING countdown
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(playBufferEndWhistleSpy).toHaveBeenCalledTimes(1);
      expect(triggerHapticSpy).toHaveBeenCalledWith(refereeSensors.HAPTIC_PATTERNS.bufferEnd);

      vi.useRealTimers();
    });

    it('playing countdown expiration reaching 00:00 triggers long match-end whistle and displays expired outcome', async () => {
      vi.useFakeTimers();

      renderActiveMatch();

      // Start the playing clock
      const startBtn = screen.getByTestId('start-timer-btn');
      await act(async () => {
        fireEvent.click(startBtn);
      });

      // Advance timers by full 10 minutes (600,000ms)
      await act(async () => {
        vi.advanceTimersByTime(600_100);
      });

      // Playing phase expired -> long whistle and haptic triggered
      expect(playMatchEndWhistleSpy).toHaveBeenCalledTimes(1);
      expect(triggerHapticSpy).toHaveBeenCalledWith(refereeSensors.HAPTIC_PATTERNS.matchEnd);

      // Match expired badge and record time up banner visible
      expect(screen.getByTestId('phase-badge-expired')).toBeInTheDocument();
      expect(screen.getByTestId('time-up-record-banner')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // 6. Mode Isolation & Regression Protection
  // =========================================================================
  describe('6. Mode Isolation & Regression Protection', () => {
    it('bypasses WinnerStaysClock and WinnerStaysGoalEntry for STANDARD match mode and renders standard pitch board', () => {
      currentMockData.session = {
        id: 'match-std-1',
        mode: 'STANDARD',
        status: 'IN_PROGRESS',
        date: '2026-10-31T10:00:00Z',
        location: 'Pitch A',
      };

      renderActiveMatch('match-std-1');

      // Winner Stays Clock NOT mounted
      expect(screen.queryByTestId('winner-stays-clock')).not.toBeInTheDocument();
      expect(screen.queryByTestId('timer-display')).not.toBeInTheDocument();

      // Winner Stays Goal Entry NOT mounted
      expect(screen.queryByRole('tablist', { name: /Team Switcher/i })).not.toBeInTheDocument();

      // Compact side-by-side live board rendered, with each team's score in its column
      expect(screen.getByTestId('live-column-A')).toHaveTextContent(/Team Green/i);
      expect(screen.getByTestId('live-column-B')).toHaveTextContent(/Team Blue/i);
      expect(screen.getByLabelText(/Team Green score/i)).toBeInTheDocument();
    });

    it('bypasses WinnerStaysClock and WinnerStaysGoalEntry for ROUND_ROBIN mode', () => {
      currentMockData.session = {
        id: 'match-rr-1',
        mode: 'ROUND_ROBIN',
        status: 'IN_PROGRESS',
        date: '2026-10-31T10:00:00Z',
        location: 'Pitch B',
      };

      renderActiveMatch('match-rr-1');

      expect(screen.queryByTestId('winner-stays-clock')).not.toBeInTheDocument();
      expect(screen.queryByRole('tablist', { name: /Team Switcher/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('live-column-A')).toHaveTextContent(/Team Green/i);
    });

    it('shows post-match podium and does not render live control center when Winner Stays match is COMPLETED', () => {
      currentMockData.session = {
        id: 'match-ws-completed',
        mode: 'WINNER_STAYS',
        status: 'COMPLETED',
        date: '2026-10-31T10:00:00Z',
        location: 'Main Pitch',
      };

      renderActiveMatch('match-ws-completed');

      // Post-match podium view rendered in Scoreboard
      expect(screen.getByText(/Match Day Winner/i)).toBeInTheDocument();

      // Live Winner Stays Clock NOT rendered
      expect(screen.queryByTestId('winner-stays-clock')).not.toBeInTheDocument();

      // Live Winner Stays Goal Entry NOT rendered
      expect(screen.queryByRole('tablist', { name: /Team Switcher/i })).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 7. Secondary Controls Below the Fold
  // =========================================================================
  describe('7. Secondary Controls Below the Fold', () => {
    it('renders "Match Operations & Queue" section with Manage Queue, Swap Team, Time Up, End Match Day, and Event Timeline', async () => {
      renderActiveMatch();

      // 1. Heading and Queue section present below the fold
      expect(screen.getByText('Match Operations & Queue')).toBeInTheDocument();

      // 2. Manage Queue button is present (since waiting teams exist and profile is admin)
      const manageQueueBtn = screen.getByRole('button', { name: 'Manage Queue' });
      expect(manageQueueBtn).toBeInTheDocument();

      // Clicking Manage Queue opens QueueManagerModal
      fireEvent.click(manageQueueBtn);
      expect(screen.getByRole('heading', { name: /Manage Match Order/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // 3. Swap Team buttons present for active teams on pitch
      const swapButtons = screen.getAllByRole('button', { name: 'Swap Out' });
      expect(swapButtons.length).toBeGreaterThanOrEqual(2);

      // Clicking swap out for Team A calls recordSwapTeam('team-a')
      await act(async () => {
        fireEvent.click(swapButtons[0]);
      });
      expect(currentMockData.recordSwapTeam).toHaveBeenCalledWith('team-a');

      // 4. Time Up ("No Goal / Time Up") button under the board, confirmed before rotating
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const timeUpBtn = screen.getByRole('button', { name: /No Goal \/ Time Up/i });
      expect(timeUpBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(timeUpBtn);
      });
      expect(currentMockData.recordTimeUp).toHaveBeenCalledTimes(1);

      // 5. End Match Day button present
      const endMatchDayBtn = screen.getByRole('button', { name: 'END MATCH DAY' });
      expect(endMatchDayBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(endMatchDayBtn);
      });
      expect(currentMockData.endSession).toHaveBeenCalledTimes(1);

      // 6. Event Timeline present below the fold
      expect(screen.getByText('Match Events')).toBeInTheDocument();
    });

    it('hides admin-exclusive secondary controls when current user is spectator', () => {
      mockProfile = spectatorProfile;

      renderActiveMatch();

      // Spectator cannot see admin secondary controls
      expect(screen.queryByRole('button', { name: 'Manage Queue' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Swap Out' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /No Goal \/ Time Up/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'END MATCH DAY' })).not.toBeInTheDocument();

      // But event timeline remains viewable
      expect(screen.getByText('Match Events')).toBeInTheDocument();
    });
  });
});
