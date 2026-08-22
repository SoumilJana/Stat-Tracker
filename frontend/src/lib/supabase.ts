import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options) => {
      // Adblockers (like uBlock Origin/EasyPrivacy) often block PATCH requests to endpoints containing "/profiles".
      // We convert PATCH to POST and use X-HTTP-Method-Override to bypass this restriction safely.
      if (options?.method === 'PATCH' && url.toString().includes('/profiles')) {
        options.method = 'POST';
        if (options.headers && typeof (options.headers as any).set === 'function') {
          (options.headers as any).set('X-HTTP-Method-Override', 'PATCH');
        } else {
          options.headers = { ...options.headers, 'X-HTTP-Method-Override': 'PATCH' };
        }
      }
      
      try {
        return await fetch(url, options);
      } catch (err: any) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          throw new Error(
            'Network error: Request was blocked by an adblocker or the network is offline. ' +
            'Please disable your adblocker for this site and try again.'
          );
        }
        throw err;
      }
    }
  }
});
