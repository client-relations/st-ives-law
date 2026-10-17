import { createClient } from '@supabase/supabase-js';

// import.meta.env exists only under Vite; the unit tests import this module
// under plain Node, where it is undefined.
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

let supabase: any;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Supabase initialization error:', err);
    supabase = null;
  }
} else {
  console.error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  supabase = null;
}

export { supabase };
