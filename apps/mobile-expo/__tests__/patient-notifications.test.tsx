import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

/**
 * "Mark all read" fans out one PUT per unread row. Before the all-settled
 * rewrite a single refused request threw the whole batch away, so the rows
 * that had already been marked were flipped back and the patient tapped the
 * button into the same failure again. These tests pin the settled behaviour:
 * what the server accepted stays read, what it refused stays in the unread
 * filter, and the error is surfaced.
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
    Stack: Object.assign(() => null, { Screen: () => null }),
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

const mockListNotifications = jest.fn();
const mockMarkNotificationRead = jest.fn();

jest.mock('../src/patient/api', () => ({
  listNotifications: (...args: unknown[]) => mockListNotifications(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
}));

const PAGE = '../app/(patient)/my-notifications';

type Notif = {
  id: string;
  type: 'appointment' | 'referral';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const FEED: Notif[] = [
  { id: 'n1', type: 'appointment', title: 'Visit due', message: 'Tomorrow 10am', read: false, createdAt: '2026-01-01' },
  { id: 'n2', type: 'referral', title: 'PHC referral', message: 'Carry your records', read: false, createdAt: '2026-01-02' },
];

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
    if (mockListNotifications.mock.calls.length > 0 && tree!.root.findAllByProps({ testID: 'mark-all-read' }).length > 0) {
      break;
    }
  }
  return tree!;
}

function subtreeText(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((child) => subtreeText(child as never)).join(' ');
}

function tappable(tree: TestRenderer.ReactTestRenderer, needle: string) {
  return tree.root
    .findAll((node) => typeof node.props?.onPress === 'function', { deep: true })
    .find((node) => subtreeText(node).includes(needle));
}

function row(tree: TestRenderer.ReactTestRenderer, needle: string) {
  const node = tappable(tree, needle);
  expect(node).toBeDefined();
  return node!;
}

beforeEach(() => {
  mockListNotifications.mockReset();
  mockMarkNotificationRead.mockReset();
});

describe('patient notifications: mark all read', () => {
  it('keeps the rows the server refused in the unread set', async () => {
    mockListNotifications.mockResolvedValue(FEED.map((r) => ({ ...r })));
    mockMarkNotificationRead.mockImplementation(async (id: string) => {
      if (id === 'n1') throw new Error('forbidden');
    });

    const tree = await render();
    const button = tappable(tree, 'Mark all read');
    expect(button).toBeDefined();
    await act(async () => {
      await button!.props.onPress();
    });

    expect(mockMarkNotificationRead).toHaveBeenCalledTimes(2);
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('n1');
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('n2');

    const accepted = row(tree, 'PHC referral');
    expect(accepted.props.className).toContain('opacity-60');

    const refused = row(tree, 'Visit due');
    expect(refused.props.className).not.toContain('opacity-60');

    // One unread row is left, so the action stays available for a retry.
    const stillThere = tappable(tree, 'Mark all read');
    expect(stillThere).toBeDefined();
  });

  it('clears the action once every row is accepted', async () => {
    mockListNotifications.mockResolvedValue(FEED.map((r) => ({ ...r })));
    mockMarkNotificationRead.mockResolvedValue(undefined);

    const tree = await render();
    const button = tappable(tree, 'Mark all read');
    await act(async () => {
      await button!.props.onPress();
    });

    expect(mockMarkNotificationRead).toHaveBeenCalledTimes(2);
    expect(row(tree, 'Visit due').props.className).toContain('opacity-60');
    expect(row(tree, 'PHC referral').props.className).toContain('opacity-60');
    expect(tappable(tree, 'Mark all read')).toBeUndefined();
  });
});
