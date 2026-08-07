-- Allow authenticated users to INSERT and UPDATE sessions
CREATE POLICY "Authenticated users can insert sessions" ON sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sessions" ON sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete sessions" ON sessions FOR DELETE TO authenticated USING (true);

-- Allow authenticated users to INSERT and UPDATE teams
CREATE POLICY "Authenticated users can insert teams" ON teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update teams" ON teams FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete teams" ON teams FOR DELETE TO authenticated USING (true);

-- Allow authenticated users to INSERT and UPDATE team_players
CREATE POLICY "Authenticated users can insert team_players" ON team_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete team_players" ON team_players FOR DELETE TO authenticated USING (true);

-- Allow authenticated users to INSERT events
CREATE POLICY "Authenticated users can insert events" ON events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update events" ON events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete events" ON events FOR DELETE TO authenticated USING (true);
