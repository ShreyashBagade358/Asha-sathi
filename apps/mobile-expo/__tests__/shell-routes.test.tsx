import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import {
  BOTTOM_NAV,
  CONTEXT_NAV,
  MORE_NAV,
  MORE_SECTIONS,
  PATIENT_BOTTOM_NAV,
  PATIENT_MORE_NAV,
  PATIENT_MORE_SECTIONS,
  PUBLIC_NAV,
} from '../src/nav/config';
import { TabBar } from '../src/nav/TabBar';

// A recording substitute for the router the tab bar calls into. The shared
// jest.setup mock is a no-op, which cannot tell a press on the wrong tab
// from a press on the right one.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

/**
 * Route / navigation parity.
 *
 * Every screen in app/ must be reachable from somewhere its role can name —
 * the ASHA shell's menu, the patient shell's menu, a public auth flow, or a
 * documented CONTEXT_NAV entry — and every path either shell advertises must
 * still have a file behind it. The forward direction catches the new screen
 * nobody wired into a menu or into CONTEXT_NAV; the reverse direction catches
 * a nav entry whose file was renamed out from under it. `tsc` sees neither: a
 * path is just a string.
 *
 * The rationale string in PUBLIC_NAV / CONTEXT_NAV is what the forward check
 * is really after - it forces a human sentence about where the route is
 * reached from, instead of an empty placeholder that silences the test.
 */

const APP_DIR = path.join(__dirname, '..', 'app');

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    if (!entry.name.endsWith('.tsx')) return [];
    if (entry.name === '_layout.tsx') return [];
    return [full];
  });
}

/** Expo Router path for a file: groups, the root index and the extension drop out. */
function routePath(file: string): string {
  const relative = path.relative(APP_DIR, file).replace(/\\/g, '/');
  const segments = relative
    .replace(/\.tsx$/, '')
    .split('/')
    .filter((segment) => segment !== '' && !segment.startsWith('(') && !segment.startsWith('_'))
    .filter((segment) => segment !== 'index');
  return `/${segments.join('/')}`;
}

const menuPaths = [...BOTTOM_NAV, ...MORE_NAV, ...PATIENT_BOTTOM_NAV, ...PATIENT_MORE_NAV].map(
  (item) => item.path,
);
const contextPaths = Object.keys(CONTEXT_NAV);
const publicPaths = Object.keys(PUBLIC_NAV);
const knownPaths = new Set([...menuPaths, ...contextPaths, ...publicPaths]);

const files = routeFiles(APP_DIR).sort();
const routePaths = files.map(routePath);

describe('shell routes', () => {
  it('finds the route files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('accounts for every route file in the nav config', () => {
    const unlisted = files
      .filter((file) => !knownPaths.has(routePath(file)))
      .map((file) => `${path.relative(APP_DIR, file)} -> ${routePath(file)}`);
    expect(unlisted).toEqual([]);
  });

  it('has a file behind every configured path', () => {
    const present = new Set(routePaths);
    const dangling = [...knownPaths].filter((route) => !present.has(route)).sort();
    expect(dangling).toEqual([]);
  });

  it('does not list the same path twice', () => {
    const duplicates = menuPaths.filter((route, index) => menuPaths.indexOf(route) !== index);
    expect(duplicates).toEqual([]);
    const overlapping = [...contextPaths, ...publicPaths].filter((route) => menuPaths.includes(route));
    expect(overlapping).toEqual([]);
    const inBothMaps = contextPaths.filter((route) => publicPaths.includes(route));
    expect(inBothMaps).toEqual([]);
  });

  it('explains where every context and public route is reached from', () => {
    const empty = [
      ...Object.entries(CONTEXT_NAV),
      ...Object.entries(PUBLIC_NAV),
    ]
      .filter(([, explanation]) => explanation.trim().length === 0)
      .map(([route]) => route);
    expect(empty).toEqual([]);
  });

  it('gives every menu entry a label and an icon', () => {
    const missing = [...BOTTOM_NAV, ...MORE_NAV, ...PATIENT_BOTTOM_NAV, ...PATIENT_MORE_NAV]
      .filter((item) => !item.labelKey || !item.icon)
      .map((item) => item.path);
    expect(missing).toEqual([]);
  });
});

/**
 * The More sheet renders MORE_SECTIONS, not MORE_NAV. An item added to the nav
 * list but left out of a section is configured, passes the route checks above,
 * and is still unreachable - the sheet is the only surface that shows it.
 */
function sectionPaths(sections: { items: { path: string }[] }[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.path));
}

describe('more-sheet sections', () => {
  it('covers every MORE_NAV item exactly once', () => {
    expect(sectionPaths(MORE_SECTIONS).sort()).toEqual(MORE_NAV.map((item) => item.path).sort());
  });

  it('covers every PATIENT_MORE_NAV item exactly once', () => {
    expect(sectionPaths(PATIENT_MORE_SECTIONS).sort()).toEqual(
      PATIENT_MORE_NAV.map((item) => item.path).sort(),
    );
  });

  it('gives every section a title key', () => {
    const untitled = [...MORE_SECTIONS, ...PATIENT_MORE_SECTIONS]
      .filter((section) => !section.titleKey)
      .map((section) => section.items.map((item) => item.path).join(','));
    expect(untitled).toEqual([]);
  });
});

/**
 * The tab bar reads `state.index` positionally, so a reorder of BOTTOM_NAV
 * without a matching reorder of the Tabs.Screen list (or vice versa) would
 * highlight and route to the wrong destination while looking perfectly fine.
 */
describe('tab bar', () => {
  function renderTabs(index: number) {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<TabBar state={{ index }} />);
    });
    // Each tab matches the Pressable composite and the host Views it renders;
    // only the composite carries the handler, which makes it the one to press.
    return renderer.root.findAll(
      (node) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function',
    );
  }

  it('marks only the tab at state.index as selected', () => {
    const tabs = renderTabs(2);
    expect(tabs).toHaveLength(BOTTOM_NAV.length);
    expect(tabs.map((tab) => tab.props.accessibilityState?.selected)).toEqual(
      BOTTOM_NAV.map((_, index) => index === 2),
    );
  });

  it('labels each tab from the nav config', () => {
    const labels = renderTabs(0).map((tab) => String(tab.props.accessibilityLabel));
    expect(labels.every((label) => label.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(BOTTOM_NAV.length);
  });

  it('routes a press to that item path', () => {
    const tabs = renderTabs(3);
    act(() => {
      tabs[3]!.props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith(BOTTOM_NAV[3]!.path);
  });
});
