import Constants from 'expo-constants';

/**
 * Runtime configuration.
 *
 * `EXPO_PUBLIC_API_URL` is inlined at build time by Expo. A physical device
 * cannot use `localhost` (that resolves to the phone itself), so the LAN
 * address of the development machine is required. See .env.example.
 */
function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const raw = fromEnv && fromEnv.length > 0 ? fromEnv : 'http://localhost:8000/api/v1';

  // Fail loudly at startup rather than silently sending every request to the
  // device itself, which is the most common cause of "cannot connect".
  if (__DEV__ && /localhost|127\.0\.0\.1/.test(raw) && Constants.isDevice) {
    console.warn(
      '[config] EXPO_PUBLIC_API_URL points at localhost but you are on a physical device. ' +
        'Set it to your machine\'s LAN address, e.g. http://192.168.1.10:8000/api/v1',
    );
  }

  return raw.replace(/\/+$/, '');
}

export const config = {
  apiBase: resolveApiBase(),
  pullLimit: 1000,
  /** How long to wait for the network before treating it as usable (ms). */
  netInfoTimeoutMs: 10_000,
} as const;
