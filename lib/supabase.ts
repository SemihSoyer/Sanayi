import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ssnvbkwkyzkdxnzffdlm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzbnZia3dreXprZHhuemZmZGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MDI2NDUsImV4cCI6MjA2MjI3ODY0NX0.XyO7mRMO5SYPt868ORmmiaub2nLmOjeIo1D40_o4YhI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})