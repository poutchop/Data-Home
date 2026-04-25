-- ══ Carbon Clarity Data Vault — Supabase Schema ══
-- Run this in your Supabase SQL Editor to set up the database

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

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

-- ── Scans table ──
CREATE TABLE IF NOT EXISTS scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id),
  participant_name TEXT NOT NULL,
  board TEXT NOT NULL,
  site TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('firewood_avoidance', 'nutrition_meal', 'solar_drying')),
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
