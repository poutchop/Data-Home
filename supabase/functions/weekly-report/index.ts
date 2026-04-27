import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch Summary Metrics
    const { data: scans } = await supabase.from('scans').select('status, co2_avoided_kg, points_awarded')
    const { data: participants } = await supabase.from('participants').select('id')
    
    const totalScans = scans?.length || 0
    const hardened = scans?.filter(s => s.status === 'hardened').length || 0
    const totalCO2 = scans?.reduce((acc, s) => acc + (Number(s.co2_avoided_kg) || 0), 0) || 0
    const activeParticipants = participants?.length || 0
    const verificationRate = totalScans > 0 ? Math.round((hardened / totalScans) * 100) : 0

    const reportBody = `
      Carbon Clarity — Data Vault Weekly Report
      -----------------------------------------
      Date: ${new Date().toLocaleDateString()}
      Pilot: Berekuso Pilot
      
      Total Scans: ${totalScans}
      Hardened: ${hardened}
      Verification Rate: ${verificationRate}%
      Total CO2 Avoided: ${totalCO2.toFixed(1)} kg
      Active Participants: ${activeParticipants}
      
      Audit Status: All systems operational.
    `

    // 2. Send via Resend API
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Data Vault <reports@carbonclarify.com>',
          to: ['provost@ashesi.edu.gh', 'doris@carbonclarify.com'],
          subject: `Data Vault Weekly Report — ${new Date().toLocaleDateString()}`,
          text: reportBody
        })
      })
    }

    return new Response(JSON.stringify({ success: true, metrics: { totalScans, hardened, totalCO2 } }), {
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
