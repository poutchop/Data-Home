-- CARBON CLARITY DATA VAULT — COMPLETE SCHEMA
-- Run this first. It creates every table the app needs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS participants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     TEXT NOT NULL,
  phone         TEXT,
  site          TEXT NOT NULL,
  group_name    TEXT,
  total_points  INTEGER DEFAULT 0,
  weeks_active  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID REFERENCES participants(id),
  action_type   TEXT CHECK (action_type IN ('firewood_avoidance','nutrition_meal','solar_drying')),
  board_code    TEXT UNIQUE NOT NULL,
  hmac_secret   TEXT NOT NULL,
  issued_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id          UUID REFERENCES boards(id),
  participant_id    UUID REFERENCES participants(id),
  action_type       TEXT,
  week_number       INTEGER,
  sticker_count     INTEGER CHECK (sticker_count BETWEEN 0 AND 21),
  gps_lat           DECIMAL(10,7),
  gps_lng           DECIMAL(10,7),
  gps_accuracy_m    DECIMAL(8,2),
  status            TEXT DEFAULT 'hardened',
  points_awarded    INTEGER DEFAULT 0,
  co2_kg            DECIMAL(8,3),
  photo_url         TEXT,
  verification_log  JSONB DEFAULT '{}',
  scanned_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id  UUID REFERENCES participants(id),
  site            TEXT,
  meal_name       TEXT,
  protein_g       DECIMAL(6,1),
  kcal            INTEGER,
  score           INTEGER CHECK (score BETWEEN 0 AND 100),
  verified        BOOLEAN DEFAULT TRUE,
  logged_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payouts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id   UUID REFERENCES participants(id),
  amount_ghs       DECIMAL(8,2),
  provider         TEXT,
  phone_last4      TEXT,
  status           TEXT DEFAULT 'pending',
  week_number      INTEGER,
  idempotency_key  TEXT UNIQUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name    TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  role_request TEXT DEFAULT 'supervisor',
  status       TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

-- INSERT PARTICIPANTS (9 Berekuso women)
INSERT INTO participants (full_name, phone, site, group_name, total_points, weeks_active) VALUES
  ('Akosua Mensah',    '0241234567', 'Berekuso Farm A', 'Group 1', 147, 4),
  ('Abena Asante',     '0242345678', 'Berekuso Farm A', 'Group 1', 132, 4),
  ('Ama Boateng',      '0243456789', 'Berekuso Farm A', 'Group 1', 118, 3),
  ('Efua Darko',       '0244567890', 'Berekuso Farm B', 'Group 2', 95, 3),
  ('Adwoa Owusu',      '0245678901', 'Berekuso Farm B', 'Group 2', 88, 3),
  ('Afia Amponsah',    '0246789012', 'Berekuso Farm B', 'Group 2', 76, 2),
  ('Yaa Frimpong',     '0247890123', 'Tomato Co-op West', 'Group 3', 64, 2),
  ('Akua Osei',        '0248901234', 'Tomato Co-op West', 'Group 3', 51, 2),
  ('Araba Quayson',    '0249012345', 'Tomato Co-op West', 'Group 3', 43, 1);

-- INSERT SAMPLE SCANS (links to participants by subquery)
INSERT INTO scans (participant_id, action_type, week_number, sticker_count,
  gps_lat, gps_lng, gps_accuracy_m, status, points_awarded, co2_kg)
SELECT id, 'firewood_avoidance', 4, 7, 5.7456, -0.3214, 8.2, 'hardened', 3, 2.45
FROM participants WHERE full_name = 'Akosua Mensah';

INSERT INTO scans (participant_id, action_type, week_number, sticker_count,
  gps_lat, gps_lng, gps_accuracy_m, status, points_awarded, co2_kg)
SELECT id, 'nutrition_meal', 4, 6, 5.7461, -0.3208, 11.4, 'hardened', 2, 0
FROM participants WHERE full_name = 'Akosua Mensah';

INSERT INTO scans (participant_id, action_type, week_number, sticker_count,
  gps_lat, gps_lng, gps_accuracy_m, status, points_awarded, co2_kg)
SELECT id, 'firewood_avoidance', 4, 5, 5.7448, -0.3221, 9.8, 'hardened', 3, 1.75
FROM participants WHERE full_name = 'Abena Asante';

INSERT INTO scans (participant_id, action_type, week_number, sticker_count,
  gps_lat, gps_lng, gps_accuracy_m, status, points_awarded, co2_kg)
SELECT id, 'solar_drying', 4, 4, 5.7453, -0.3219, 14.2, 'hardened', 2, 0
FROM participants WHERE full_name = 'Ama Boateng';

INSERT INTO scans (participant_id, action_type, week_number, sticker_count,
  gps_lat, gps_lng, gps_accuracy_m, status, points_awarded, co2_kg)
SELECT id, 'firewood_avoidance', 3, 7, 5.7462, -0.3205, 7.1, 'hardened', 3, 2.45
FROM participants WHERE full_name = 'Efua Darko';

-- INSERT NUTRITION LOGS
INSERT INTO nutrition_logs (participant_id, site, meal_name, protein_g, kcal, score)
SELECT id, 'Berekuso Farm A', 'Kontomire stew with egg', 18.4, 420, 82
FROM participants WHERE full_name = 'Akosua Mensah';

INSERT INTO nutrition_logs (participant_id, site, meal_name, protein_g, kcal, score)
SELECT id, 'Berekuso Farm A', 'Groundnut soup with fish', 22.1, 510, 79
FROM participants WHERE full_name = 'Abena Asante';

INSERT INTO nutrition_logs (participant_id, site, meal_name, protein_g, kcal, score)
SELECT id, 'Berekuso Farm B', 'Beans stew with plantain', 15.8, 480, 76
FROM participants WHERE full_name = 'Efua Darko';

INSERT INTO nutrition_logs (participant_id, site, meal_name, protein_g, kcal, score)
SELECT id, 'Tomato Co-op West', 'Yam with garden egg sauce', 12.3, 390, 71
FROM participants WHERE full_name = 'Yaa Frimpong';

-- INSERT PAYOUTS
INSERT INTO payouts (participant_id, amount_ghs, provider, phone_last4, status, week_number)
SELECT id, 5.00, 'MTN', '7731', 'confirmed', 3
FROM participants WHERE full_name = 'Akosua Mensah';

INSERT INTO payouts (participant_id, amount_ghs, provider, phone_last4, status, week_number)
SELECT id, 5.00, 'Telecel', '4892', 'confirmed', 3
FROM participants WHERE full_name = 'Abena Asante';
