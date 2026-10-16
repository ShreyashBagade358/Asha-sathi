import { useEffect, useState } from 'react'

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night'

export interface LocalDateTime {
  now: Date
  period: GreetingPeriod
  formattedDate: string
}

function getPeriod(hour: number): GreetingPeriod {
  if (hour >= 5 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 17) return 'afternoon'
  if (hour >= 18 && hour <= 20) return 'evening'
  return 'night'
}

export function useLocalDateTime(intervalMs = 60_000): LocalDateTime {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return { now, period: getPeriod(now.getHours()), formattedDate }
}
