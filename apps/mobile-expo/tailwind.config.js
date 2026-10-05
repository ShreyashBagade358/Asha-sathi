/**
 * Mirrors apps/web-dashboard/tailwind.config.js so the mobile app renders the
 * exact same Material 3 palette and type scale the dashboard actually ships.
 *
 * The web repo also carries packages/design-system/tokens/design-tokens.json
 * (a teal / Public Sans theme) - that file is orphaned and is NOT what the web
 * UI uses. The hexes below are the rendered source of truth.
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
  theme: {
    extend: {
      colors: {
        primary: '#003267',
        'primary-container': '#005eb8',
        'on-primary': '#ffffff',
        'on-primary-container': '#c8daff',
        'primary-fixed': '#d6e3ff',
        'primary-fixed-dim': '#a9c7ff',
        'on-primary-fixed': '#001b3d',
        'on-primary-fixed-variant': '#00468c',
        secondary: '#006e28',
        'secondary-container': '#82fc90',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#00752a',
        'secondary-fixed': '#82fc90',
        'secondary-fixed-dim': '#65df77',
        'on-secondary-fixed': '#002107',
        'on-secondary-fixed-variant': '#00531c',
        tertiary: '#004e61',
        'tertiary-container': '#006880',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#9be4ff',
        'tertiary-fixed': '#b6ebff',
        'tertiary-fixed-dim': '#57d5fc',
        'on-tertiary-fixed': '#001f28',
        'on-tertiary-fixed-variant': '#004e60',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        surface: '#f9f9ff',
        'surface-dim': '#cadbfc',
        'surface-bright': '#f9f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f0f3ff',
        'surface-container': '#e7eeff',
        'surface-container-high': '#dfe8ff',
        'surface-container-highest': '#d6e3ff',
        'on-surface': '#091c35',
        'on-surface-variant': '#424752',
        'inverse-surface': '#20314b',
        'inverse-on-surface': '#ecf0ff',
        'inverse-primary': '#a9c7ff',
        outline: '#727783',
        'outline-variant': '#c2c6d4',
        'surface-tint': '#005db6',
        background: '#f9f9ff',
        'on-background': '#091c35',
        // Risk rails. The web hardcodes these in index.css as
        // .risk-strip-high / -medium rather than in the palette.
        'risk-high': '#7b0000',
        'risk-medium': '#f59e0b',
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
