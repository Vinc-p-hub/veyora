import { createClient } from '@supabase/supabase-js';

// Public values (safe in the browser): the anon/publishable key is protected by RLS.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fulpkoenkmxwttgwioci.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_cZeD4e3I7egX_KOQMmLYcg_Ca1hYiqb';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
