import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { tokenStore } from '../src/auth/tokenStore';

/**
 * Drives the four auth routes end to end with fetch and the router mocked:
 * login (OTP + password), verify-otp, account recovery, and the redirecting
 * interstitial. Asserts on the real request bodies so a field rename in the
 * client fails here rather than on a device.
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
  let params: Record<string, string> = {};
  return {
    __router: router,
    __setParams: (next: Record<string, string>) => {
      params = next;
    },
    useRouter: () => router,
    useLocalSearchParams: () => params,
    useGlobalSearchParams: () => params,
    usePathname: () => '/',
    useSegments: () => [],
    useFocusEffect: () => {},
    useIsFocused: () => true,
    Redirect: () => null,
    Link: ({ children }: { children: unknown }) => children,
    Stack: () => null,
    Tabs: () => null,
  };
});

type FetchCall = { url: string; body: Record<string, unknown> | undefined };

const LOGIN_RESPONSE = {
  tokens: { access_token: 'access-1', refresh_token: 'refresh-1', token_type: 'bearer', expires_in: 1800 },
  user: { id: 'u1', phone: '9876543210', full_name: 'Sunita Devi', role: 'asha', language: 'hi' },
};

const SEND_RESPONSE = {
  message: 'OTP sent to 9876543210 (dev otp: 001234). Login bypass (OTP 1234): 9876543210->asha',
};

let calls: FetchCall[] = [];

function respond(payload: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    text: async () => JSON.stringify(payload),
  };
}

function installFetch() {
  const fetchMock = jest.fn(async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : undefined });
    if (url.includes('/auth/otp/send')) return respond(SEND_RESPONSE);
    if (url.includes('/auth/otp/verify')) return respond(LOGIN_RESPONSE);
    if (url.includes('/auth/login')) return respond(LOGIN_RESPONSE);
    return respond({ ok: true });
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

async function render(file: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Page = require(file).default;
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(<Page />);
  });
  await settle(tree!);
  return tree!;
}

async function settle(tree: TestRenderer.ReactTestRenderer) {
  let previous = '';
  for (let attempt = 0; attempt < 25; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const current = JSON.stringify(tree.toJSON());
    if (current === previous) break;
    previous = current;
  }
}

const rendered = (tree: TestRenderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

function subtreeText(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((child) => subtreeText(child as never)).join(' ');
}

function input(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const found = tree.root.findAll(
    (node) => node.props?.testID === testID && typeof node.props?.onChangeText === 'function',
    { deep: true },
  )[0];
  if (!found) throw new Error(`no input with testID ${testID}`);
  return found;
}

function button(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const found = tree.root.findAll(
    (node) => node.props?.testID === testID && typeof node.props?.onPress === 'function',
    { deep: true },
  )[0];
  if (!found) throw new Error(`no button with testID ${testID}`);
  return found;
}

function pressableByLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  return tree.root
    .findAll((node) => typeof node.type !== 'string' && typeof node.props?.onPress === 'function', { deep: true })
    .find((node) => subtreeText(node).includes(label));
}

function roleTile(tree: TestRenderer.ReactTestRenderer, key: string) {
  const found = tree.root.findAll(
    (node) => node.props?.testID === `role-${key}` && typeof node.props?.className === 'string',
    { deep: true },
  )[0];
  if (!found) throw new Error(`no role tile ${key}`);
  return found;
}

async function press(node: TestRenderer.ReactTestInstance) {
  await act(async () => {
    node.props.onPress();
  });
}

async function type(node: TestRenderer.ReactTestInstance, value: string) {
  await act(async () => {
    node.props.onChangeText(value);
  });
}

const router = jest.requireMock('expo-router') as {
  __router: { push: jest.Mock; replace: jest.Mock; back: jest.Mock };
  __setParams: (params: Record<string, string>) => void;
};

beforeEach(() => {
  calls = [];
  installFetch();
  router.__router.push.mockClear();
  router.__router.replace.mockClear();
  router.__router.back.mockClear();
  router.__setParams({});
});

describe('login', () => {
  it('sends an OTP and opens the verification screen', async () => {
    const tree = await render('../app/login');

    expect(rendered(tree)).toContain('Send OTP');
    await type(input(tree, 'phone-input'), '9876543210');
    await press(button(tree, 'send-otp'));
    await settle(tree);

    expect(calls.find((c) => c.url.includes('/auth/otp/send'))?.body).toEqual({ phone: '9876543210' });
    expect(calls.some((c) => c.url.includes('/auth/login'))).toBe(false);

    // The dev OTP is handed forward so it can be shown on the next screen.
    expect(router.__router.push).toHaveBeenCalledWith({
      pathname: '/verify-otp',
      params: { phone: '9876543210', devOtp: '001234' },
    });
  });

  it('posts phone and password to /auth/login and stores the session', async () => {
    const tree = await render('../app/login');

    await press(pressableByLabel(tree, 'Login with password')!);
    await settle(tree);
    expect(rendered(tree)).toContain('secureTextEntry');

    await type(input(tree, 'phone-input'), '9876543210');
    await type(input(tree, 'password-input'), 'asha@123');
    await press(button(tree, 'login'));
    await settle(tree);

    const loginCall = calls.find((c) => c.url.includes('/auth/login'));
    expect(loginCall).toBeDefined();
    expect(loginCall!.body).toMatchObject({ phone: '9876543210', password: 'asha@123' });
    expect(calls.some((c) => c.url.includes('/auth/otp'))).toBe(false);
    expect(router.__router.replace).toHaveBeenCalledWith('/redirecting');
    await expect(tokenStore.getAccessToken()).resolves.toBe('access-1');
  });

  it('surfaces a credential failure inline and as a toast', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async () =>
      respond({ detail: 'Incorrect phone number or password', code: 'unauthorized', status: 401 }, 401),
    );
    const tree = await render('../app/login');

    await press(pressableByLabel(tree, 'Login with password')!);
    await settle(tree);
    await type(input(tree, 'phone-input'), '9876543210');
    await type(input(tree, 'password-input'), 'wrong-password');
    await press(button(tree, 'login'));
    await settle(tree);

    expect(rendered(tree)).toContain('Incorrect phone number or password');
    expect(router.__router.replace).not.toHaveBeenCalled();
  });
});

describe('verify-otp', () => {
  beforeEach(() => {
    router.__setParams({ phone: '9876543210', devOtp: '001234' });
  });

  it('masks the phone and shows the dev code', async () => {
    const tree = await render('../app/verify-otp');
    const body = rendered(tree);
    expect(body).toContain('+91 ******210');
    expect(body).toContain('001234');
    expect(body).toMatch(/00:\d{2}/);
  });

  it('auto-advances across the six boxes and verifies the typed code', async () => {
    const tree = await render('../app/verify-otp');

    const digits = '482913';
    for (let index = 0; index < digits.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await type(input(tree, `otp-box-${index}`), digits[index]!);
    }
    // Focus moved with the typing, which is what the border tokens show.
    expect(input(tree, 'otp-box-5').props.className).toContain('border-primary');

    await press(button(tree, 'verify-login'));
    await settle(tree);

    const verifyCall = calls.find((c) => c.url.includes('/auth/otp/verify'));
    expect(verifyCall).toBeDefined();
    expect(verifyCall!.body).toMatchObject({ phone: '9876543210', otp: '482913' });
    expect(router.__router.replace).toHaveBeenCalledWith('/redirecting');
  });

  it('accepts a whole code pasted into the first box', async () => {
    const tree = await render('../app/verify-otp');

    await type(input(tree, 'otp-box-0'), '654321');
    await settle(tree);
    expect(input(tree, 'otp-box-5').props.value).toBe('1');

    await press(button(tree, 'verify-login'));
    await settle(tree);

    expect(calls.find((c) => c.url.includes('/auth/otp/verify'))?.body).toMatchObject({ otp: '654321' });
  });

  it('walks focus back and clears the previous box on backspace', async () => {
    const tree = await render('../app/verify-otp');

    await type(input(tree, 'otp-box-0'), '7');
    await type(input(tree, 'otp-box-1'), '8');
    expect(input(tree, 'otp-box-1').props.value).toBe('8');

    // Empty box 2 receives the Backspace key, which clears box 1.
    await act(async () => {
      input(tree, 'otp-box-2').props.onKeyPress({ nativeEvent: { key: 'Backspace' } });
    });
    await settle(tree);

    expect(input(tree, 'otp-box-1').props.value).toBe('');
    expect(input(tree, 'otp-box-1').props.className).toContain('border-primary');
  });

  it('rejects a short code with an inline message and no network call', async () => {
    const tree = await render('../app/verify-otp');

    await type(input(tree, 'otp-box-0'), '1');
    await press(button(tree, 'verify-login'));
    await settle(tree);

    expect(calls.some((c) => c.url.includes('/auth/otp/verify'))).toBe(false);
    expect(rendered(tree)).toContain('Please enter all 6 digits of the code.');
  });
});

describe('account-recovery', () => {
  it('drives recovery through /auth/otp/send and shows the success state', async () => {
    const tree = await render('../app/account-recovery');

    expect(rendered(tree)).toContain('Account Recovery');
    await type(input(tree, 'recovery-phone'), '9876543210');
    await press(button(tree, 'request-reset'));
    await settle(tree);

    expect(calls.find((c) => c.url.includes('/auth/otp/send'))?.body).toEqual({ phone: '9876543210' });
    expect(calls.some((c) => c.url.includes('/auth/login'))).toBe(false);

    const body = rendered(tree);
    expect(body).toContain('Check your messages');
    expect(body).toContain('+91 ******210');

    await press(button(tree, 'continue-otp'));
    expect(router.__router.push).toHaveBeenCalledWith({
      pathname: '/verify-otp',
      params: { phone: '9876543210', devOtp: '001234' },
    });
  });

  it('reports an unknown number without leaving the screen', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async () =>
      respond({ detail: 'No active user found for this phone number', code: 'not_found', status: 404 }, 404),
    );
    const tree = await render('../app/account-recovery');

    await type(input(tree, 'recovery-phone'), '9000000000');
    await press(button(tree, 'request-reset'));
    await settle(tree);

    expect(rendered(tree)).toContain('No active account found for this mobile number.');
    expect(router.__router.push).not.toHaveBeenCalled();
  });
});

describe('redirecting', () => {
  it('locks onto the ASHA role and routes into the app', async () => {
    const tree = await render('../app/redirecting');
    expect(rendered(tree)).toContain('Authenticating Identity');
    expect(rendered(tree)).toContain('Admin');

    // The mock scans for 2.5s before it resolves the role.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2700));
    });
    const resolved = rendered(tree);
    expect(resolved).toContain('Welcome, ASHA Worker');
    expect(roleTile(tree, 'asha').props.className).toContain('bg-primary-container');
    expect(roleTile(tree, 'admin').props.className).toContain('opacity-20');
    expect(router.__router.replace).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    expect(router.__router.replace).toHaveBeenCalledWith('/');

    await act(async () => {
      tree.unmount();
    });
  });
});
