import { useMemo, useState, useEffect, useRef } from 'react';

export interface MatchEngineResult {
  onPitch: any[];
  waiting: any[];
  teamScores: Record<string, number>;
  timeOnPitch: Record<string, number>;
  goalsConceded: Record<string, number>;
  goalAnim: { teamId: string; id: number } | null;
}

export function useMatchEngine(events: any[], session: any, teams: any[]): MatchEngineResult {
  const [goalAnim, setGoalAnim] = useState<{ teamId: string; id: number } | null>(null);
  const prevScoresRef = useRef<Record<string, number>>({});

  const engineState = useMemo(() => {
    if (!teams || teams.length < 2) {
      return {
        onPitch: [],
        waiting: [],
        teamScores: {},
        timeOnPitch: {},
        goalsConceded: {}
      };
    }

    let currentPitch = [teams[0], teams[1]].filter(Boolean);
    let currentWaiting = teams.slice(2);
    const scores: Record<string, number> = {};
    const timeOnPitchLocal: Record<string, number> = {};
    const goalsConcededLocal: Record<string, number> = {};

    teams.forEach(t => {
      scores[t.id] = 0;
      timeOnPitchLocal[t.id] = 0;
      goalsConcededLocal[t.id] = 0;
    });
    currentPitch.forEach(t => {
      timeOnPitchLocal[t.id] = 1;
    });

    const sortedEvents = [...events].reverse();

    sortedEvents.forEach(ev => {
      if (ev.event_type === 'SET_PITCH_STATE' && ev.metadata) {
        const { onPitch: pitchIds, waiting: waitingIds } = ev.metadata;
        currentPitch = pitchIds.map((pid: string) => teams.find(t => t.id === pid)).filter(Boolean);
        currentWaiting = waitingIds.map((wid: string) => teams.find(t => t.id === wid)).filter(Boolean);
        currentPitch.forEach(t => {
          timeOnPitchLocal[t.id] = (timeOnPitchLocal[t.id] || 0) + 1;
        });
      } else if (ev.event_type === 'GOAL') {
        scores[ev.team_id] = (scores[ev.team_id] || 0) + 1;

        const concedingTeam = currentPitch.find(t => t.id !== ev.team_id) || currentPitch[1];
        if (concedingTeam) {
          goalsConcededLocal[concedingTeam.id] = (goalsConcededLocal[concedingTeam.id] || 0) + 1;
        }

        if (session?.mode === 'WINNER_STAYS' && currentWaiting.length > 0) {
          const winner = currentPitch.find(t => t.id === ev.team_id) || currentPitch[0];
          const loser = concedingTeam;

          currentPitch = [winner, currentWaiting[0]];
          currentWaiting = [...currentWaiting.slice(1), loser];

          timeOnPitchLocal[winner.id] = (timeOnPitchLocal[winner.id] || 0) + 1;
          if (currentPitch[1]) {
            timeOnPitchLocal[currentPitch[1].id] = (timeOnPitchLocal[currentPitch[1].id] || 0) + 1;
          }
        }
      } else if (ev.event_type === 'NO_GOAL_TIME_UP') {
        if (session?.mode === 'WINNER_STAYS' && currentWaiting.length > 0) {
          if (currentWaiting.length >= 2) {
            const team1 = currentPitch[0];
            const team2 = currentPitch[1];
            const nextTeam1 = currentWaiting[0];
            const nextTeam2 = currentWaiting[1];

            currentPitch = [nextTeam1, nextTeam2];
            currentWaiting = [...currentWaiting.slice(2), team1, team2];

            if (currentPitch[0]) timeOnPitchLocal[currentPitch[0].id] = (timeOnPitchLocal[currentPitch[0].id] || 0) + 1;
            if (currentPitch[1]) timeOnPitchLocal[currentPitch[1].id] = (timeOnPitchLocal[currentPitch[1].id] || 0) + 1;
          } else {
            const winner = currentPitch[0];
            const loser = currentPitch[1];

            currentPitch = [winner, currentWaiting[0]];
            currentWaiting = [...currentWaiting.slice(1), loser];

            timeOnPitchLocal[winner.id] = (timeOnPitchLocal[winner.id] || 0) + 1;
            if (currentPitch[1]) {
              timeOnPitchLocal[currentPitch[1].id] = (timeOnPitchLocal[currentPitch[1].id] || 0) + 1;
            }
          }
        }
      } else if (ev.event_type === 'UNDO') {
        if (currentWaiting.length > 0) {
          const teamOutId = ev.team_id;
          const teamOutIndex = currentPitch.findIndex(t => t.id === teamOutId);
          if (teamOutIndex !== -1) {
            const teamOut = currentPitch[teamOutIndex];
            const teamIn = currentWaiting[0];
            currentPitch[teamOutIndex] = teamIn;

            currentWaiting = [...currentWaiting.slice(1), teamOut];

            timeOnPitchLocal[teamIn.id] = (timeOnPitchLocal[teamIn.id] || 0) + 1;
          }
        }
      }
    });

    return {
      onPitch: currentPitch,
      waiting: currentWaiting,
      teamScores: scores,
      timeOnPitch: timeOnPitchLocal,
      goalsConceded: goalsConcededLocal
    };
  }, [events, session?.mode, teams]);

  useEffect(() => {
    const scores = engineState.teamScores;
    const prev = prevScoresRef.current;
    if (Object.keys(prev).length > 0) {
      let newGoalTeam: string | null = null;
      Object.entries(scores).forEach(([tId, score]) => {
        if (prev[tId] !== undefined && score > prev[tId]) {
          newGoalTeam = tId;
        }
      });
      if (newGoalTeam) {
        setGoalAnim({ teamId: newGoalTeam, id: Date.now() });
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    }
    prevScoresRef.current = scores;
  }, [engineState.teamScores]);

  return {
    ...engineState,
    goalAnim
  };
}
