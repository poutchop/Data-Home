const URL = 'https://hbvrfuypyzkvpuobjynw.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhidnJmdXlweXprdnB1b2JqeW53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE1MzU3NiwiZXhwIjoyMDkyNzI5NTc2fQ.xom6Tk5ylUMVRbOGoH_DTmFO7vtaNQCr_903dKRzu5M';

async function seed() {
  try {
    // 1. Fetch participants
    const pRes = await fetch(`${URL}/rest/v1/participants?select=*`, {
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    });
    const participants = await pRes.json();
    if (!participants || participants.length === 0) {
      console.log('No participants found.');
      return;
    }

    console.log(`Found ${participants.length} participants.`);

    // 2. Generate 20 scans
    const actions = ['firewood_avoidance', 'nutrition_meal', 'solar_drying', 'organic_fertilizer'];
    const statuses = ['hardened', 'hardened', 'hardened', 'flagged', 'rejected'];
    const scansToInsert = [];

    for (let i = 0; i < 20; i++) {
      const p = participants[Math.floor(Math.random() * participants.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      let co2 = 0;
      let points = 0;
      if (status === 'hardened') {
        if (action === 'firewood_avoidance') { co2 = (Math.random() * 5 + 10).toFixed(1); points = 3; }
        else if (action === 'nutrition_meal') { points = 2; }
        else if (action === 'solar_drying') { points = 2; }
        else if (action === 'organic_fertilizer') { points = 4; }
      }

      // Generate random date within the last 4 weeks
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 28));

      scansToInsert.push({
        participant_id: p.id,
        participant_name: p.name,
        board: p.board,
        site: p.site,
        action: action,
        status: status,
        gps_lat: 5.7456 + (Math.random() - 0.5) * 0.01,
        gps_lng: -0.3214 + (Math.random() - 0.5) * 0.01,
        gps_distance_m: Math.floor(Math.random() * 300),
        qr_valid: true,
        timestamp_delta_s: Math.floor(Math.random() * 10),
        co2_avoided_kg: co2,
        points_awarded: points,
        created_at: date.toISOString()
      });
    }

    // 3. Insert scans
    const iRes = await fetch(`${URL}/rest/v1/scans`, {
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(scansToInsert)
    });

    if (iRes.ok) {
      console.log('Successfully inserted 20 scan records.');
    } else {
      console.error('Error inserting:', await iRes.text());
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

seed();
