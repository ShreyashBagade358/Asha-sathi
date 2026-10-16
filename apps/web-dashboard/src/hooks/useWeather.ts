import { useEffect, useState } from 'react'
import type { GreetingPeriod } from './useLocalDateTime'

export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rainy'
  | 'stormy'
  | 'foggy'
  | 'sunrise'
  | 'sunset'
  | 'night'

export interface WeatherData {
  condition: WeatherCondition
  temperatureC: number | null
  description: string | null
  isStale: boolean
}

export interface WeatherProvider {
  fetch(): Promise<{ condition: WeatherCondition; temperatureC: number | null; description: string }>
}

/**
 * Time-aware fallback when no real weather data is available.
 * This does NOT fabricate weather — it derives purely from the clock.
 */
function fallbackCondition(period: GreetingPeriod, hour: number): WeatherCondition {
  if (period === 'night') return 'night'
  if (hour >= 5 && hour <= 7) return 'sunrise'
  if (hour >= 18 && hour <= 20) return 'sunset'
  return 'clear'
}

const CACHE_KEY = 'asha_weather_cache'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface CacheEntry {
  data: WeatherData
  ts: number
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Hook that returns weather data.
 * Falls back to time-aware condition until a real provider is wired up.
 */
export function useWeather(period: GreetingPeriod, hour: number): WeatherData {
  const [data, setData] = useState<WeatherData>(() => {
    const cached = readCache()
    if (cached) return { ...cached.data, isStale: false }
    return {
      condition: fallbackCondition(period, hour),
      temperatureC: null,
      description: null,
      isStale: true,
    }
  })

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setData({ ...cached.data, isStale: false })
      return
    }

    // No real weather provider configured yet.
    // Use time-based fallback. Do NOT fabricate weather.
    const fallback: WeatherData = {
      condition: fallbackCondition(period, hour),
      temperatureC: null,
      description: null,
      isStale: true,
    }
    setData(fallback)
  }, [period, hour])

  return data
}

/**
 * To integrate a real weather API later, provide a WeatherProvider and
 * pass it here. Example:
 *
 *   const provider: WeatherProvider = {
 *     async fetch() {
 *       const res = await fetch(`https://api.example.com/weather?...`)
 *       const json = await res.json()
 *       return { condition: mapApiCondition(json), temperatureC: json.temp_c, description: json.text }
 *     }
 *   }
 *
 * Never embed API keys in frontend code — use a server-side proxy.
 */

