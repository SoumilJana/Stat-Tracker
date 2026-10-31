import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchHeader } from '../components/MatchHeader';
import { Scoreboard } from '../components/Scoreboard';

describe('Milestone 1 Adversarial Challenge & Stress Tests', () => {
  const baseSession = {
    id: 'match-1',
    mode: 'WINNER_STAYS',
    status: 'IN_PROGRESS',
    date: '2026-10-31T10:00:00Z',
    location: 'Pitch 1'
  };

  const adminProfile = { id: 'admin-1', username: 'SuperAdmin', role: 'admin' };
  const userProfile = { id: 'user-1', username: 'NormalUser', role: 'user' };

  const teamA = { id: 't1', name: 'Team Green' };
  const teamB = { id: 't2', name: 'Team Blue' };
  const teamScores = { t1: 3, t2: 2 };

  const defaultHeaderProps = {
    session: baseSession,
    profile: adminProfile,
    teamScores,
    onPitch: [teamA, teamB],
    waiting: [{ id: 't3', name: 'Team Red' }],
    teamPlayers: {
      t1: [{ id: 'p1', username: 'Alice' }],
      t2: [{ id: 'p2', username: 'Bob' }],
      t3: [{ id: 'p3', username: 'Charlie' }]
    },
    events: [],
    pollVotes: [],
    bibColors: {},
    isOffline: false,
    isSyncing: false,
    onOpenEdit: vi.fn(),
    onDeleteMatch: vi.fn(),
    onOpenBulk: vi.fn()
  };

  const defaultScoreboardProps = {
    session: baseSession,
    teamA,
    teamB,
    teamScores,
    goalAnim: null,
    pollVotes: [],
    teamPlayers: {
      t1: [{ id: 'p1', username: 'Alice' }],
      t2: [{ id: 'p2', username: 'Bob' }]
    },
    profile: adminProfile,
    onOpenVoting: vi.fn(),
    onPitch: [teamA, teamB],
    waiting: [{ id: 't3', name: 'Team Red' }]
  };

  // =========================================================================
  // FOCUS 1: Corner Cases & Edge Cases
  // =========================================================================

  describe('Focus 1: Waiting Queue Edge Cases in Scoreboard', () => {
    it('disappears gracefully when waiting is empty array', () => {
      render(<Scoreboard {...defaultScoreboardProps} waiting={[]} />);
      expect(screen.queryByText(/Next:/i)).toBeNull();
    });

    it('disappears gracefully without crashing when waiting is undefined', () => {
      render(<Scoreboard {...defaultScoreboardProps} waiting={undefined as any} />);
      expect(screen.queryByText(/Next:/i)).toBeNull();
      expect(screen.getByText('Team Green')).toBeInTheDocument();
      expect(screen.getByText('Team Blue')).toBeInTheDocument();
    });

    it('renders single waiting team correctly', () => {
      render(<Scoreboard {...defaultScoreboardProps} waiting={[{ id: 't3', name: 'Team Red' }]} />);
      expect(screen.getByText('Next: Team Red')).toBeInTheDocument();
    });

    it('renders multiple waiting teams comma-separated with whitespace-nowrap badge', () => {
      const multipleWaiting = [
        { id: 't3', name: 'Team Red' },
        { id: 't4', name: 'Team Yellow' },
        { id: 't5', name: 'Team Purple' }
      ];
      render(<Scoreboard {...defaultScoreboardProps} waiting={multipleWaiting} />);
      const nextBadge = screen.getByText('Next: Team Red, Team Yellow, Team Purple');
      expect(nextBadge).toBeInTheDocument();
      expect(nextBadge.className).toContain('whitespace-nowrap');
      expect(nextBadge.className).toContain('text-[10px]');
      expect(nextBadge.className).toContain('text-amber-400');
    });
  });

  describe('Focus 1: Long Team Names in Scoreboard & Header', () => {
    it('truncates very long team names in Scoreboard without breaking container structure', () => {
      const longTeamA = { id: 't1', name: 'FC Dynamo Super Mega Long Name Athletic 2026' };
      const longTeamB = { id: 't2', name: 'Club Atletico Intercontinental Champions United' };

      render(
        <Scoreboard {...defaultScoreboardProps} teamA={longTeamA} teamB={longTeamB} />
      );

      const teamAHeader = screen.getByText(longTeamA.name);
      const teamBHeader = screen.getByText(longTeamB.name);

      expect(teamAHeader).toBeInTheDocument();
      expect(teamBHeader).toBeInTheDocument();
      expect(teamAHeader.className).toContain('truncate');
      expect(teamAHeader.className).toContain('max-w-full');
      expect(teamBHeader.className).toContain('truncate');
      expect(teamBHeader.className).toContain('max-w-full');
    });

    it('handles long team names in MatchHeader tally pill with horizontal scroll and truncation', () => {
      const longTeamA = { id: 't1', name: 'Team ExtraordinaryLongNameForTeamA' };
      const longTeamB = { id: 't2', name: 'Team IncredibleDefendersUnited' };

      const { container } = render(
        <MemoryRouter>
          <MatchHeader
            {...defaultHeaderProps}
            onPitch={[longTeamA, longTeamB]}
            teamScores={{ t1: 5, t2: 4 }}
          />
        </MemoryRouter>
      );

      const tallyContainer = container.querySelector('.overflow-x-auto');
      expect(tallyContainer).not.toBeNull();
      expect(screen.getByText('ExtraordinaryLongNameForTeamA')).toBeInTheDocument();
      expect(screen.getByText('IncredibleDefendersUnited')).toBeInTheDocument();
    });
  });

  describe('Focus 1: High Double-Digit Scores', () => {
    it('renders double-digit scores (e.g. 14 vs 10) with tabular-nums and drop-shadow', () => {
      render(
        <Scoreboard
          {...defaultScoreboardProps}
          teamScores={{ t1: 14, t2: 10 }}
        />
      );

      const scoreA = screen.getByText('14');
      const scoreB = screen.getByText('10');

      expect(scoreA).toBeInTheDocument();
      expect(scoreB).toBeInTheDocument();
      expect(scoreA.className).toContain('tabular-nums');
      expect(scoreA.className).toContain('tracking-tighter');
      expect(scoreB.className).toContain('tabular-nums');
      expect(scoreB.className).toContain('tracking-tighter');
    });
  });

  // =========================================================================
  // FOCUS 2: Floating Goal Animation
  // =========================================================================

  describe('Focus 2: Floating Goal Animation (+1)', () => {
    it('does not render floating +1 when goalAnim is null', () => {
      render(<Scoreboard {...defaultScoreboardProps} goalAnim={null} />);
      expect(screen.queryByText('+1')).toBeNull();
    });

    it('renders floating +1 with animate-float-up and pointer-events-none for Team A', () => {
      render(
        <Scoreboard
          {...defaultScoreboardProps}
          goalAnim={{ teamId: 't1', id: 42 }}
        />
      );

      const floatBadge = screen.getByText('+1');
      expect(floatBadge).toBeInTheDocument();
      expect(floatBadge.className).toContain('animate-float-up');
      expect(floatBadge.className).toContain('pointer-events-none');
      expect(floatBadge.className).toContain('absolute');
      expect(floatBadge.className).toContain('text-primary-400');
    });

    it('renders floating +1 with blue styling for Team B', () => {
      render(
        <Scoreboard
          {...defaultScoreboardProps}
          goalAnim={{ teamId: 't2', id: 43 }}
        />
      );

      const floatBadge = screen.getByText('+1');
      expect(floatBadge).toBeInTheDocument();
      expect(floatBadge.className).toContain('animate-float-up');
      expect(floatBadge.className).toContain('pointer-events-none');
      expect(floatBadge.className).toContain('absolute');
      expect(floatBadge.className).toContain('text-blue-400');
    });
  });

  // =========================================================================
  // FOCUS 3: Non-Admin vs Admin Permissions
  // =========================================================================

  describe('Focus 3: Permissions Gating in MatchHeader', () => {
    it('renders Edit, Delete, Bulk buttons when profile is admin', () => {
      render(
        <MemoryRouter>
          <MatchHeader {...defaultHeaderProps} profile={adminProfile} />
        </MemoryRouter>
      );

      expect(screen.getByTitle('Edit Match')).toBeInTheDocument();
      expect(screen.getByTitle('Delete Match')).toBeInTheDocument();
      expect(screen.getByTitle('Bulk Import Stats')).toBeInTheDocument();

      // Shared controls
      expect(screen.getByTitle('Copy Teams')).toBeInTheDocument();
      expect(screen.getByTitle('Share Match Link')).toBeInTheDocument();
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      expect(screen.getByTitle('Back to Matches')).toBeInTheDocument();
    });

    it('hides Edit, Delete, Bulk buttons when profile is non-admin user', () => {
      render(
        <MemoryRouter>
          <MatchHeader {...defaultHeaderProps} profile={userProfile} />
        </MemoryRouter>
      );

      expect(screen.queryByTitle('Edit Match')).toBeNull();
      expect(screen.queryByTitle('Delete Match')).toBeNull();
      expect(screen.queryByTitle('Bulk Import Stats')).toBeNull();

      // Shared controls MUST remain visible
      expect(screen.getByTitle('Copy Teams')).toBeInTheDocument();
      expect(screen.getByTitle('Share Match Link')).toBeInTheDocument();
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      expect(screen.getByTitle('Back to Matches')).toBeInTheDocument();
    });

    it('hides Edit, Delete, Bulk buttons when profile is null (spectator)', () => {
      render(
        <MemoryRouter>
          <MatchHeader {...defaultHeaderProps} profile={null} />
        </MemoryRouter>
      );

      expect(screen.queryByTitle('Edit Match')).toBeNull();
      expect(screen.queryByTitle('Delete Match')).toBeNull();
      expect(screen.queryByTitle('Bulk Import Stats')).toBeNull();

      expect(screen.getByTitle('Copy Teams')).toBeInTheDocument();
      expect(screen.getByTitle('Share Match Link')).toBeInTheDocument();
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Offline & Syncing Alert Compactness
  // =========================================================================

  describe('Offline & Syncing Status Banners in MatchHeader', () => {
    it('renders compact offline banner when isOffline is true', () => {
      render(
        <MemoryRouter>
          <MatchHeader {...defaultHeaderProps} isOffline={true} />
        </MemoryRouter>
      );
      expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument();
    });

    it('renders compact syncing banner when isSyncing is true', () => {
      render(
        <MemoryRouter>
          <MatchHeader {...defaultHeaderProps} isSyncing={true} />
        </MemoryRouter>
      );
      expect(screen.getByText(/Syncing offline goals/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Completed Match Podium View
  // =========================================================================

  describe('Completed Match View in Scoreboard', () => {
    it('renders winners podium when match is COMPLETED', () => {
      const completedSession = { ...baseSession, status: 'COMPLETED' };
      render(
        <Scoreboard
          {...defaultScoreboardProps}
          session={completedSession}
          teamScores={{ t1: 6, t2: 3 }}
        />
      );

      expect(screen.getByText('Match Day Winner')).toBeInTheDocument();
      expect(screen.getByText('Team Green')).toBeInTheDocument();
      expect(screen.getByText('6 Wins')).toBeInTheDocument();
    });
  });
});
