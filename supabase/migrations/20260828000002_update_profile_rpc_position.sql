CREATE OR REPLACE FUNCTION update_profile_data(
  p_user_id UUID,
  p_username TEXT,
  p_full_name TEXT,
  p_photo_url TEXT,
  p_position player_position DEFAULT 'FWD'::player_position
) RETURNS void AS $$
BEGIN
  -- Check authorization: user is updating themselves OR user is an admin
  IF auth.uid() = p_user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    UPDATE profiles
    SET username = p_username,
        full_name = p_full_name,
        photo_url = p_photo_url,
        position = p_position
    WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Not authorized to update this profile';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
