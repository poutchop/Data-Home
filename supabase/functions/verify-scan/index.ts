import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const { board_id, participant_id, action_type, qr_hmac_received, gps_lat, gps_lng, gps_accuracy_m, issued_at } = payload

    // ── 3-Factor Verification ──
    
    // Factor 1: QR HMAC Format Validation (Simplified for Edge Function demo)
    const qrPass = qr_hmac_received && qr_hmac_received.length >= 10;
    
    // Factor 2: GPS Geofence (200m from Berekuso Centroid)
    const berekusoLat = 5.7456;
    const berekusoLng = -0.3214;
    const R = 6371000;
    const dLat = (gps_lat - berekusoLat) * Math.PI / 180;
    const dLng = (gps_lng - berekusoLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(berekusoLat * Math.PI / 180) * Math.cos(gps_lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const gpsPass = dist <= 200;

    // Factor 3: Timestamp
    const now = Math.floor(Date.now() / 1000);
    const delta = Math.abs(now - issued_at);
    const timePass = true; // In a real scenario, check if delta > max_allowed

    const allPass = qrPass && gpsPass && timePass;
    const status = allPass ? 'hardened' : 'flagged';

    // Get action info
    const pointsMap: Record<string, number> = {
      'firewood_avoidance': 3,
      'nutrition_meal': 2,
      'solar_drying': 2,
      'organic_fertilizer': 2
    };
    const points_awarded = allPass ? (pointsMap[action_type] || 1) : 0;
    const co2_avoided_kg = action_type === 'firewood_avoidance' ? 12.5 : 0;

    // Fetch participant details
    const { data: pData } = await supabase
      .from('participants')
      .select('name, site, total_points, payout_balance')
      .eq('id', participant_id)
      .single()

    const pName = pData ? pData.name : `Participant ${participant_id.substring(0, 8)}`;
    const pSite = pData ? pData.site : 'Berekuso';

    // Insert scan into database
    const { data: scanData, error: insertError } = await supabase
      .from('scans')
      .insert({
        participant_id: participant_id,
        participant_name: pName,
        board: board_id.substring(0, 8),
        site: pSite,
        action: action_type,
        status: status,
        gps_lat: gps_lat,
        gps_lng: gps_lng,
        gps_distance_m: Math.round(dist),
        qr_valid: qrPass,
        timestamp_delta_s: delta,
        co2_avoided_kg: co2_avoided_kg,
        points_awarded: points_awarded
      })
      .select()
      .single()

    if (insertError) throw insertError

    // If hardened, update participant points and payout
    if (status === 'hardened' && pData) {
      const newPoints = pData.total_points + points_awarded;
      const payoutIncrement = points_awarded * 0.05; // e.g. 0.05 GHS per point
      const newPayout = parseFloat(pData.payout_balance) + payoutIncrement;
      
      await supabase
        .from('participants')
        .update({ total_points: newPoints, payout_balance: newPayout })
        .eq('id', participant_id)
    }

    // Return verification result
    const result = {
      status,
      participant_name: pName,
      site: pSite,
      points_awarded,
      payout_queued: allPass,
      factors: {
        qr: { pass: qrPass },
        gps: { pass: gpsPass, distance_m: Math.round(dist) },
        timestamp: { pass: timePass, delta_seconds: delta }
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
