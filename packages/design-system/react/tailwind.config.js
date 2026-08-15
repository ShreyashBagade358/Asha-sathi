export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#006565',
        primaryContainer: '#008080',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#e3fffe',
        secondary: '#ac3509',
        secondaryContainer: '#fe6f42',
        onSecondaryContainer: '#631800',
        tertiary: '#156820',
        tertiaryContainer: '#338236',
        onTertiaryContainer: '#ebffe3',
        surface: '#f9f9f7',
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#f4f4f2',
        surfaceContainer: '#eeeeec',
        surfaceContainerHigh: '#e8e8e6',
        surfaceContainerHighest: '#e2e3e1',
        onSurface: '#1a1c1b',
        onSurfaceVariant: '#3e4949',
        outline: '#6e7979',
        outlineVariant: '#bdc9c8',
        error: '#ba1a1a',
        errorContainer: '#ffdad6',
        onErrorContainer: '#93000a'
      },
      fontFamily: {
        sans: ['"Public Sans"', 'sans-serif']
      },
      spacing: {
        touch: '48px',
        marginMobile: '20px',
        stackSm: '8px',
        stackMd: '16px',
        stackLg: '24px',
        stackXl: '32px'
      }
    }
  }
};
