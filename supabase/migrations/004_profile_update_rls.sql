-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Admins can update any profile (assuming we check the auth.jwt() for the role claim or just let RLS handle it if they are superuser, but since we use service_role for admins creating players, maybe admins don't need UI-based UPDATE for now. If they do, we can add it later.)
