import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

let mockParams: Record<string, string> = {};
const mockReplace = jest.fn();

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  const noop = () => {};
  return {
    useRouter: () => ({
      push: noop,
      replace: mockReplace,
      back: noop,
      navigate: noop,
      setParams: noop,
      canGoBack: () => true,
    }),
    useLocalSearchParams: () => mockParams,
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

const PAGE = '../app/(app)/checkup-completed';
const PATIENT_ID = '966c3363-d766-43e7-a1b5-82eeb3a12fea';

async function render() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Page = require(PAGE).default;
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(<Page />);
  });
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
  return tree!;
}

const text = (tree: TestRenderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

function subtreeText(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((child) => subtreeText(child as never)).join(' ');
}

function tappable(tree: TestRenderer.ReactTestRenderer, needle: string) {
  return tree.root
    .findAll((node) => typeof node.type !== 'string' && typeof node.props?.onPress === 'function', { deep: true })
    .find((node) => subtreeText(node).includes(needle));
}

async function unmount(tree: TestRenderer.ReactTestRenderer) {
  await act(async () => {
    tree.unmount();
  });
}

beforeEach(() => {
  mockParams = {};
  mockReplace.mockClear();
});

describe('check-up completed screen', () => {
  it('renders the risk callout, the passed next visit date and the summary tiles', async () => {
    mockParams = { risk: 'High-Risk Pregnancy', nextVisit: '2026-10-24', patientId: PATIENT_ID };
    const tree = await render();
    const body = text(tree);

    expect(body).toContain('Registration Complete');
    expect(body).toContain('Health check-up data has been successfully recorded.');
    expect(body).toContain('Risk Indicator');
    expect(body).toContain('High-Risk Pregnancy');
    expect(body).not.toContain('No risk indicators recorded on this visit.');

    expect(body).toContain('Next Visit');
    expect(body).toContain('Oct 24');
    expect(body).toContain('Data Status');
    expect(body).toMatch(/Saved offline · will sync|Synced/);

    expect(body).toContain('Go to Dashboard');
    expect(body).toContain('View Patient Profile');

    await unmount(tree);
  });

  it('falls back to the neutral callout and the scheduled-visit placeholder', async () => {
    mockParams = {};
    const tree = await render();
    const body = text(tree);

    expect(body).toContain('Risk Screening');
    expect(body).toContain('No risk indicators recorded on this visit.');
    expect(body).not.toContain('Risk Indicator');
    expect(body).not.toContain('High-Risk Pregnancy');
    expect(body).toContain('To be scheduled');
    expect(body).not.toContain('Oct 24');

    await unmount(tree);
  });

  it('routes both CTAs, opening the patient only when a real id was passed', async () => {
    mockParams = { patientId: PATIENT_ID };
    const withPatient = await render();

    await act(async () => {
      tappable(withPatient, 'Go to Dashboard')!.props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith('/');

    await act(async () => {
      tappable(withPatient, 'View Patient Profile')!.props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith(`/patient/${PATIENT_ID}`);
    await unmount(withPatient);

    mockReplace.mockClear();
    mockParams = {};
    const withoutPatient = await render();

    await act(async () => {
      tappable(withoutPatient, 'View Patient Profile')!.props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith('/patients');
    expect(mockReplace).toHaveBeenCalledTimes(1);
    await unmount(withoutPatient);
  });
});
