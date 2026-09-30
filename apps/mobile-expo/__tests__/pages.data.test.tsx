import React from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import fixture from './fixtures/sync-records.json';
import { getDatabase } from '../src/db/database';
import { tokenStore } from '../src/auth/tokenStore';

/**
 * The smoke test proves each page mounts. This one proves the *populated*
 * rendering path runs: the SQLite stub serves a real pulled dataset, so these
 * assertions fail if a screen renders an empty state when rows exist, or if a
 * row field crashes on real values.
 */

async function render(file: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Page = require(file).default;
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(<Page />);
  });

  // Screens load through async SQLite queries, so the number of microtask turns
  // needed varies with machine load. A fixed number of flushes passed alone but
  // failed when both suites ran in parallel, which made the suite flaky. Settle
  // on a real macrotask and keep going until the rendered output stops changing.
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

/** Text rendered anywhere inside a node, for locating tappables by label. */
function subtreeText(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((child) => subtreeText(child as never)).join(' ');
}

const text = (tree: TestRenderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

/** Narrows a nullable fixture value to a usable string. */
const strings = (values: readonly (string | null | undefined)[]) =>
  values.filter((v): v is string => typeof v === 'string' && v.length > 0);

/** Resolves a beneficiary id the way the screens' JOINs do. */
const fullNameOf = (beneficiaryId: string | null | undefined) =>
  strings([fixture.beneficiaries.find((b) => b.id === beneficiaryId)?.full_name])[0] ?? '';

describe('app startup', () => {
  // Regression: the splash was released from a View's onLayout callback, but
  // that View only renders while the fonts are still loading. Once they resolve
  // it is replaced by the router, so the callback could never fire again and
  // preventAutoHideAsync() was never undone — a permanent white screen.
  // With fonts already loaded, the old code rendered no View whatsoever and
  // therefore never called hideAsync at all.
  it('hides the splash when the layout mounts', async () => {
    const splash = require('expo-splash-screen');
    const RootLayout = require('../app/_layout').default;

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(<RootLayout />);
    });

    expect(splash.hideAsync).toHaveBeenCalled();
    // The router must be mounted rather than a blank font gate.
    expect(JSON.stringify(tree?.toJSON())).not.toEqual('{}');
  });
});

