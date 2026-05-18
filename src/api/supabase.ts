import { createClient } from "@supabase/supabase-js";
import * as SecureStorage from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey)
  throw new Error("Missing Supabase enviroment variables");

const SecureStoreAdapter = {
  getItem: (key: string) => SecureStorage.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStorage.setItemAsync(key, value),
  removeItem: (key: string) => SecureStorage.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
