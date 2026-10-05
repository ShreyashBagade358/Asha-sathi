import { type SupabaseClient } from '@supabase/supabase-js';
export interface SupabaseConfig {
    url: string;
    anonKey: string;
}
/**
 * Get or initialize a singleton Supabase client instance
 */
export declare function getSupabaseClient(config?: SupabaseConfig): SupabaseClient;
