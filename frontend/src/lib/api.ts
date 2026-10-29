import { supabase } from './supabase';

import { createClient } from '@supabase/supabase-js';

export interface UpdatePlayerData {
  username: string;
  full_name?: string | null;
  position?: 'FWD' | 'MID' | 'DEF' | 'GK';
  photo_url?: string | null;
  ranking_image_url?: string | null;
  image_file?: File | null;
  ranking_image_file?: File | null;
  remove_photo?: boolean;
  remove_ranking_image?: boolean;
}

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

  // If initial images or details were provided, update the profile using existing session
  if (data.image_file || data.ranking_image_file || data.full_name || data.position) {
    await updatePlayer(userId, {
      username: data.username.trim(),
      full_name: data.full_name || null,
      position: data.position || 'FWD',
      image_file: data.image_file || null,
      ranking_image_file: data.ranking_image_file || null
    });
  }
  
  return { message: "Player created successfully", user_id: userId };
}

export async function deletePlayer(userId: string) {
  const { error } = await supabase.rpc('delete_profile_data', {
    p_user_id: userId
  });
    
  if (error) throw new Error(error.message);
  
  return { message: "Player deleted successfully" };
}

export async function updatePlayer(userId: string, data: UpdatePlayerData) {
  let final_photo_url: string | null = data.photo_url !== undefined ? data.photo_url : null;
  let final_ranking_image_url: string | null = data.ranking_image_url !== undefined ? data.ranking_image_url : null;
  
  // 1. Process portrait removal or upload
  if (data.remove_photo) {
    final_photo_url = null;
  } else if (data.image_file) {
    const fileName = `${userId}-portrait-${Date.now()}.jpg`;
    
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

  // 2. Process ranking banner removal or upload
  if (data.remove_ranking_image) {
    final_ranking_image_url = null;
  } else if (data.ranking_image_file) {
    const fileName = `${userId}-banner-${Date.now()}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, data.ranking_image_file, {
        contentType: 'image/jpeg',
        upsert: true
      });
      
    if (uploadError) throw new Error(uploadError.message);
    
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
      
    final_ranking_image_url = publicUrlData.publicUrl;
  }
  
  // 3. Save to database using update_profile_data RPC
  const { error } = await supabase.rpc('update_profile_data', {
    p_user_id: userId,
    p_username: data.username,
    p_full_name: data.full_name || null,
    p_photo_url: final_photo_url,
    p_position: data.position || 'FWD',
    p_ranking_image_url: final_ranking_image_url
  });
    
  if (error) throw new Error(error.message);

  // 4. Safe storage cleanup (Requirement 9)
  // Ensure replacing or removing an image does not accidentally delete an image still referenced by another field
  const cleanupOldFile = async (oldUrl: string | null | undefined) => {
    if (!oldUrl) return;
    if (oldUrl === final_photo_url || oldUrl === final_ranking_image_url) return;
    try {
      const marker = '/avatars/';
      const idx = oldUrl.indexOf(marker);
      if (idx !== -1) {
        const path = oldUrl.substring(idx + marker.length);
        if (path) {
          await supabase.storage.from('avatars').remove([path]);
        }
      }
    } catch (e) {
      console.warn('Non-fatal error cleaning up old image:', e);
    }
  };

  if ((data.remove_photo || data.image_file) && data.photo_url) {
    await cleanupOldFile(data.photo_url);
  }
  if ((data.remove_ranking_image || data.ranking_image_file) && data.ranking_image_url) {
    await cleanupOldFile(data.ranking_image_url);
  }
  
  return { 
    message: "Player updated successfully", 
    photo_url: final_photo_url,
    ranking_image_url: final_ranking_image_url
  };
}
