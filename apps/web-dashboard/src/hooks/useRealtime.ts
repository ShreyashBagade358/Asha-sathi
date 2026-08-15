import { useEffect, useState } from 'react'
import { subscribeToTable } from '@/lib/supabase'

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RealtimeRowEvent<T> {
  eventType: RealtimeEventType
  row: T
  previous?: T
}

export type RealtimeStatus = 'connecting' | 'open' | 'error' | 'disabled'

export function useRealtime(
  table: string,
  enabled = true,
): {
  events: RealtimeRowEvent<any>[]
  status: RealtimeStatus
  clearEvents: () => void
} {
  const [events, setEvents] = useState<RealtimeRowEvent<any>[]>([])
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    if (!enabled) return

    const unsubscribe = subscribeToTable(
      table,
      (payload: any) => {
        const eventType = payload.eventType as RealtimeEventType
        if (eventType === 'DELETE') {
          setEvents((prev) => [...prev, { eventType, row: payload.old, previous: payload.old }])
        } else {
          setEvents((prev) => [...prev, { eventType, row: payload.new, previous: payload.old }])
        }
        setStatus('open')
      }
    )

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