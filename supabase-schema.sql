-- ══ Carbon Clarity Data Vault — Supabase Schema ══
-- Run this in your Supabase SQL Editor to set up the database

-- ── Boards table ──
CREATE TABLE IF NOT EXISTS boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_number TEXT NOT NULL UNIQUE,
  participant_id UUID REFERENCES participants(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'lost', 'replaced')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Participants table ──
CREATE TABLE IF NOT EXISTS participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  board TEXT NOT NULL,
  site TEXT NOT NULL,
  total_points INTEGER DEFAULT 0,
  payout_balance DECIMAL(10,2) DEFAULT 0,
  momo_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Pending Users table ──
CREATE TABLE IF NOT EXISTS pending_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);


-- ── Scans table ──
CREATE TABLE IF NOT EXISTS scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id),
  participant_name TEXT NOT NULL,
  board TEXT NOT NULL,
  site TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('firewood_avoidance', 'nutrition_meal', 'solar_drying', 'organic_fertilizer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('hardened', 'flagged', 'rejected', 'pending')),
  gps_lat DECIMAL(10,6),
  gps_lng DECIMAL(10,6),
  gps_distance_m INTEGER,
  qr_valid BOOLEAN DEFAULT false,
  timestamp_delta_s INTEGER,
  co2_avoided_kg DECIMAL(8,2) DEFAULT 0,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nutrition logs table ──
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id),
  participant_name TEXT NOT NULL,
  site TEXT NOT NULL,
  meal TEXT NOT NULL,
  protein_g INTEGER,
  kcal INTEGER,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  verified BOOLEAN DEFAULT false,
  log_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes for performance ──
CREATE INDEX idx_scans_created ON scans(created_at DESC);
CREATE INDEX idx_scans_site ON scans(site);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_nutrition_date ON nutrition_logs(log_date DESC);
CREATE INDEX idx_participants_site ON participants(site);

-- ── Row Level Security ──
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

-- Public read access (authenticated users)
CREATE POLICY "Public read participants" ON participants FOR SELECT USING (true);
CREATE POLICY "Public read scans" ON scans FOR SELECT USING (true);
CREATE POLICY "Public read nutrition" ON nutrition_logs FOR SELECT USING (true);

-- Authenticated insert
CREATE POLICY "Auth insert scans" ON scans FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth insert nutrition" ON nutrition_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── Enable Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE scans;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;

-- ── Seed data ──
INSERT INTO participants (name, board, site, total_points, payout_balance) VALUES
  ('Akosua Mensah', '014', 'Farm A', 142, 11.83),
  ('Ama Asante', '003', 'Farm A', 138, 11.50),
  ('Abena Owusu', '007', 'Farm B', 131, 10.92),
  ('Adwoa Boateng', '019', 'Farm B', 119, 9.92),
  ('Akua Nkrumah', '006', 'Farm A', 107, 8.92),
  ('Yaa Frimpong', '011', 'Co-op W', 98, 8.17),
  ('Efua Darko', '021', 'Co-op W', 85, 7.08),
  ('Serwa Adjei', '002', 'Farm A', 78, 6.50),
  ('Araba Quaye', '017', 'Farm B', 72, 6.00);

-- ================================================================
-- Carbon Clarity — 6 Missing Columns for GAC Audit Compliance
-- Run this in Supabase: Dashboard → SQL Editor → New Query → Run
-- ================================================================

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS week_number        INTEGER,
  ADD COLUMN IF NOT EXISTS gps_accuracy_m     DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS photo_s3_key       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sticker_count      INTEGER CHECK (sticker_count BETWEEN 0 AND 21),
  ADD COLUMN IF NOT EXISTS verification_log   JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewed_by        UUID REFERENCES auth.users(id);

-- Add comments so GAC auditors understand each column
COMMENT ON COLUMN scans.week_number      IS 'Pilot week number (1–12). Groups scans for weekly reports.';
COMMENT ON COLUMN scans.gps_accuracy_m   IS 'GPS accuracy radius in metres at time of scan. Must be ≤50m for hardened status.';
COMMENT ON COLUMN scans.photo_s3_key     IS 'Supabase Storage path of the board photo taken at scan time. Physical evidence for GAC.';
COMMENT ON COLUMN scans.sticker_count    IS 'Number of stickers placed on the board this week (0–21). Submitted by Queen Mother before QR scan.';
COMMENT ON COLUMN scans.verification_log IS 'JSON object storing exact pass/fail reasoning for all 3 factors: QR, GPS, and timestamp delta.';
COMMENT ON COLUMN scans.reviewed_by      IS 'UUID of the admin who manually approved a flagged scan. NULL means auto-hardened.';

-- Add the duplicate scan prevention constraint
ALTER TABLE scans
  ADD CONSTRAINT unique_board_per_day
  UNIQUE (board, week_number);

-- Add GPS accuracy gate index for fast flagging queries
CREATE INDEX IF NOT EXISTS idx_scans_gps_accuracy
  ON scans (gps_accuracy_m)
  WHERE gps_accuracy_m > 50;

-- Add week_number index for weekly report queries
CREATE INDEX IF NOT EXISTS idx_scans_week_number
  ON scans (week_number);
-- ── CO2 records table ──
CREATE TABLE IF NOT EXISTS co2_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  total_kg DECIMAL(10,2) DEFAULT 0,
  participants_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site, week_number)
);

-- ── Audit Log (Immutable) ──
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit Trigger Function ──
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log(table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log(table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log(table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Apply Audit Triggers ──
CREATE TRIGGER audit_scans AFTER INSERT OR UPDATE OR DELETE ON scans FOR EACH ROW EXECUTE FUNCTION process_audit_log();
CREATE TRIGGER audit_participants AFTER INSERT OR UPDATE OR DELETE ON participants FOR EACH ROW EXECUTE FUNCTION process_audit_log();
CREATE TRIGGER audit_pending_users AFTER INSERT OR UPDATE OR DELETE ON pending_users FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- ── RLS for Audit Log (Admin Only) ──
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only read audit_log" ON audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email IN ('admin@carbonclarify.com', 'poutchop@gmail.com'))
);
