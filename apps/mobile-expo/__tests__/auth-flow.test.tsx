import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { tokenStore } from '../src/auth/tokenStore';

/**
 * Drives the auth routes end to end with fetch and the router mocked:
 * login (password), verify-otp, and account recovery. Asserts on the real
 * request bodies so a field rename in the client fails here rather than on a
 * device. Successful login goes straight to the dashboard — there is no
 * post-login interstitial.
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

/**
 * Every screen this file renders is torn down again in afterEach: the OTP
 * screen runs a 1s countdown interval, and a tree that outlives the test file
 * keeps firing it into a torn-down Jest environment.
 */
const mounted: TestRenderer.ReactTestRenderer[] = [];

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
  mounted.push(tree!);
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

afterEach(async () => {
  const trees = mounted.splice(0, mounted.length);
  await act(async () => {
    trees.forEach((tree) => tree.unmount());
  });
});

describe('login', () => {
  it('shows the user-type picker and password login, with no OTP entry', async () => {
    const tree = await render('../app/login');

    expect(rendered(tree)).toContain('Select user type');
    expect(rendered(tree)).toContain('secureTextEntry');
    // The OTP path is gone from the login screen: no send-OTP button.
    expect(() => button(tree, 'send-otp')).toThrow();
  });

  it('posts phone and password to /auth/login and stores the session', async () => {
    const tree = await render('../app/login');

    await press(button(tree, 'login-role-asha'));
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
    // Straight to the worker shell: "/" is the cold-start splash and would hold
    // the artwork again on top of the session login just created.
    expect(router.__router.replace).toHaveBeenCalledWith('/(app)');
    await expect(tokenStore.getAccessToken()).resolves.toBe('access-1');
  });

  it('lands a patient account on the patient dashboard', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string, init?: { body?: string }) => {
      calls.push({ url, body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : undefined });
      if (url.includes('/auth/login')) {
        return respond({
          ...LOGIN_RESPONSE,
          user: { ...LOGIN_RESPONSE.user, id: 'b1', role: 'patient' },
        });
      }
      return respond({ ok: true });
    });
    const tree = await render('../app/login');

    await press(button(tree, 'login-role-patient'));
    await settle(tree);
    await type(input(tree, 'phone-input'), '9876543210');
    await type(input(tree, 'password-input'), 'asha@123');
    await press(button(tree, 'login'));
    await settle(tree);

    expect(router.__router.replace).toHaveBeenCalledWith('/home');
  });

  it('posts once when the sign-in button is pressed twice in the same tick', async () => {
    const tree = await render('../app/login');

    await press(button(tree, 'login-role-asha'));
    await settle(tree);
    await type(input(tree, 'phone-input'), '9876543210');
    await type(input(tree, 'password-input'), 'asha@123');

    // Both presses land before React can re-render the button into its
    // disabled loading state, which is exactly the race the in-flight guard
    // exists for.
    await act(async () => {
      button(tree, 'login').props.onPress();
      button(tree, 'login').props.onPress();
    });
    await settle(tree);

    expect(calls.filter((c) => c.url.includes('/auth/login'))).toHaveLength(1);
    expect(router.__router.replace).toHaveBeenCalledWith('/(app)');
  });

  it('links to account recovery, the only signed-out route into the reset flow', async () => {
    const tree = await render('../app/login');

    await press(button(tree, 'forgot-password'));
    expect(router.__router.push).toHaveBeenCalledWith('/account-recovery');
  });

  it('rejects credentials when they belong to a different user type', async () => {
    const tree = await render('../app/login');

    // Patient selected, but the credentials are the ASHA demo account.
    await press(button(tree, 'login-role-patient'));
    await settle(tree);
    await type(input(tree, 'phone-input'), '9876543210');
    await type(input(tree, 'password-input'), 'asha@123');
    await press(button(tree, 'login'));
    await settle(tree);

    expect(rendered(tree)).toContain('Selected user type does not match this account');
    expect(router.__router.replace).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    // The rejection happens before any session side effect: a wrong pill must
    // not register the device, warm the region cache or reset the offline rows
    // of the account that is already on this device.
    expect(calls.some((c) => c.url.includes('/sync/'))).toBe(false);
  });

  it('surfaces a credential failure inline and as a toast', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async () =>
      respond({ detail: 'Incorrect phone number or password', code: 'unauthorized', status: 401 }, 401),
    );
    const tree = await render('../app/login');

    await press(button(tree, 'login-role-asha'));
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
    expect(router.__router.replace).toHaveBeenCalledWith('/(app)');
  });

  it('verifies once when the button is pressed twice in the same tick', async () => {
    const tree = await render('../app/verify-otp');

    await type(input(tree, 'otp-box-0'), '482913');
    await settle(tree);

    await act(async () => {
      button(tree, 'verify-login').props.onPress();
      button(tree, 'verify-login').props.onPress();
    });
    await settle(tree);

    expect(calls.filter((c) => c.url.includes('/auth/otp/verify'))).toHaveLength(1);
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

  it('requests one code when the button is pressed twice in the same tick', async () => {
    const tree = await render('../app/account-recovery');

    await type(input(tree, 'recovery-phone'), '9876543210');
    await act(async () => {
      button(tree, 'request-reset').props.onPress();
      button(tree, 'request-reset').props.onPress();
    });
    await settle(tree);

    expect(calls.filter((c) => c.url.includes('/auth/otp/send'))).toHaveLength(1);
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
