import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vftdtydohqfksxalctet.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey);

async function run() {
  console.log("Fetching completed sessions...");
  const { data: sessions, error: sErr } = await supabase.from('sessions').select('*').eq('status', 'COMPLETED');
  if (sErr) throw sErr;
  
  console.log(`Found ${sessions.length} completed sessions`);
  
  for (const session of sessions) {
    const { data: teams } = await supabase.from('teams').select('*').eq('session_id', session.id);
    const { data: events } = await supabase.from('events').select('*').eq('session_id', session.id).order('created_at', { ascending: true });
    
    if (!teams || teams.length === 0) continue;
    
    // Simulate reducer
    let currentPitch = [teams[0], teams[1]].filter(Boolean);
    let currentWaiting = teams.slice(2);
    let scores = {};
    let timeOnPitchLocal = {};
    let goalsConcededLocal = {};
    
    teams.forEach(t => { scores[t.id] = 0; timeOnPitchLocal[t.id] = 0; goalsConcededLocal[t.id] = 0; });
    currentPitch.forEach(t => timeOnPitchLocal[t.id] = 1);
    
    events.forEach(ev => {
      if (ev.event_type === 'SET_PITCH_STATE' && ev.metadata) {
        const { onPitch: pitchIds, waiting: waitingIds } = ev.metadata;
        currentPitch = pitchIds.map(pid => teams.find(t => t.id === pid)).filter(Boolean);
        currentWaiting = waitingIds.map(wid => teams.find(t => t.id === wid)).filter(Boolean);
        currentPitch.forEach(t => timeOnPitchLocal[t.id] += 1);
      } else if (ev.event_type === 'GOAL') {
        scores[ev.team_id] = (scores[ev.team_id] || 0) + 1;
        const concedingTeam = currentPitch.find(t => t.id !== ev.team_id) || currentPitch[1];
        if (concedingTeam) {
          goalsConcededLocal[concedingTeam.id] = (goalsConcededLocal[concedingTeam.id] || 0) + 1;
        }

        if (session.mode === 'WINNER_STAYS' && currentWaiting.length > 0) {
          const winner = currentPitch.find(t => t.id === ev.team_id) || currentPitch[0];
          const loser = concedingTeam;
          
          currentPitch = [winner, currentWaiting[0]];
          currentWaiting = [...currentWaiting.slice(1), loser];
          
          timeOnPitchLocal[winner.id] += 1;
          if (currentPitch[1]) {
            timeOnPitchLocal[currentPitch[1].id] = (timeOnPitchLocal[currentPitch[1].id] || 0) + 1;
          }
        }
      } else if (ev.event_type === 'NO_GOAL_TIME_UP') {
        if (session.mode === 'WINNER_STAYS' && currentWaiting.length > 0) {
          const winner = currentPitch[0];
          const loser = currentPitch[1];
          currentPitch = [winner, currentWaiting[0]];
          currentWaiting = [...currentWaiting.slice(1), loser];
          timeOnPitchLocal[winner.id] += 1;
          if (currentPitch[1]) {
            timeOnPitchLocal[currentPitch[1].id] = (timeOnPitchLocal[currentPitch[1].id] || 0) + 1;
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

    const teamStatsInserts = Object.keys(timeOnPitchLocal).map(tId => ({
      session_id: session.id,
      team_id: tId,
      wins: scores[tId] || 0,
      matches_played: timeOnPitchLocal[tId] || 0,
      goals_conceded: goalsConcededLocal[tId] || 0,
    }));
    
    if (teamStatsInserts.length > 0) {
      console.log(`Inserting ${teamStatsInserts.length} stats for session ${session.id}...`);
      await supabase.from('session_team_stats').upsert(teamStatsInserts, { onConflict: 'session_id,team_id' });
    }
  }
  
  console.log("Done.");
}

run().catch(console.error);
