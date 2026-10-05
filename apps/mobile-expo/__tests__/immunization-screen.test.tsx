import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import fixture from './fixtures/sync-records.json';
import { getDatabase } from '../src/db/database';

/**
 * The smoke suite mounts this screen with no route params, so it only ever
 * takes the "missing patient" branch. These two tests drive the populated
 * path: real pulled rows through the real SQL, and the mark-as-administered
 * write that has to land in both the local table and the outbox.
 */

let mockParams: Record<string, string> = {};

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

const PAGE = '../app/(app)/patient/[id]/immunization';
const PATIENT_ID = '966c3363-d766-43e7-a1b5-82eeb3a12fea';

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

async function render() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Page = require(PAGE).default;
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(<Page />);
  });

  // The screen loads through async SQLite queries; settle until the rendered
  // output stops changing rather than guessing a number of turns.
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

/** Text rendered anywhere inside a node, for locating tappables by label. */
function subtreeText(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((child) => subtreeText(child as never)).join(' ');
}

function tappable(tree: TestRenderer.ReactTestRenderer, needle: string) {
  return tree.root
    .findAll((node) => typeof node.type !== 'string' && typeof node.props?.onPress === 'function', { deep: true })
    .find((node) => {
      const a11y = node.props?.accessibilityLabel;
      return (typeof a11y === 'string' && a11y.includes(needle)) || subtreeText(node).includes(needle);
    });
}

async function flush(turns: number) {
  for (let attempt = 0; attempt < turns; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

beforeEach(() => {
  mockParams = { id: PATIENT_ID };
});

describe('immunization schedule screen', () => {
  it('renders the pulled schedule for a real patient', async () => {
    const tree = await render();
    const body = text(tree);

    expect(body).toContain('Vaccination Tracking');
    expect(body).toContain('Rekha Sharma');
    expect(body).toContain('Immunization Schedule');
    expect(body).toContain('BCG');
    // Rows already recorded are shown as administered, not as still due.
    expect(body).toContain('Administered');
    // The two future doses carry no mark button until their day arrives.
    expect(body).not.toContain('Mark as Completed');
    expect(body).toContain('Select child');
    expect(body).toContain('View Vaccination Certificate');
    expect(body).toContain('Back to Patient');

    await act(async () => {
      tree.unmount();
    });
  });

  it('marks a due dose as administered locally and queues it for sync', async () => {
    const due = fixture.immunizations.find((row) => row.status === 'due');
    if (!due) throw new Error('fixture needs a due immunization row');

    // Pull the dose into today so the screen shows it in the due state with a
    // mark button, the state a worker sees on the child's due date.
    const db = await getDatabase();
    await db.runAsync('UPDATE immunizations SET due_date = ? WHERE id = ?', todayISO(), due.id);

    const tree = await render();
    const before = text(tree);
    expect(before).toContain('Due: ');
    expect(before).toContain('Mark as Completed');

    const button = tappable(tree, 'Mark as Completed');
    expect(button).toBeDefined();
    await act(async () => {
      button!.props.onPress();
    });
    await flush(15);

    const after = text(tree);
    // The card has flipped to the administered state, so the button is gone.
    expect(after).not.toContain('Mark as Completed');
    expect(after).not.toContain('Due: ');

    const row = await db.getFirstAsync<{ status: string; given_date: string }>(
      'SELECT status, given_date FROM immunizations WHERE id = ?',
      due.id,
    );
    expect(row?.status).toBe('given');
    expect(row?.given_date).toBe(todayISO());

    // A dose recorded in the field must also reach the server eventually.
    const queued = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sync_queue WHERE entity = 'immunizations' AND record_id = ?",
      due.id,
    );
    expect(Number(queued?.n ?? 0)).toBeGreaterThan(0);

    await act(async () => {
      tree.unmount();
    });
  });
});
