const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.resolve(__dirname, '../frontend/.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const VITE_SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const args = process.argv.slice(2);
const typeMap = {
  '1': 'PAST_STATS',
  '2': 'UPCOMING_INFO',
  '3': 'POST_MATCH'
};

const notifType = typeMap[args[0]];
if (!notifType) {
  console.error("Usage: node trigger-notification.js [1|2|3]");
  process.exit(1);
}

const trigger = async () => {
  const url = `${VITE_SUPABASE_URL}/functions/v1/send-push-notification`;
  console.log(`Triggering ${notifType} via ${url}...`);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ notificationType: notifType })
  });
  
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${text}`);
};

trigger();
