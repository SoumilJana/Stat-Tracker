import { supabase } from './supabase';

import { createClient } from '@supabase/supabase-js';

export async function createPlayer(data: any) {
  const email = `${data.username.trim().toLowerCase()}@stattracker.local`;
  
  // Create a temporary Supabase client that DOES NOT persist the session.
  // If we use the main client, Supabase will automatically log the Admin out
  // and log them in as this newly created user.
  const tempSupabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  );

  const { data: authData, error: authError } = await tempSupabase.auth.signUp({
    email,
    password: data.password,
    options: {
      data: {
        username: data.username.trim(),
        role: 'player', // Force role to player
        jersey_number: data.jersey_number || null
      }
    }
  });

  if (authError) throw new Error(authError.message);
  
  const userId = authData.user?.id;
  if (!userId) throw new Error("Failed to create user");

  // Note: We DO NOT manually insert into the 'profiles' table here.
  // The Supabase backend is configured with a Postgres trigger that automatically
  // creates the profile using the options.data metadata we passed above.
  
  return { message: "Player created successfully", user_id: userId };
}

export async function deletePlayer(userId: string) {
  const { error } = await supabase.rpc('delete_profile_data', {
    p_user_id: userId
  });
    
  if (error) throw new Error(error.message);
  
  return { message: "Player deleted successfully" };
}

export async function updatePlayer(userId: string, data: any) {
  let final_photo_url = data.photo_url;
  
  if (data.image_file) {
    const fileName = `${userId}-${Date.now()}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, data.image_file, {
        contentType: 'image/jpeg',
        upsert: true
      });
      
    if (uploadError) throw new Error(uploadError.message);
    
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
      
    final_photo_url = publicUrlData.publicUrl;
  }
  
  const { error } = await supabase.rpc('update_profile_data', {
    p_user_id: userId,
    p_username: data.username,
    p_full_name: data.full_name || null,
    p_photo_url: final_photo_url || null,
    p_position: data.position || 'FWD'
  });
    
  if (error) throw new Error(error.message);
  
  return { 
    message: "Player updated successfully", 
    photo_url: final_photo_url 
  };
}
