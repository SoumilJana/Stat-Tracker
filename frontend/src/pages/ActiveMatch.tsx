import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveMatchData } from './ActiveMatch/hooks/useActiveMatchData';
import { useMatchEngine } from './ActiveMatch/hooks/useMatchEngine';
import { MatchHeader } from './ActiveMatch/components/MatchHeader';
import { Scoreboard } from './ActiveMatch/components/Scoreboard';
import { PitchBoard } from './ActiveMatch/components/PitchBoard';
import { EventTimeline } from './ActiveMatch/components/EventTimeline';
import { EventOverlay } from './ActiveMatch/components/EventOverlay';
import { AssistModal } from './ActiveMatch/components/AssistModal';
import { VotingModal } from './ActiveMatch/components/VotingModal';
import { QueueManagerModal } from './ActiveMatch/components/QueueManagerModal';
import { BulkImportModal } from './ActiveMatch/components/BulkImportModal';
import { EditMatchModal } from './ActiveMatch/components/EditMatchModal';

export default function ActiveMatch() {
  const { profile } = useAuth();
  const { id } = useParams<{ id: string }>();

  // Network & Persistent Realtime Data Hook
  const {
    session,
    teams,
    teamPlayers,
    events,
    pollVotes,
    loading,
    isOffline,
    isSyncing,
    overlayEvent,
    recordGoal,
    recordSwapTeam,
    recordTimeUp,
    undoEvent,
    saveQueueOrder,
    castPollVote,
    submitBulkStats,
    saveMatchDetails,
    deleteMatch,
    endSession
  } = useActiveMatchData(id, profile);

  // Deterministic Match Rotation & Scoring Engine Hook
  const { onPitch, waiting, teamScores, timeOnPitch, goalsConceded, goalAnim } = useMatchEngine(
    events,
    session,
    teams
  );

  // UI Modal & Interaction States
  const [pendingGoal, setPendingGoal] = useState<{ playerId: string; teamId: string; teamPlayers: any[] } | null>(null);
  const [bibColors, setBibColors] = useState<Record<string, string>>({});
  const [isEditingMatch, setIsEditingMatch] = useState(false);
  const [votingAward, setVotingAward] = useState<'BEST_DEFENDER' | 'BEST_GK' | 'MOTM' | null>(null);
  const [isManagingQueue, setIsManagingQueue] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Handlers
  const handleInitiateGoal = (playerId: string, teamId: string, playersList: any[]) => {
    setPendingGoal({ playerId, teamId, teamPlayers: playersList });
  };

  const handleConfirmGoal = async (assistedBy: string | null) => {
    if (!pendingGoal) return;
    const { playerId, teamId } = pendingGoal;
    setPendingGoal(null);
    await recordGoal(playerId, teamId, assistedBy);
  };

  const handleEndSession = async () => {
    await endSession(teamScores, timeOnPitch, goalsConceded);
  };

  const handleSaveQueueOrder = async (pitch: any[], wait: any[]) => {
    setIsManagingQueue(false);
    await saveQueueOrder(pitch, wait);
  };

  const handleCastVote = async (awardType: 'BEST_DEFENDER' | 'BEST_GK' | 'MOTM', candidateId: string) => {
    setVotingAward(null);
    await castPollVote(awardType, candidateId);
  };

  if (loading) {
    return (
      <div className="text-primary-500 p-8 flex justify-center">
        <Activity className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!session || onPitch.length < 2) {
    return <div className="text-red-400 p-8 text-center">Match not found or invalid teams.</div>;
  }

  const teamA = onPitch[0];
  const teamB = onPitch[1];

  return (
    <div className="max-w-5xl mx-auto pb-24 md:pb-8">
      {/* Fullscreen Celebration Banner */}
      <EventOverlay overlayEvent={overlayEvent} />

      {/* Navigation, Actions & Matchday Tally Header */}
      <MatchHeader
        session={session}
        profile={profile}
        teamScores={teamScores}
        onPitch={onPitch}
        waiting={waiting}
        teamPlayers={teamPlayers}
        events={events}
        pollVotes={pollVotes}
        bibColors={bibColors}
        isOffline={isOffline}
        isSyncing={isSyncing}
        onOpenEdit={() => setIsEditingMatch(true)}
        onDeleteMatch={deleteMatch}
        onOpenBulk={() => setShowBulkImport(true)}
      />

      {/* Live Active Match Scoreboard or Post-Match Podium */}
      <Scoreboard
        session={session}
        teamA={teamA}
        teamB={teamB}
        teamScores={teamScores}
        goalAnim={goalAnim}
        pollVotes={pollVotes}
        teamPlayers={teamPlayers}
        profile={profile}
        onOpenVoting={setVotingAward}
        onPitch={onPitch}
        waiting={waiting}
      />

      {/* Pitch Roster Action Grid & Chronological Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <PitchBoard
          session={session}
          profile={profile}
          teamA={teamA}
          teamB={teamB}
          teamPlayers={teamPlayers}
          waiting={waiting}
          bibColors={bibColors}
          events={events}
          timeOnPitch={timeOnPitch}
          onPitch={onPitch}
          onInitiateGoal={handleInitiateGoal}
          onSwapTeam={recordSwapTeam}
          onRecordTimeUp={recordTimeUp}
          onEndSession={handleEndSession}
          onBibColorChange={(tId, col) => setBibColors(prev => ({ ...prev, [tId]: col }))}
          onOpenQueueManager={() => setIsManagingQueue(true)}
        />

        <EventTimeline
          events={events}
          session={session}
          profile={profile}
          teamA={teamA}
          teamB={teamB}
          onPitch={onPitch}
          waiting={waiting}
          onUndoEvent={undoEvent}
        />
      </div>

      {/* Goal Assist Selection Modal */}
      <AssistModal
        isOpen={!!pendingGoal}
        pendingGoal={pendingGoal}
        onConfirm={handleConfirmGoal}
        onCancel={() => setPendingGoal(null)}
      />

      {/* Post-Match Awards Voting Modal */}
      <VotingModal
        isOpen={!!votingAward}
        awardType={votingAward}
        players={Object.values(teamPlayers).flat()}
        pollVotes={pollVotes}
        currentProfileId={profile?.id}
        onVote={handleCastVote}
        onClose={() => setVotingAward(null)}
      />

      {/* Match Details Admin Edit Modal */}
      <EditMatchModal
        isOpen={isEditingMatch}
        sessionDate={session?.date}
        sessionLocation={session?.location}
        onSave={saveMatchDetails}
        onClose={() => setIsEditingMatch(false)}
      />

      {/* Rotation Queue Ordering Admin Modal */}
      <QueueManagerModal
        isOpen={isManagingQueue}
        initialPitch={onPitch}
        initialWaiting={waiting}
        onSave={handleSaveQueueOrder}
        onClose={() => setIsManagingQueue(false)}
      />

      {/* Bulk Stats Import Parser Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        teamPlayers={teamPlayers}
        onImport={submitBulkStats}
        onClose={() => setShowBulkImport(false)}
      />
    </div>
  );
}
