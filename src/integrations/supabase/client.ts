import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://amrjkvvmvhqoqqkxntna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcmprdnZtdmhxb3Fxa3hudG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzUzOTksImV4cCI6MjA4MjYxMTM5OX0.CQ4VlMVG5m80JdJdvOqZ4-11Ewq3kvmplxAcXuM3tOw';

export const isSupabaseConfigured = true;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: localStorage,
    },
});
