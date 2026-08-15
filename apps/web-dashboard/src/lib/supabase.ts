import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

/**
 * Subscribe to realtime postgres changes for a table.
 * Returns an unsubscribe function. No-op when Supabase is not configured.
 */
export function subscribeToTable(
  table: string,
  onEvent: (payload: any) => void,
  channelName?: string,
): () => void {
  if (!supabase) {
    return () => undefined
  }
  const channel = supabase
    .channel(channelName ?? `public:${table}`)
    .on('system', { schema: 'public', table }, onEvent as any)
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}