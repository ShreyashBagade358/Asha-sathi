import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export interface RealtimeChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  schema: string
  table: string
  new: Record<string, unknown>
  old: Record<string, unknown>
}

/**
 * Subscribe to realtime postgres changes for a table.
 * Returns an unsubscribe function. No-op when Supabase is not configured.
 */
export function subscribeToTable(
  table: string,
  onEvent: (payload: RealtimeChangePayload) => void,
  channelName?: string,
): () => void {
  if (!supabase) {
    return () => undefined
  }
  const channel = supabase
    .channel(channelName ?? `public:${table}`)
    .on('system', { schema: 'public', table }, onEvent as never)
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}