import { useEffect, useRef, useState } from 'react'
import type { WeatherCondition } from '@/hooks/useWeather'

interface Props {
  condition: WeatherCondition
  size?: number
  className?: string
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

function SunRays() {
  return (
    <g className="weather-sun-rays">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1="24"
          y1="24"
          x2="24"
          y2="8"
          stroke="#FFBE26"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform={`rotate(${angle} 24 24)`}
          opacity="0.85"
        />
      ))}
    </g>
  )
}

function SunCore({ cx = 24, cy = 24, r = 10, color = '#FFBE26' }: { cx?: number; cy?: number; r?: number; color?: string }) {
  return <circle cx={cx} cy={cy} r={r} fill={color} />
}

function Cloud({ x = 14, y = 20, scale = 1, fill = '#E8F0FE', opacity = 1 }: { x?: number; y?: number; scale?: number; fill?: string; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <ellipse cx="10" cy="14" rx="10" ry="7" fill={fill} />
      <ellipse cx="18" cy="10" rx="8" ry="6" fill={fill} />
      <ellipse cx="8" cy="9" rx="7" ry="5.5" fill={fill} />
    </g>
  )
}

function Moon({ cx = 24, cy = 24 }: { cx?: number; cy?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="10" fill="#E8EDFF" />
      <circle cx={cx + 5} cy={cy - 3} r="8" fill="transparent" />
      <path
        d={`M ${cx + 3} ${cy - 10} A 10 10 0 1 0 ${cx + 3} ${cy + 10} A 8 8 0 1 1 ${cx + 3} ${cy - 10} Z`}
        fill="#C7D2FE"
      />
    </g>
  )
}

function Stars() {
  return (
    <g>
      <circle cx="10" cy="10" r="1" fill="#C7D2FE" opacity="0.8" />
      <circle cx="38" cy="12" r="0.8" fill="#C7D2FE" opacity="0.6" />
      <circle cx="32" cy="6" r="0.7" fill="#C7D2FE" opacity="0.7" />
      <circle cx="14" cy="36" r="0.6" fill="#C7D2FE" opacity="0.5" />
    </g>
  )
}

function RainDrops() {
  return (
    <g className="weather-rain">
      {[16, 22, 28, 34].map((x) => (
        <line key={x} x1={x} y1="34" x2={x - 1} y2="38" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
      ))}
    </g>
  )
}

function LightningBolt() {
  return (
    <path d="M25 30 L22 36 L25 36 L23 42" stroke="#FFBE26" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="weather-lightning" />
  )
}

export function DynamicWeatherIcon({ condition, size = 48, className = '' }: Props) {
  const reducedMotion = usePrefersReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)

  const renderContent = () => {
    switch (condition) {
      case 'clear':
        return (
          <>
            <SunRays />
            <SunCore />
          </>
        )
      case 'sunrise':
        return (
          <g className={reducedMotion ? '' : 'weather-sunrise'}>
            <SunCore cy={28} color="#FF9638" />
            <line x1="10" y1="36" x2="38" y2="36" stroke="#FFBE26" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          </g>
        )
      case 'sunset':
        return (
          <g className={reducedMotion ? '' : 'weather-sunset'}>
            <SunCore cy={26} color="#FF9638" />
            <line x1="10" y1="36" x2="38" y2="36" stroke="#FF9638" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          </g>
        )
      case 'partly-cloudy':
        return (
          <>
            <SunCore cx={18} cy={18} r={8} />
            <Cloud x={12} y={16} scale={0.9} fill="#F0F4FF" />
          </>
        )
      case 'cloudy':
        return (
          <>
            <Cloud x={8} y={12} scale={0.8} fill="#E2E8F0" opacity={0.7} />
            <Cloud x={12} y={16} scale={1} fill="#F0F4FF" />
          </>
        )
      case 'rainy':
        return (
          <>
            <Cloud x={10} y={10} scale={0.95} fill="#E2E8F0" />
            <RainDrops />
          </>
        )
      case 'stormy':
        return (
          <>
            <Cloud x={10} y={8} scale={1} fill="#CBD5E1" />
            <LightningBolt />
          </>
        )
      case 'foggy':
        return (
          <>
            <SunCore cx={24} cy={20} r={8} color="#D4D4D8" />
            <g opacity="0.5">
              <line x1="8" y1="30" x2="40" y2="30" stroke="#D4D4D8" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="34" x2="36" y2="34" stroke="#D4D4D8" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="38" x2="32" y2="38" stroke="#D4D4D8" strokeWidth="2" strokeLinecap="round" />
            </g>
          </>
        )
      case 'night':
        return (
          <>
            <Stars />
            <Moon />
          </>
        )
      default:
        return (
          <>
            <SunRays />
            <SunCore />
          </>
        )
    }
  }

  const label =
    condition === 'night'
      ? 'Nighttime'
      : condition === 'rainy'
        ? 'Rainy weather'
        : condition === 'stormy'
          ? 'Stormy weather'
          : condition === 'cloudy'
            ? 'Cloudy weather'
            : condition === 'partly-cloudy'
              ? 'Partly cloudy'
              : condition === 'foggy'
                ? 'Foggy weather'
                : condition === 'sunrise'
                  ? 'Sunrise'
                  : condition === 'sunset'
                    ? 'Sunset'
                    : 'Clear sky'

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`weather-icon ${className}`}
      role="img"
      aria-label={label}
    >
      {renderContent()}
      <style>{`
        .weather-icon .weather-sun-rays {
          transform-origin: 24px 24px;
          animation: ${reducedMotion ? 'none' : 'weather-rotate 20s linear infinite'};
        }
        @keyframes weather-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .weather-icon .weather-sunrise {
          animation: ${reducedMotion ? 'none' : 'weather-rise 3s ease-out both'};
        }
        @keyframes weather-rise {
          from { transform: translateY(8px); opacity: 0.5; }
          to { transform: translateY(0); opacity: 1; }
        }
        .weather-icon .weather-sunset {
          animation: ${reducedMotion ? 'none' : 'weather-set 3s ease-in both'};
        }
        @keyframes weather-set {
          from { transform: translateY(-6px); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
        .weather-icon .weather-rain line {
          animation: ${reducedMotion ? 'none' : 'weather-drop 1.2s linear infinite'};
        }
        @keyframes weather-drop {
          0% { opacity: 0; transform: translateY(-2px); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(3px); }
        }
        .weather-icon .weather-lightning {
          animation: ${reducedMotion ? 'none' : 'weather-flash 2s ease-in-out infinite'};
        }
        @keyframes weather-flash {
          0%, 90%, 100% { opacity: 0; }
          92% { opacity: 1; }
          94% { opacity: 0; }
          96% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .weather-icon * { animation: none !important; }
        }
      `}</style>
    </svg>
  )
}

export default DynamicWeatherIcon
