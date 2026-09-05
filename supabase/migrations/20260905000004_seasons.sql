CREATE TABLE seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_number INT UNIQUE NOT NULL,
  season_label TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_sealed BOOLEAN DEFAULT false,
  notes TEXT,
  declared_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  declared_at TIMESTAMPTZ,
  scorer_1_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scorer_1_goals INT,
  scorer_2_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scorer_2_goals INT,
  scorer_3_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scorer_3_goals INT,
  assister_1_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assister_1_assists INT,
  assister_2_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assister_2_assists INT,
  assister_3_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assister_3_assists INT,
  defender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  defender_awards INT,
  gk_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  gk_awards INT
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons viewable by everyone." ON seasons FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert seasons." ON seasons FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update seasons." ON seasons FOR UPDATE USING (auth.uid() IS NOT NULL);
