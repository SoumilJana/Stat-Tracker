CREATE TYPE draft_status AS ENUM ('SETUP', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status draft_status DEFAULT 'SETUP',
  single_device_mode BOOLEAN DEFAULT false,
  current_pick_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE draft_captains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  pick_order INTEGER NOT NULL,
  UNIQUE(draft_id, player_id)
);

CREATE TABLE draft_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE,
  captain_id UUID REFERENCES draft_captains(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(draft_id, player_id)
);

-- RLS
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_captains ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drafts are viewable by everyone." ON drafts FOR SELECT USING (true);
CREATE POLICY "Drafts can be inserted by authenticated users." ON drafts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Drafts can be updated by authenticated users." ON drafts FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Draft captains are viewable by everyone." ON draft_captains FOR SELECT USING (true);
CREATE POLICY "Draft captains can be inserted by authenticated users." ON draft_captains FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Draft picks are viewable by everyone." ON draft_picks FOR SELECT USING (true);
CREATE POLICY "Draft picks can be inserted by authenticated users." ON draft_picks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
