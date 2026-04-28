const URL = 'https://hbvrfuypyzkvpuobjynw.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnJmdXlweXprdnB1b2JqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTM1NzYsImV4cCI6MjA5MjcyOTU3Nn0.UR_mcEFMc31YP443zeCfCOVYjV6groSoofDbZbco7fw';

async function test() {
  try {
    const res = await fetch(`${URL}/rest/v1/participants?select=count`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    const data = await res.json();
    console.log('Anon key test result:', data);
  } catch (err) {
    console.error('Anon key test error:', err);
  }
}

test();
