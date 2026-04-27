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

    const { id, email } = await req.json()

    if (!id || !email) {
      throw new Error('Missing user ID or email')
    }

    // Create the user in Supabase Auth
    // Use inviteUserByEmail to send them a welcome email so they can set their password
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email)

    if (authError) {
      // If user already exists in Auth, we can just proceed to approve them
      if (authError.message.includes('already exists')) {
         console.log('User already exists in Auth, proceeding to approve.');
      } else {
         throw authError
      }
    }

    // Mark as approved in pending_users table
    const { error: dbError } = await supabase
      .from('pending_users')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', id)

    if (dbError) throw dbError

    return new Response(JSON.stringify({ success: true }), {
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
