import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchHeader } from '../components/MatchHeader';
import { Scoreboard } from '../components/Scoreboard';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

describe('M1 Adversarial Challenge: MatchHeader & Scoreboard', () => {
  const mockOnOpenEdit = vi.fn();
  const onDeleteMatch = vi.fn();
  const onOpenBulk = vi.fn();
  const onOpenVoting = vi.fn();

  const dummySession = {
    id: 'match-123',
    date: '2026-10-31T10:00:00Z',
    status: 'IN_PROGRESS',
    mode: 'WINNER_STAYS',
    location: 'Pitch 1',
  };

  const dummyProfileAdmin = {
    id: 'user-admin',
    role: 'admin',
    username: 'AdminUser',
  };

  const dummyProfileSpectator = {
    id: 'user-spec',
    role: 'spectator',
    username: 'SpectatorUser',
  };

  const dummyTeamA = { id: 'team-a', name: 'Team Alpha' };
  const dummyTeamB = { id: 'team-b', name: 'Team Bravo' };
  const dummyWaiting = [{ id: 'team-c', name: 'Team Charlie' }];

  const dummyTeamScores = {
    'team-a': 3,
    'team-b': 1,
    'team-c': 0,
  };

  const dummyTeamPlayers = {
    'team-a': [
      { id: 'p1', username: 'Alice' },
      { id: 'p2', username: 'Bob' },
    ],
    'team-b': [
      { id: 'p3', username: 'Charlie' },
      { id: 'p4', username: 'Dave' },
    ],
    'team-c': [
      { id: 'p5', username: 'Eve' },
    ],
  };

  const dummyBibColors = {
    'team-a': 'Green',
    'team-b': 'Blue',
  };

  const dummyEvents = [
    { id: 'e1', event_type: 'GOAL', player_id: 'p1', assisted_by: 'p2', team_id: 'team-a', timestamp: 100 },
    { id: 'e2', event_type: 'GOAL', player_id: 'p1', assisted_by: null, team_id: 'team-a', timestamp: 200 },
    { id: 'e3', event_type: 'GOAL', player_id: 'p2', assisted_by: 'p1', team_id: 'team-a', timestamp: 300 },
    { id: 'e4', event_type: 'GOAL', player_id: 'p3', assisted_by: null, team_id: 'team-b', timestamp: 400 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. MATCH HEADER TESTS
  // =========================================================================
  describe('MatchHeader Component', () => {
    it('renders navigation link pointing to /matches', () => {
      render(
        <MemoryRouter>
          <MatchHeader
            session={dummySession}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      const backLink = screen.getByTitle('Back to Matches');
      expect(backLink).toBeInTheDocument();
      expect(backLink.getAttribute('href')).toBe('/matches');
    });

    it('renders admin buttons (Edit, Delete, Bulk) when user is admin and triggers callbacks', () => {
      render(
        <MemoryRouter>
          <MatchHeader
            session={dummySession}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      const editBtn = screen.getByTitle('Edit Match');
      const deleteBtn = screen.getByTitle('Delete Match');
      const bulkBtn = screen.getByTitle('Bulk Import Stats');

      expect(editBtn).toBeInTheDocument();
      expect(deleteBtn).toBeInTheDocument();
      expect(bulkBtn).toBeInTheDocument();

      fireEvent.click(editBtn);
      expect(mockOnOpenEdit).toHaveBeenCalledTimes(1);

      fireEvent.click(deleteBtn);
      expect(onDeleteMatch).toHaveBeenCalledTimes(1);

      fireEvent.click(bulkBtn);
      expect(onOpenBulk).toHaveBeenCalledTimes(1);
    });

    it('hides admin buttons when user is non-admin', () => {
      render(
        <MemoryRouter>
          <MatchHeader
            session={dummySession}
            profile={dummyProfileSpectator}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTitle('Edit Match')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Delete Match')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Bulk Import Stats')).not.toBeInTheDocument();
    });

    it('handles Copy Teams in active match and shows temporary copied state', async () => {
      vi.useFakeTimers();
      render(
        <MemoryRouter>
          <MatchHeader
            session={dummySession}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      const copyBtn = screen.getByTitle('Copy Teams');
      expect(copyBtn).toBeInTheDocument();

      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      const copiedText = (navigator.clipboard.writeText as any).mock.calls[0][0];
      expect(copiedText).toContain('Team Alpha');
      expect(copiedText).toContain('Team Bravo');

      // Check for copied check feedback
      expect(screen.getByText('Copied!')).toBeInTheDocument();

      // After 2000ms timer
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('handles Copy Match Stats in completed match', () => {
      const completedSession = { ...dummySession, status: 'COMPLETED' };
      render(
        <MemoryRouter>
          <MatchHeader
            session={completedSession}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      const copyBtn = screen.getByTitle('Copy Match Stats');
      expect(copyBtn).toBeInTheDocument();

      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      const copiedText = (navigator.clipboard.writeText as any).mock.calls[0][0];
      expect(copiedText).toContain('Match Day Stats');
      expect(copiedText).toContain('Match Day Tally');
    });

    it('handles Share Match Link and displays copied feedback', () => {
      vi.useFakeTimers();
      render(
        <MemoryRouter>
          <MatchHeader
            session={dummySession}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      const shareBtn = screen.getByTitle('Share Match Link');
      expect(shareBtn).toBeInTheDocument();

      fireEvent.click(shareBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);

      // Verify copied feedback
      expect(screen.getByText('Copied!')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('displays offline and syncing banners when active', () => {
      const { rerender } = render(
        <MemoryRouter>
          <MatchHeader
            session={dummySession}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={true}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <MatchHeader
            session={dummySession}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={true}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      expect(screen.getByText(/Syncing offline goals/i)).toBeInTheDocument();
    });

    it('renders status badge with correct styling according to status', () => {
      const { rerender } = render(
        <MemoryRouter>
          <MatchHeader
            session={dummySession} // IN_PROGRESS
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <MatchHeader
            session={{ ...dummySession, status: 'SCHEDULED' }}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. SCOREBOARD TESTS
  // =========================================================================
  describe('Scoreboard Component', () => {
    it('renders in-progress scoreboard with green Team A, blue Team B, tabular scores, and integrated waiting badge', () => {
      render(
        <Scoreboard
          session={dummySession}
          teamA={dummyTeamA}
          teamB={dummyTeamB}
          teamScores={dummyTeamScores}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={dummyTeamPlayers}
          profile={dummyProfileAdmin}
          onOpenVoting={onOpenVoting}
          onPitch={[dummyTeamA, dummyTeamB]}
          waiting={dummyWaiting}
        />
      );

      // Team A
      const teamAElement = screen.getByText('Team Alpha');
      expect(teamAElement).toBeInTheDocument();
      expect(teamAElement.className).toContain('text-primary-400'); // Green identity

      // Team B
      const teamBElement = screen.getByText('Team Bravo');
      expect(teamBElement).toBeInTheDocument();
      expect(teamBElement.className).toContain('text-blue-400'); // Blue identity

      // Scores
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();

      // VS Badge
      expect(screen.getByText('VS')).toBeInTheDocument();

      // Waiting badge integrated under VS
      expect(screen.getByText('Next: Team Charlie')).toBeInTheDocument();
    });

    it('renders floating +1 animation when goalAnim matches teamA or teamB', () => {
      const { rerender } = render(
        <Scoreboard
          session={dummySession}
          teamA={dummyTeamA}
          teamB={dummyTeamB}
          teamScores={dummyTeamScores}
          goalAnim={{ teamId: 'team-a', id: 999 }}
          pollVotes={[]}
          teamPlayers={dummyTeamPlayers}
          profile={dummyProfileAdmin}
          onOpenVoting={onOpenVoting}
          onPitch={[dummyTeamA, dummyTeamB]}
          waiting={dummyWaiting}
        />
      );

      const floatAnimA = screen.getByText('+1');
      expect(floatAnimA).toBeInTheDocument();
      expect(floatAnimA.className).toContain('text-primary-400');

      rerender(
        <Scoreboard
          session={dummySession}
          teamA={dummyTeamA}
          teamB={dummyTeamB}
          teamScores={dummyTeamScores}
          goalAnim={{ teamId: 'team-b', id: 1000 }}
          pollVotes={[]}
          teamPlayers={dummyTeamPlayers}
          profile={dummyProfileAdmin}
          onOpenVoting={onOpenVoting}
          onPitch={[dummyTeamA, dummyTeamB]}
          waiting={dummyWaiting}
        />
      );

      const floatAnimB = screen.getByText('+1');
      expect(floatAnimB).toBeInTheDocument();
      expect(floatAnimB.className).toContain('text-blue-400');
    });

    it('renders post-match podium and awards when status is COMPLETED', () => {
      const completedSession = {
        ...dummySession,
        status: 'COMPLETED',
        date: '2026-10-31T10:00:00Z',
      };

      const pollVotes = [
        { id: 'v1', award_type: 'BEST_DEFENDER', voter_id: 'user-admin', voter: { username: 'AdminUser' }, candidate_id: 'p2' },
        { id: 'v2', award_type: 'BEST_GK', voter_id: 'user-admin', voter: { username: 'AdminUser' }, candidate_id: 'p4' },
        { id: 'v3', award_type: 'MOTM', voter_id: 'user-admin', voter: { username: 'AdminUser' }, candidate_id: 'p1' },
      ];

      render(
        <Scoreboard
          session={completedSession}
          teamA={dummyTeamA}
          teamB={dummyTeamB}
          teamScores={dummyTeamScores}
          goalAnim={null}
          pollVotes={pollVotes}
          teamPlayers={dummyTeamPlayers}
          profile={dummyProfileAdmin}
          onOpenVoting={onOpenVoting}
          onPitch={[dummyTeamA, dummyTeamB]}
          waiting={dummyWaiting}
        />
      );

      // Match Day Winner title
      expect(screen.getByText('Match Day Winner')).toBeInTheDocument();
      expect(screen.getByText('3 Wins')).toBeInTheDocument();

      // Award sections
      expect(screen.getByText(/Best Defender/i)).toBeInTheDocument();
      expect(screen.getByText(/Best Goalkeeper/i)).toBeInTheDocument();
      expect(screen.getByText(/Man of the Match/i)).toBeInTheDocument();

      // Admin vote details
      expect(screen.getAllByText('Admin: Vote Details').length).toBeGreaterThan(0);
    });

    it('handles draw in completed matches cleanly', () => {
      const drawScores = {
        'team-a': 2,
        'team-b': 2,
      };

      render(
        <Scoreboard
          session={{ ...dummySession, status: 'COMPLETED' }}
          teamA={dummyTeamA}
          teamB={dummyTeamB}
          teamScores={drawScores}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={dummyTeamPlayers}
          profile={dummyProfileAdmin}
          onOpenVoting={onOpenVoting}
          onPitch={[dummyTeamA, dummyTeamB]}
          waiting={[]}
        />
      );

      expect(screen.getByText('Match Day Winners (Draw)')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. ADVERSARIAL STRESS TESTS: EXTREME INPUTS & 375PX VIEWPORT
  // =========================================================================
  describe('Adversarial Stress Testing', () => {
    it('does not crash with extreme long team names or special characters', () => {
      const extremeTeamA = { id: 'team-a', name: 'Supercalifragilisticexpialidocious United Football Club of North London & Suburbs' };
      const extremeTeamB = { id: 'team-b', name: '<script>alert("xss")</script> FC & Special "Chars" 1234567890' };
      const extremeWaiting = [
        { id: 'w1', name: 'Team Very Long Name 1' },
        { id: 'w2', name: 'Team Very Long Name 2' },
        { id: 'w3', name: 'Team Very Long Name 3' },
      ];

      render(
        <Scoreboard
          session={dummySession}
          teamA={extremeTeamA}
          teamB={extremeTeamB}
          teamScores={{ 'team-a': 99, 'team-b': 100 }}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={dummyTeamPlayers}
          profile={dummyProfileAdmin}
          onOpenVoting={onOpenVoting}
          onPitch={[extremeTeamA, extremeTeamB]}
          waiting={extremeWaiting}
        />
      );

      expect(screen.getByText(extremeTeamA.name)).toBeInTheDocument();
      expect(screen.getByText(extremeTeamB.name)).toBeInTheDocument();
      expect(screen.getByText(/Next: Team Very Long Name 1, Team Very Long Name 2, Team Very Long Name 3/)).toBeInTheDocument();
    });

    it('does not crash when session has null/undefined fields', () => {
      render(
        <MemoryRouter>
          <MatchHeader
            session={{ id: 'match-empty' }}
            profile={null}
            teamScores={{}}
            onPitch={[]}
            waiting={[]}
            teamPlayers={{}}
            events={[]}
            pollVotes={[]}
            bibColors={{}}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    });

    it('measures CSS classes ensuring Header and Scoreboard fit mobile viewport budgets', () => {
      const { container: headerContainer } = render(
        <MemoryRouter>
          <MatchHeader
            session={dummySession}
            profile={dummyProfileAdmin}
            teamScores={dummyTeamScores}
            onPitch={[dummyTeamA, dummyTeamB]}
            waiting={dummyWaiting}
            teamPlayers={dummyTeamPlayers}
            events={dummyEvents}
            pollVotes={[]}
            bibColors={dummyBibColors}
            isOffline={false}
            isSyncing={false}
            onOpenEdit={mockOnOpenEdit}
            onDeleteMatch={onDeleteMatch}
            onOpenBulk={onOpenBulk}
          />
        </MemoryRouter>
      );

      const headerBar = headerContainer.querySelector('.min-h-\\[40px\\]');
      expect(headerBar).toBeInTheDocument();
      expect(headerBar?.className).toContain('mb-2');
      expect(headerBar?.className).toContain('min-h-[40px]');
      expect(headerBar?.className).toContain('sm:min-h-[48px]');

      const { container: scoreboardContainer } = render(
        <Scoreboard
          session={dummySession}
          teamA={dummyTeamA}
          teamB={dummyTeamB}
          teamScores={dummyTeamScores}
          goalAnim={null}
          pollVotes={[]}
          teamPlayers={dummyTeamPlayers}
          profile={dummyProfileAdmin}
          onOpenVoting={onOpenVoting}
          onPitch={[dummyTeamA, dummyTeamB]}
          waiting={dummyWaiting}
        />
      );

      const scoreboardRoot = scoreboardContainer.firstElementChild;
      expect(scoreboardRoot?.className).toContain('p-2.5');
      expect(scoreboardRoot?.className).toContain('mb-2');
      expect(scoreboardRoot?.className).toContain('rounded-2xl');
    });
  });
});
