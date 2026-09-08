import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

console.log('Supabase Init:', {
  url: supabaseUrl ? 'set' : 'MISSING',
  key: supabaseAnonKey ? 'set' : 'MISSING'
});

let supabase: any;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Supabase initialization error:', err);
    supabase = null;
  }
} else {
  supabase = null;
}

export { supabase };

export type Form = {
  id: string;
  form_type: string;
  client_name: string;
  client_email?: string;
  status: 'pending_leads' | 'not_sent' | 'sent' | 'opened' | 'in_progress' | 'completed' | 'submitted' | 'overdue' | 'no_response';
  progress_pct: number;
  created_at: string;
  last_accessed?: string;
  last_saved?: string;
  marked_complete_at?: string;
  submitted_at?: string;
  form_data: Record<string, any>;
  unique_link: string;
};

