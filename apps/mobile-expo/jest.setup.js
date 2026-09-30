/* eslint-env jest */
/**
 * Test environment shims.
 *
 * Everything mocked here is a native module that has no JS implementation
 * under Jest. The point of the smoke tests is to mount each screen, so the
 * substitutes only need to be shaped correctly, not to be faithful.
 */

// --- expo-router ---------------------------------------------------------
jest.mock('expo-router', () => {
  const React = require('react');
  const noop = () => {};
  return {
    useRouter: () => ({
      push: noop,
      replace: noop,
      back: noop,
      navigate: noop,
      setParams: noop,
      canGoBack: () => true,
    }),
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
    usePathname: () => '/',
    useSegments: () => [],
    useFocusEffect: (effect) => React.useEffect(() => effect(), [effect]),
    useIsFocused: () => true,
    // Rendered as a marker rather than null so a test can tell "this page
    // decided to redirect" apart from "this page rendered nothing".
    Redirect: ({ href }) => React.createElement('RedirectMarker', { href }),
    Link: ({ children }) => children,
    Stack: Object.assign(() => null, { Screen: () => null }),
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

// --- expo-sqlite ---------------------------------------------------------
// Backed by a real in-memory SQLite database (Node's node:sqlite) loaded with
// the app's own DDL and a dataset captured from a live `POST /sync/pull`. The
// app's SQL therefore runs for real: a broken JOIN, a bad column or a syntax
// error fails these tests instead of passing silently.
const mockSql = require('./mock-sqlite');

global.__setSqlResult = (statement, rows) => mockSql.setOverride(statement, rows);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async (statement) => mockSql.exec(statement)),
    runAsync: jest.fn(async (statement, ...params) => mockSql.run(statement, params)),
    getAllAsync: jest.fn(async (statement, ...params) => mockSql.all(statement, params)),
    getFirstAsync: jest.fn(async (statement, ...params) => mockSql.first(statement, params)),
    withTransactionAsync: jest.fn(async (fn) => mockSql.transaction(fn)),
    withExclusiveTransactionAsync: jest.fn(async (fn) => mockSql.transaction(fn)),
    closeAsync: jest.fn(async () => {}),
  })),
  deleteDatabaseAsync: jest.fn(async () => {}),
}));
global.__sql = mockSql;

// --- secure store --------------------------------------------------------
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
  };
});

// --- safe area -----------------------------------------------------------
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 24, right: 0, bottom: 16, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children }) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets: inset, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

// --- network watcher -----------------------------------------------------
// Real connectivity would leave a live listener attached to every mounted
// screen and keep the Jest event loop open.
jest.mock('@/sync/network', () => ({
  startNetworkWatcher: jest.fn(() => () => {}),
  stopNetworkWatcher: jest.fn(),
  scheduleSync: jest.fn(),
  syncNow: jest.fn(async () => ({
    ok: true, pushed: 0, conflicts: 0, failed: 0, pulled: 0, hasMore: false, error: null, partial: false,
  })),
  isCurrentlyOnline: jest.fn(() => true),
  subscribeOnline: jest.fn(() => () => {}),
  subscribeSync: jest.fn(() => () => {}),
}));

// --- reanimated / worklets ----------------------------------------------
// Reanimated 4 resolves a native worklets module at import time, which does not
// exist under Jest, and its own `mock` entry point still loads that graph. So
// reanimated is replaced with a hand-written stub covering exactly what
// src/theme.ts imports. Screens only use these to build decorative animations,
// so resolving to the plain target value is enough to render.
jest.mock('react-native-reanimated', () => {
  const identity = (to) => to;
  return {
    __esModule: true,
    default: { call: () => {}, value: 0 },
    Easing: {
      linear: (t) => t,
      ease: (t) => t,
      inOut: (fn) => fn,
      out: (fn) => fn,
      in: (fn) => fn,
      bezier: () => (t) => t,
    },
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (fn) => (typeof fn === 'function' ? fn() : {}),
    useAnimatedProps: (fn) => (typeof fn === 'function' ? fn() : {}),
    useDerivedValue: (fn) => ({ value: fn() }),
    withRepeat: (animation) => animation,
    withSequence: (...animations) => animations[animations.length - 1],
    withDelay: (_delay, animation) => animation,
    withSpring: identity,
    withTiming: identity,
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
  };
});

// --- async storage -------------------------------------------------------
// Ships its own jest mock; used by the i18n locale persistence and the auth
// session cache.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US', regionCode: 'US' }],
  getCalendars: () => [],
}));

// --- haptics -------------------------------------------------------------
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// The splash is prevented at import time by the root layout.
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));

jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
  loadAsync: jest.fn(async () => {}),
  isLoaded: jest.fn(() => true),
}));

// Silence the animation frame warnings Reanimated emits when unmounted.
jest.spyOn(console, 'warn').mockImplementation((...args) => {
  const first = String(args[0] ?? '');
  if (/useNativeDriver|Animated|deprecated|componentWillReceiveProps/.test(first)) return;
  // eslint-disable-next-line no-console
  console.info(...args);
});
