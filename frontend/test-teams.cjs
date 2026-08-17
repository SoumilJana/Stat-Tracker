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
    .select('id, teams(id, name)')
    .eq('id', '173b599b-2404-4ac3-9a28-5d6aa93e4b23')
    .single();
  console.log("Session:", JSON.stringify(data, null, 2));
}
test();
