import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { apiRequest } from '../src/auth/api';
import { tokenStore } from '../src/auth/tokenStore';

/**
 * Session expiry has two halves: apiRequest drops the tokens, the root layout
 * is what turns that into a logout. Mounting the real root layout is the only
 * way to catch a wiring that compiles but never navigates - a worker would
 * otherwise sit in a shell whose every request is failing underneath them.
 */

jest.mock('expo-router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  const noop = () => {};
  return {
    __router: router,
    router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
    usePathname: () => '/',
    useSegments: () => [],
    useFocusEffect: noop,
    useIsFocused: () => true,
    Redirect: () => null,
    Link: ({ children }: { children: React.ReactNode }) => children,
    Stack: Object.assign(() => null, { Screen: () => null }),
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock } }).__router;

function respond(payload: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  };
}

function installExpiredSession() {
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string) => {
    if (url.includes('/auth/token/refresh')) return respond({ detail: 'Invalid or expired refresh token' }, 401);
    return respond({ detail: 'unauthorized' }, 401);
  });
}

async function settle(tree?: TestRenderer.ReactTestRenderer) {
  let previous = '';
  for (let attempt = 0; attempt < 25; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const current = JSON.stringify(tree?.toJSON());
    if (current === previous) break;
    previous = current;
  }
}

async function mountRootLayout() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Root = require('../app/_layout').default;
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(<Root />);
  });
  await settle(tree);
  return tree!;
}

async function expireSession() {
  installExpiredSession();
  await tokenStore.save({ accessToken: 'stale-access', refreshToken: 'stale-refresh' });
  await act(async () => {
    await apiRequest('/sync/status').catch(() => undefined);
  });
}

describe('root layout session expiry', () => {
  beforeEach(() => {
    router.replace.mockClear();
  });

  afterEach(async () => {
    await tokenStore.clear();
  });

  it('mounts with the expiry watcher subscribed', async () => {
    const tree = await mountRootLayout();
    await expireSession();

    expect(router.replace).toHaveBeenCalledWith('/login');
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();

    await act(async () => {
      tree.unmount();
    });
  });

  it('stops navigating once the layout is unmounted', async () => {
    const tree = await mountRootLayout();
    await act(async () => {
      tree.unmount();
    });

    router.replace.mockClear();
    await expireSession();

    expect(router.replace).not.toHaveBeenCalled();
  });
});
