-- ══ SECURITY HARDENING — Run this in Supabase SQL Editor ══
-- Makes the scans table an immutable append-only audit log
-- Tightens RLS so anon key can only read, not modify

-- ── Drop old permissive policies ──
DROP POLICY IF EXISTS "Auth insert scans" ON scans;
DROP POLICY IF EXISTS "Auth insert nutrition" ON nutrition_logs;
DROP POLICY IF EXISTS "Public read participants" ON participants;
DROP POLICY IF EXISTS "Public read scans" ON scans;
DROP POLICY IF EXISTS "Public read nutrition" ON nutrition_logs;

-- ── SCANS: Append-only audit log ──
-- Anyone can read scans
CREATE POLICY "anon_read_scans" ON scans
  FOR SELECT USING (true);

-- Only authenticated users can INSERT (no update, no delete ever)
CREATE POLICY "auth_insert_scans" ON scans
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- No UPDATE policy = nobody can modify scan records
-- No DELETE policy = nobody can delete scan records
-- This makes the audit log immutable

-- ── PARTICIPANTS: Read-only for anon, admin writes via service_role ──
CREATE POLICY "anon_read_participants" ON participants
  FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE for anon = participants managed only via service_role (admin backend)

-- ── NUTRITION LOGS: Same append-only pattern ──
CREATE POLICY "anon_read_nutrition" ON nutrition_logs
  FOR SELECT USING (true);

CREATE POLICY "auth_insert_nutrition" ON nutrition_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── Prevent row deletion at database level with a trigger ──
CREATE OR REPLACE FUNCTION prevent_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DELETE operations are not permitted on this table. Data is immutable.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Block deletes on scans (immutable audit log)
DROP TRIGGER IF EXISTS no_delete_scans ON scans;
CREATE TRIGGER no_delete_scans
  BEFORE DELETE ON scans
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

-- Block deletes on nutrition_logs
DROP TRIGGER IF EXISTS no_delete_nutrition ON nutrition_logs;
CREATE TRIGGER no_delete_nutrition
  BEFORE DELETE ON nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

-- ── Prevent updates on critical scan fields ──
CREATE OR REPLACE FUNCTION prevent_scan_tamper()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.qr_valid IS DISTINCT FROM NEW.qr_valid
     OR OLD.gps_lat IS DISTINCT FROM NEW.gps_lat
     OR OLD.points_awarded IS DISTINCT FROM NEW.points_awarded THEN
    RAISE EXCEPTION 'Scan verification fields are immutable once written.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS immutable_scan_fields ON scans;
CREATE TRIGGER immutable_scan_fields
  BEFORE UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION prevent_scan_tamper();
