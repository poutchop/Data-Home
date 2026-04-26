-- ══ Carbon Clarity Data Vault — RLS Security Policies ══
-- Run this script in the Supabase SQL Editor to enforce backend security.

-- Enable Row Level Security on both tables
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- 1. Policies for 'scans' table
-- Allow anyone to READ (SELECT) scans for the dashboard feed
CREATE POLICY "Allow public read access to scans" 
  ON scans FOR SELECT 
  TO public 
  USING (true);

-- Explicitly block public INSERT, UPDATE, and DELETE
-- No policies are created for INSERT/UPDATE/DELETE to public/anon,
-- so by default they are DENIED.

-- Allow the Edge Function (which uses service_role) to INSERT and UPDATE
CREATE POLICY "Allow service_role full access to scans" 
  ON scans 
  TO service_role 
  USING (true)
  WITH CHECK (true);


-- 2. Policies for 'participants' table
-- Allow anyone to READ participants for the leaderboard and dashboard
CREATE POLICY "Allow public read access to participants" 
  ON participants FOR SELECT 
  TO public 
  USING (true);

-- Allow service_role to UPDATE participants (e.g., adding points / payouts)
CREATE POLICY "Allow service_role full access to participants" 
  ON participants 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- Verify policy setup is correct. You can test this by trying to 
-- insert a row directly from the front-end console using the anon key. 
-- It should now throw a 401 Unauthorized or 403 Forbidden error.
