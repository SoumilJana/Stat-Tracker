CREATE TYPE role_type AS ENUM ('admin', 'player');
CREATE TYPE session_mode AS ENUM ('STANDARD', 'WINNER_STAYS');
CREATE TYPE session_status AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE event_type AS ENUM ('GOAL', 'NO_GOAL_TIME_UP', 'SESSION_END', 'UNDO');

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role role_type DEFAULT 'player',
  jersey_number INTEGER,
  photo_url TEXT
);

CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location TEXT,
  notes TEXT,
  mode session_mode NOT NULL,
  status session_status DEFAULT 'IN_PROGRESS'
);

CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE team_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(team_id, player_id)
);

CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Setup
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow read access for everyone
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Sessions are viewable by everyone." ON sessions FOR SELECT USING (true);
CREATE POLICY "Teams are viewable by everyone." ON teams FOR SELECT USING (true);
CREATE POLICY "Team players are viewable by everyone." ON team_players FOR SELECT USING (true);
CREATE POLICY "Events are viewable by everyone." ON events FOR SELECT USING (true);

-- For V1, we can allow admins to do everything. (Assuming we have a function or claim to check admin)
-- Simplest approach for V1: allow authenticated users to insert/update, 
-- but we can restrict to role='admin' on profiles later.
