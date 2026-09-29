import { useEffect, useState } from 'react'
import { subscribeToTable, type RealtimeChangePayload } from '@/lib/supabase'

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RealtimeRowEvent<T = Record<string, unknown>> {
  eventType: RealtimeEventType
  row: T
  previous?: T
}

export type RealtimeStatus = 'connecting' | 'open' | 'error' | 'disabled'

export function useRealtime<T = Record<string, unknown>>(
  table: string,
  enabled = true,
): {
  events: RealtimeRowEvent<T>[]
  status: RealtimeStatus
  clearEvents: () => void
} {
  const [events, setEvents] = useState<RealtimeRowEvent<T>[]>([])
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    if (!enabled) return

    const unsubscribe = subscribeToTable(table, (payload: RealtimeChangePayload) => {
      const eventType = payload.eventType as RealtimeEventType
      if (eventType === 'DELETE') {
        setEvents((prev) => [
          ...prev,
          { eventType, row: payload.old as T, previous: payload.old as T },
        ])
      } else {
        setEvents((prev) => [
          ...prev,
          { eventType, row: payload.new as T, previous: payload.old as T },
        ])
      }
      setStatus('open')
    })

    return () => {
      unsubscribe()
    }
  }, [table, enabled])

  return {
    events,
    status: supabaseConfigured() ? status : 'disabled',
    clearEvents: () => setEvents([]),
  }
}

function supabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}