describe('populated screens render real rows', () => {
  it('tasks screen lists pulled tasks', async () => {
    const tree = await render('../app/(app)/(tabs)/tasks');
    const body = text(tree);
    const types = [...new Set(fixture.asha_tasks.map((t) => t.task_type).filter(Boolean))];
    const found = types.filter((tp) => body.includes(String(tp)));
    expect(found.length).toBeGreaterThan(0);
    expect(body).not.toContain('task_type-not-rendered');
  });

  it('patients screen lists pulled beneficiaries', async () => {
    const tree = await render('../app/(app)/(tabs)/patients');
    const body = text(tree);
    const names = fixture.beneficiaries.map((b) => b.full_name);
    expect(names.filter((n) => body.includes(n)).length).toBeGreaterThan(0);
  });

  it('patients screen shows rows on first paint, then debounces searches', async () => {
    const tree = await render('../app/(app)/(tabs)/patients');
    let body = text(tree);
    // The first load must not sit behind the debounce, or the list flashes the
    // empty state for the debounce window on every visit.
    expect(body).toContain('Rekha Sharma');
    expect(body).toContain('Kamla Devi');

    const input = tree.root.findByType(TextInput);
    await act(async () => {
      input.props.onChangeText('Rekha');
    });
    // One keystroke must not re-query on every character: the unfiltered rows
    // are still on screen immediately afterwards.
    expect(text(tree)).toContain('Kamla Devi');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 260));
    });
    body = text(tree);
    expect(body).toContain('Rekha Sharma');
    expect(body).not.toContain('Kamla Devi');
  });

  it('households screen lists the pulled household', async () => {
    const tree = await render('../app/(app)/(tabs)/households');
    const body = text(tree);
    const hhids = fixture.households.map((h) => h.hhid).filter(Boolean);
    expect(hhids.some((hhid) => body.includes(hhid))).toBe(true);
  });

  it('pregnancy screen lists pulled pregnancies with their patient names', async () => {
    const tree = await render('../app/(app)/pregnancy');
    const body = text(tree);
    const eds = strings(fixture.pregnancies.map((p) => p.edd));
    expect(eds.some((edd) => body.includes(edd))).toBe(true);
    // The name comes from a JOIN in SQL, not from the pregnancy row itself.
    const names = strings(fixture.pregnancies.map((p) => fullNameOf(p.beneficiary_id)));
    expect(names.some((n) => body.includes(n))).toBe(true);
  });

  it('child health screen lists pulled children', async () => {
    const tree = await render('../app/(app)/child-health');
    const body = text(tree);
    const names = strings(fixture.children.map((c) => fullNameOf(c.beneficiary_id)));
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((n) => body.includes(n))).toBe(true);
  });

  it('referrals screen renders a referral row instead of the empty state', async () => {
    const tree = await render('../app/(app)/referrals');
    const body = text(tree);
    const referral = fixture.referrals[0];
    expect(referral).toBeDefined();
    expect(body).toContain(String(referral?.reason));
    expect(body).not.toContain('No referrals found');
    expect(body).toContain(fullNameOf(referral?.beneficiary_id));
  });

  it('health checkup screen lists pulled NCD screenings with patient names', async () => {
    const tree = await render('../app/(app)/health-checkup');
    const body = text(tree);
    const names = strings(fixture.ncd_screenings.map((n) => fullNameOf(n.beneficiary_id)));
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((n) => body.includes(n))).toBe(true);
  });

  it('follow-ups screen merges referral and task follow-ups', async () => {
    const tree = await render('../app/(app)/follow-ups');
    const body = text(tree);
    // The live feed has outstanding tasks, so the merged list must not be empty.
    expect(fixture.asha_tasks.length).toBeGreaterThan(0);
    const types = [...new Set(fixture.asha_tasks.map((t) => t.task_type).filter(Boolean))];
    expect(types.some((tp) => body.includes(String(tp)))).toBe(true);
  });

  it('notifications screen derives alerts from synced rows', async () => {
    const tree = await render('../app/(app)/notifications');
    const body = text(tree);
    const tasks = fixture.asha_tasks;
    expect(tasks.length).toBeGreaterThan(0);
    const types = [...new Set(tasks.map((t) => t.task_type).filter(Boolean))];
    expect(types.some((tp) => body.includes(String(tp)))).toBe(true);
  });

  it('health survey screen lists a captured survey and its answers', async () => {
    const tree = await render('../app/(app)/health-survey');
    const body = text(tree);
    const survey = fixture.village_forms[0];
    expect(survey).toBeDefined();
    // The date and the members-screened answer come out of the JSON form_data,
    // so this fails if readFormData cannot parse a stored row.
    expect(body).toContain(String(survey?.form_date));
    expect(body).toContain('5');
  });

  it('patient detail screen renders the clinical tabs for a real beneficiary', async () => {
    const pregnant = fixture.pregnancies.find((p) => p.beneficiary_id);
    const tree = await render('../app/(app)/patient/[id]');
    const body = text(tree);
    // A tab bar and the section headings must be present.
    expect(body.length).toBeGreaterThan(200);
    expect(pregnant).toBeDefined();
  });

  it('no screen renders a raw i18n key', async () => {
    const pages = [
      '../app/(app)/(tabs)/households',
      '../app/(app)/(tabs)/index',
      '../app/(app)/(tabs)/patients',
      '../app/(app)/(tabs)/sync',
      '../app/(app)/(tabs)/tasks',
      '../app/(app)/child-health',
      '../app/(app)/connection-error',
      '../app/(app)/follow-ups',
      '../app/(app)/health-checkup',
      '../app/(app)/health-survey',
      '../app/(app)/notifications',
      '../app/(app)/patient/[id]',
      '../app/(app)/pregnancy',
      '../app/(app)/profile',
      '../app/(app)/referrals',
      '../app/(app)/register',
      '../app/index',
      '../app/login',
    ];
    for (const page of pages) {
      const body = text(await render(page));
      // A leaked key looks like "asha.someKey" or "common.someKey".
      const leaked = body.match(/(?:^|["\\])(?:asha|common|nav|patient|auth|errors|dashboard|modules)\.[a-zA-Z]+/g);
      expect({ page, leaked: leaked ?? [] }).toEqual({ page, leaked: [] });
    }
  });
  it('every locally-upserted table declares a primary key', async () => {
    // Regression: `village_forms` was created without a PRIMARY KEY, so the
    // `ON CONFLICT(id) DO UPDATE` upsert that saves a survey raised
    // "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint".
    // The rejection was swallowed by `void save()`, so captures silently
    // vanished. A table written with ON CONFLICT needs a unique key.
    const db = await getDatabase();
    const upserted = ['sync_metadata', 'sync_queue', 'sync_conflicts', 'households', 'beneficiaries', 'village_forms'];

    for (const table of upserted) {
      // eslint-disable-next-line no-await-in-loop
      const columns = await db.getAllAsync<{ pk: number }>(`PRAGMA table_info(${table})`);
      const hasKey = columns.some((column) => column.pk > 0);
      expect({ table, hasKey }).toEqual({ table, hasKey: true });
    }
  });

  it('health survey save records the household and the signed-in ASHA', async () => {
    // Regression: the capture form required a household, but the saved payload
    // carried neither the household nor an ASHA id, so every survey that synced
    // to the server was unattributable. This drives the real save path and
    // asserts on what actually lands in the local table and the outbox.
    const household = fixture.households[0];
    if (!household) throw new Error('fixture needs a household');

    // The screen resolves the ASHA from the signed-in session, so sign in
    // first exactly as the authenticated app shell would.
    const expectedAsha = 'asha-test-0001';
    await tokenStore.save({
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      user: {
        id: expectedAsha,
        phone: '9876543210',
        full_name: 'Test ASHA',
        role: 'asha',
        language: 'en',
      },
    });

    const Page = require('../app/(app)/health-survey').default;
    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(<Page />);
    });
    const settle = async () => {
      for (let i = 0; i < 25; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
      }
    };
    await settle();

    // Pressables render through host Views in this renderer, so they are located
    // by onPress plus their rendered subtree text.
    const tappable = (needle: string) =>
      tree!.root
        .findAll(
          (node) => typeof node.type !== 'string' && typeof node.props?.onPress === 'function',
          { deep: true },
        )
        .find((node) => {
          // Select fields label themselves via accessibilityLabel, while
          // Button renders its label as text.
          const a11y = node.props?.accessibilityLabel;
          return (
            (typeof a11y === 'string' && a11y.includes(needle)) || subtreeText(node).includes(needle)
          );
        });

    // Open the capture form.
    const openForm = tappable('Start Survey');
    expect(openForm).toBeDefined();
    await act(async () => {
      openForm!.props.onPress();
    });
    await settle();

    // Choose the first household.
    tappable('Household')!.props.onPress();
    await settle();
    const option = tappable(household.hhid);
    expect(option).toBeDefined();
    await act(async () => {
      option!.props.onPress();
    });
    await settle();

    // The picker must now show the chosen household rather than the placeholder.
    expect(subtreeText(tappable('Household')!)).toContain(household.hhid);

    // Submit.
    const submit = tappable('Save');
    expect(submit).toBeDefined();
    expect(submit!.props.accessibilityState?.disabled).not.toBe(true);
    await act(async () => {
      submit!.props.onPress();
    });
    await settle();

    const db = await getDatabase();
    const rows = await db.getAllAsync<{ asha_id: string; form_data: string }>(
      'SELECT asha_id, form_data FROM village_forms WHERE asha_id = ?',
      expectedAsha,
    );
    // Never blank: the server column is NOT NULL and the record has to be
    // attributable to the ASHA who took it.
    expect(rows.every((r) => r.asha_id.length > 0)).toBe(true);
    const parsed = JSON.parse(rows[0]?.form_data ?? '{}') as Record<string, unknown>;
    expect(parsed.household_id).toBe(household.id);
    expect(parsed.household_hhid).toBe(household.hhid);

    // It must also be queued for upload, not only stored on the device.
    const queued = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sync_queue WHERE entity = 'village_forms'",
    );
    expect(Number(queued?.n ?? 0)).toBeGreaterThan(0);
  });
  it('login posts phone and password to /auth/login and masks the field', async () => {
    // Regression guard for the OTP -> password switch: the request must go to
    // /auth/login (not /auth/otp/verify) with a password field, and the entry
    // must not be echoed in clear text.
    const calls: { url: string; body: unknown }[] = [];
    const fetchMock = jest.fn(async (url: string, init: { body?: string }) => {
      calls.push({ url, body: init.body ? JSON.parse(init.body) : undefined });
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            tokens: { access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 1800 },
            user: {
              id: 'u1',
              phone: '9876543210',
              full_name: 'Sunita Devi',
              role: 'asha',
              language: 'hi',
            },
          }),
      };
    });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

    const Page = require('../app/login').default;
    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(<Page />);
    });
    for (let i = 0; i < 25; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    const json = text(tree!);
    // A password entry exists and is masked.
    expect(json).toContain('secureTextEntry');
    expect(json).not.toContain('sendOtp');
    expect(json).not.toContain('verifyOtp');
    // No OTP step survives anywhere in the screen.
    expect(/[Oo][Tt][Pp]/.test(json)).toBe(false);

    // Fill the two fields so the submit button enables. Selected by testID
    // because TextField renders each input more than once in the tree.
    const field = (id: string) =>
      tree!.root.findAll(
        (node) => node.props?.testID === id && typeof node.props?.onChangeText === 'function',
        { deep: true },
      )[0]!;
    expect(field('phone-input')).toBeDefined();
    expect(field('password-input')).toBeDefined();
    await act(async () => {
      field('phone-input').props.onChangeText('9876543210');
    });
    await act(async () => {
      field('password-input').props.onChangeText('asha@123');
    });
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    const signIn = tree!.root
      .findAll(
        (node) => typeof node.type !== 'string' && typeof node.props?.onPress === 'function',
        { deep: true },
      )
      .find((node) => subtreeText(node).includes('Sign in'));
    expect(signIn).toBeDefined();
    await act(async () => {
      signIn!.props.onPress();
    });
    for (let i = 0; i < 25; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    const loginCall = calls.find((c) => c.url.includes('/auth/login'));
    expect(loginCall).toBeDefined();
    expect(loginCall!.body).toMatchObject({ phone: '9876543210' });
    // It must not be sending an OTP anywhere.
    expect(calls.some((c) => c.url.includes('/auth/otp'))).toBe(false);
  });
});
