-- ══ Seed Nutrition Data into Supabase ══
-- Run this in your Supabase SQL Editor

-- Get some existing participant IDs
DO $$
DECLARE
  p_akosua UUID;
  p_abena UUID;
  p_ama UUID;
BEGIN
  SELECT id INTO p_akosua FROM participants WHERE name = 'Akosua Mensah' LIMIT 1;
  SELECT id INTO p_abena FROM participants WHERE name = 'Abena Owusu' LIMIT 1;
  SELECT id INTO p_ama FROM participants WHERE name = 'Ama Asante' LIMIT 1;

  -- If the participants don't exist, we can't seed properly with foreign keys. 
  -- Assuming they do exist from the previous seed:

  INSERT INTO nutrition_logs (participant_id, participant_name, site, meal, protein_g, kcal, score, verified, log_date) VALUES
  (p_akosua, 'Akosua Mensah', 'Farm A', 'Bean stew with greens', 28, 480, 82, true, '2026-04-15'),
  (p_abena, 'Abena Owusu', 'Farm B', 'Kontomire with yam', 22, 410, 74, true, '2026-04-15'),
  (p_akosua, 'Akosua Mensah', 'Farm A', 'Groundnut soup + rice', 31, 520, 86, true, '2026-04-14'),
  (p_ama, 'Ama Asante', 'Farm A', 'Egg with tomato sauce', 18, 360, 68, false, '2026-04-14'),
  (p_abena, 'Abena Owusu', 'Farm B', 'Bean stew', 25, 440, 78, true, '2026-04-13'),
  (p_ama, 'Ama Asante', 'Farm A', 'Waakye with egg', 26, 510, 80, true, '2026-04-13'),
  (p_akosua, 'Akosua Mensah', 'Farm A', 'Fish stew with plantain', 32, 450, 88, true, '2026-04-12'),
  (p_abena, 'Abena Owusu', 'Farm B', 'Okro soup with banku', 20, 420, 72, true, '2026-04-12'),
  (p_ama, 'Ama Asante', 'Farm A', 'Red red (beans and plantain)', 24, 490, 81, true, '2026-04-11'),
  (p_akosua, 'Akosua Mensah', 'Farm A', 'Light soup with goat meat', 29, 380, 85, true, '2026-04-11');
END $$;
