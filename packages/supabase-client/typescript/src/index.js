import { createClient } from '@supabase/supabase-js';
let clientInstance = null;
/**
 * Get or initialize a singleton Supabase client instance
 */
export function getSupabaseClient(config) {
    if (clientInstance)
        return clientInstance;
    const url = config?.url || (typeof process !== 'undefined' ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL : '') || '';
    const anonKey = config?.anonKey || (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY : '') || '';
    if (!url || !anonKey) {
        console.warn('[ASHA Supabase] Client initialized without valid URL/Key configuration');
    }
    clientInstance = createClient(url, anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    });
    return clientInstance;
}
