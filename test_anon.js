const URL = 'https://hbvrfuypyzkvpuobjynw.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnJmdXlweXprdnB1b2JqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTM1NzYsImV4cCI6MjA5MjcyOTU3Nn0.UR_mcEFMc31YP443zeCfCOVYjV6groSoofDbZbco7fw';

async function test() {
  const pRes = await fetch(`${URL}/rest/v1/participants?select=payout_balance`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  console.log('Participants:', await pRes.text());

  const sRes = await fetch(`${URL}/rest/v1/scans?select=co2_avoided_kg&status=eq.hardened`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  console.log('Scans CO2:', await sRes.text());
  
  const topRes = await fetch(`${URL}/rest/v1/participants?select=*&order=total_points.desc&limit=1`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  console.log('Top Participant:', await topRes.text());
}
test();
