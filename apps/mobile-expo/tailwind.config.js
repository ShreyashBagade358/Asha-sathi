/**
 * Mirrors apps/web-dashboard/tailwind.config.js so the mobile app renders the
 * exact same Indigo + Teal healthcare palette the dashboard actually ships.
 *
 * Surface / neutral colours are CSS variables defined in global.css so they
 * swap automatically when the phone enters dark mode (prefers-color-scheme).
 * Accent colours (primary, secondary, tertiary, error, maternal, amber, teal)
 * are static hex — they are brand colours that stay consistent across themes.
 *
 * Differences from the web config, both forced by React Native:
 *  - `fontFamily` tokens resolve to the loaded Inter variants rather than a
 *    CSS font stack, so each weight is a real family name.
 *  - Animations are implemented with Reanimated in src/theme.ts instead of CSS
 *    @keyframes, which react-native-css-interop does not animate.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // ── CSS-variable tokens (swap in dark mode via global.css) ────
        primary: 'var(--color-primary)',
        'primary-container': 'var(--color-primary-container)',
        'on-primary-container': 'var(--color-on-primary-container)',
        surface: 'var(--color-surface)',
        'surface-dim': 'var(--color-surface-dim)',
        'surface-bright': 'var(--color-surface-bright)',
        'surface-container-lowest': 'var(--color-surface-container-lowest)',
        'surface-container-low': 'var(--color-surface-container-low)',
        'surface-container': 'var(--color-surface-container)',
        'surface-container-high': 'var(--color-surface-container-high)',
        'surface-container-highest': 'var(--color-surface-container-highest)',
        'on-surface': 'var(--color-on-surface)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        background: 'var(--color-background)',
        'on-background': 'var(--color-on-background)',
        outline: 'var(--color-outline)',
        'outline-variant': 'var(--color-outline-variant)',
        'inverse-surface': 'var(--color-inverse-surface)',
        'inverse-on-surface': 'var(--color-inverse-on-surface)',
        'inverse-primary': 'var(--color-inverse-primary)',
        'surface-tint': 'var(--color-surface-tint)',

        // ── Static accent tokens (same in light & dark) ───────────────
        'on-primary': '#ffffff',
        'primary-fixed': '#E0E7FF',
        'primary-fixed-dim': '#A5B4FC',
        'on-primary-fixed': '#1E1B4B',
        'on-primary-fixed-variant': '#312E81',

        secondary: '#10B981',
        'secondary-container': '#A7F3D0',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#065F46',
        'secondary-fixed': '#A7F3D0',
        'secondary-fixed-dim': '#6EE7B7',
        'on-secondary-fixed': '#022C22',
        'on-secondary-fixed-variant': '#065F46',

        tertiary: '#0F766E',
        'tertiary-container': '#CCFBF1',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#134E4A',
        'tertiary-fixed': '#CCFBF1',
        'tertiary-fixed-dim': '#99F6E4',
        'on-tertiary-fixed': '#042F2E',
        'on-tertiary-fixed-variant': '#115E59',

        error: '#EF4444',
        'on-error': '#ffffff',
        'error-container': '#FEE2E2',
        'on-error-container': '#991B1B',

        // Brand accents (mirrored from web tailwind.config.js)
        maternal: '#F472B6',
        'maternal-light': '#FDF2F8',
        amber: '#F59E0B',
        'amber-light': '#FFFBEB',
        teal: '#10B981',
        'teal-light': '#ECFDF5',

        // Risk rails
        'risk-high': '#EF4444',
        'risk-medium': '#F59E0B',

        // Neutral scale (static — same in both themes)
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          500: '#64748B',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        'display-lg': ['Inter_700Bold'],
        'headline-lg': ['Inter_600SemiBold'],
        'headline-lg-bold': ['Inter_700Bold'],
        'headline-md': ['Inter_600SemiBold'],
        'headline-lg-mobile': ['Inter_700Bold'],
        'body-lg': ['Inter_400Regular'],
        'body-lg-mobile': ['Inter_400Regular'],
        'body-md': ['Inter_400Regular'],
        'body-md-medium': ['Inter_500Medium'],
        'label-md': ['Inter_600SemiBold'],
        'label-sm': ['Inter_500Medium'],
        caption: ['Inter_400Regular'],
      },
      fontSize: {
        'display-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
        'headline-lg': ['24px', { lineHeight: '32px' }],
        'headline-lg-mobile': ['22px', { lineHeight: '28px' }],
        'headline-md': ['20px', { lineHeight: '28px' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        'body-lg-mobile': ['18px', { lineHeight: '26px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'label-md': ['14px', { lineHeight: '20px' }],
        'label-sm': ['12px', { lineHeight: '16px' }],
        caption: ['12px', { lineHeight: '16px' }],
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      spacing: {
        'form-gap': '20px',
        'touch-target': '48px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
        modal: '0 4px 16px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
