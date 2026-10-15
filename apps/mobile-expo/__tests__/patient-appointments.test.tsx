import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

/**
 * The patient appointments screen used to render follow-ups read-only, while
 * the web's PatientAppointmentsPage has a "Mark done" that closes one through
 * the store. The screen now calls the same `mockSetFollowUpDone` the ASHA list
 * uses - SQLite plus the outbox - so these tests pin that the button writes,
 * drops the row from the list, and leaves it alone when the write fails.
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

const mockListFollowUps = jest.fn();
const mockSetFollowUpDone = jest.fn();
const mockListAppointments = jest.fn();

jest.mock('../src/db/clinical', () => ({
  listFollowUps: (...args: unknown[]) => mockListFollowUps(...args),
  setFollowUpDone: (...args: unknown[]) => mockSetFollowUpDone(...args),
}));

jest.mock('../src/patient/appointments', () => ({
  listAppointments: (...args: unknown[]) => mockListAppointments(...args),
}));

const PAGE = '../app/(patient)/appointments';

const FOLLOW_UP = {
  id: 'referral:r1',
  kind: 'referral' as const,
  patient_name: 'Asha Devi',
  household_hhid: 'H1',
  title: 'Antenatal care',
  detail: 'ANC visit 3',
  due_date: '2026-01-15',
  urgency: 'medium',
  status: 'pending',
};

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
    if (
      mockListFollowUps.mock.calls.length > 0 &&
      JSON.stringify(tree!.toJSON()).includes('Antenatal care')
    ) {
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

beforeEach(() => {
  mockListFollowUps.mockReset();
  mockSetFollowUpDone.mockReset();
  mockListAppointments.mockReset();
  mockListAppointments.mockResolvedValue([]);
});

describe('patient appointments: follow-up status', () => {
  it('closes a follow-up through mockSetFollowUpDone and drops the row', async () => {
    mockListFollowUps.mockResolvedValue([FOLLOW_UP]);
    mockSetFollowUpDone.mockResolvedValue(undefined);

    const tree = await render();
    const button = tappable(tree, 'Mark Done');
    expect(button).toBeDefined();

    await act(async () => {
      await button!.props.onPress();
    });

    expect(mockSetFollowUpDone).toHaveBeenCalledWith(FOLLOW_UP, true);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(JSON.stringify(tree.toJSON())).not.toContain('Antenatal care');
  });

  it('leaves the row in place when the write fails', async () => {
    mockListFollowUps.mockResolvedValue([FOLLOW_UP]);
    mockSetFollowUpDone.mockRejectedValue(new Error('database is locked'));

    const tree = await render();
    const button = tappable(tree, 'Mark Done');
    await act(async () => {
      await button!.props.onPress();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockSetFollowUpDone).toHaveBeenCalledWith(FOLLOW_UP, true);
    expect(JSON.stringify(tree.toJSON())).toContain('Antenatal care');
  });
});
