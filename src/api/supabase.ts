import { secureStorage } from "@/src/lib/secure-storage";
import { Database } from "@/src/types/database";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey)
  throw new Error("Missing Supabase enviroment variables");

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
