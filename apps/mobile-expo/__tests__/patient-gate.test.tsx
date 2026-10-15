import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { tokenStore } from '../src/auth/tokenStore';

/**
 * Role isolation for the patient group: the layout is the only thing standing
 * between a worker session and the patient tab bar, so each destination is
 * asserted here rather than only through the redirect call in login.
 */

jest.mock('expo-router', () => {
  const ReactModule = require('react');
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
    useFocusEffect: (effect: () => void) => ReactModule.useEffect(() => effect(), [effect]),
    useIsFocused: () => true,
    Redirect: ({ href }: { href: string }) => ReactModule.createElement('RedirectMarker', { href }),
    Link: ({ children }: { children: React.ReactNode }) => children,
    Stack: () => ReactModule.createElement('StackMarker'),
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

const PAGE = '../app/(patient)/_layout';

async function render() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Page = require(PAGE).default;
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(<Page />);
  });
  for (let attempt = 0; attempt < 25; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  return tree!;
}

function marker(tree: TestRenderer.ReactTestRenderer, name: string): string | undefined {
  const found = tree.root.findAll((node) => node.type === name, { deep: true });
  if (found.length === 0) return undefined;
  const href = found[0]?.props.href;
  return typeof href === 'string' ? href : name;
}

async function signIn(role: 'asha' | 'patient') {
  await tokenStore.save({
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    user: {
      id: role === 'patient' ? 'ben-1' : 'asha-1',
      phone: '9876543210',
      full_name: 'Test User',
      role,
      language: 'en',
    },
  });
}

describe('(patient)/_layout role gate', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await tokenStore.clear();
  });

  it('sends a signed-out visitor to /login', async () => {
    await tokenStore.clear();
    const tree = await render();
    expect(marker(tree, 'RedirectMarker')).toBe('/login');
  });

  it('bounces an ASHA session back to the worker shell', async () => {
    await signIn('asha');
    const tree = await render();
    expect(marker(tree, 'RedirectMarker')).toBe('/');
    expect(marker(tree, 'StackMarker')).toBeUndefined();
  });

  it('mounts the patient stack for a patient session', async () => {
    await signIn('patient');
    const tree = await render();
    expect(marker(tree, 'RedirectMarker')).toBeUndefined();
    expect(marker(tree, 'StackMarker')).toBe('StackMarker');
  });

  it('falls back to /login when the session cannot be read', async () => {
    // A keystore failure used to reject out of the gate's effect: no catch,
    // so the spinner never resolved and the rejection was unhandled.
    jest.spyOn(tokenStore, 'getAccessToken').mockRejectedValue(new Error('keystore unavailable'));
    const tree = await render();
    expect(marker(tree, 'RedirectMarker')).toBe('/login');
  });
});
