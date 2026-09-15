import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://vsysihbzjwbpvzuoaqrv.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeXNpaGJ6andicHZ6dW9hcXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTg2NjgsImV4cCI6MjEwNDA3NDY2OH0.swdJEM-HbMXAL11TApceWehAjFlraSuvbcjU-wIMg14'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.info('Using default Supabase production configuration for TERMCAT.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

