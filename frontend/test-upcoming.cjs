const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8');
const URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(URL, KEY);

async function test() {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      date,
      location,
      teams (
        id,
        name,
        team_players (
          player_id,
          profiles:profiles!team_players_player_id_fkey(username)
        )
      )
    `)
    .eq('status', 'SCHEDULED')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
test();
