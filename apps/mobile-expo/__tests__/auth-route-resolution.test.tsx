import fs from 'node:fs';
import path from 'node:path';

/**
 * Redirect targets for the auth flow, resolved against the real route tree.
 *
 * `tsc` sees hrefs as plain strings: a typo or a renamed folder still compiles
 * and only fails on a device, where the router falls through to the not-found
 * screen. This resolves every literal href the auth screens hand to the router
 * through the same link config the app builds, and pins the two entries that
 * are easy to break without noticing - "/" is owned by the cold-start gate
 * (not the worker dashboard that also sits at the bottom of the (app) group),
 * and the role splits land on their own shells.
 */

const { getRoutes } = require('expo-router/build/getRoutesCore');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { getStateFromPath } = require('expo-router/build/fork/getStateFromPath');

const APP_DIR = path.join(__dirname, '..', 'app');

const AUTH_SCREENS = [
  'index.tsx',
  'login.tsx',
  'verify-otp.tsx',
  'account-recovery.tsx',
  '_layout.tsx',
];

function routeFiles(dir: string, prefix = '.'): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      const key = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) return routeFiles(full, key);
      return /\.(tsx|ts|jsx|js)$/.test(entry.name) ? [key] : [];
    })
    .sort();
}

function buildConfig(): Record<string, unknown> {
  const files = routeFiles(APP_DIR);
  const context = Object.assign((id: string) => id, {
    keys: () => files,
    id: (key: string) => key,
    resolve: (key: string) => key,
  });
  const routes = getRoutes(context, {
    getSystemRoute: (options: Record<string, unknown>) => ({ ...options, children: [] }),
    platform: 'ios',
    platformRoutes: true,
  });
  return getReactNavigationConfig(routes, true) as Record<string, unknown>;
}

/** Nested route names of the state a path resolves to, innermost last. */
function resolve(href: string, config: Record<string, unknown>): string[] {
  const state = getStateFromPath(href, config) as
    | { routes?: Array<{ name: string; state?: { routes?: unknown[] } }> }
    | undefined;
  const names: string[] = [];
  let level = state?.routes;
  while (Array.isArray(level) && level.length > 0) {
    const route = level[0] as { name: string; state?: { routes?: unknown[] } };
    names.push(route.name);
    level = route.state?.routes as typeof level;
  }
  return names;
}

/** Literal hrefs the auth screens pass to router.replace / push / navigate. */
function hrefsIn(file: string): string[] {
  const source = fs.readFileSync(path.join(APP_DIR, file), 'utf8');
  const found = new Set<string>();
  const patterns = [
    /\.(?:replace|push|navigate)\(\s*['"]([^'"]+)['"]/g,
    /\bhref=\{?['"](\/[^'"]*)['"]/g,
    /pathname:\s*['"](\/[^'"]*)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found];
}

describe('auth route resolution', () => {
  const config = buildConfig();

  it.each(AUTH_SCREENS)('%s only names routes that exist', (file) => {
    const hrefs = hrefsIn(file);
    const unresolved = hrefs
      .filter((href) => resolve(href, config).includes('+not-found'))
      .map((href) => `${file} -> ${href}`);
    expect(unresolved).toEqual([]);
  });

  it('actually scans the destinations the auth flow declares', () => {
    // Guards the regex above: if it silently matched nothing the per-screen
    // check would pass on an empty list.
    const found = AUTH_SCREENS.flatMap((file) => hrefsIn(file));
    expect(found).toEqual(expect.arrayContaining(['/login', '/account-recovery', '/verify-otp']));
  });

  it('keeps the cold-start gate at "/" instead of the worker dashboard', () => {
    expect(resolve('/', config)).toEqual(['index']);
  });

  it('splits the roles onto their own shells', () => {
    expect(resolve('/(app)', config)).toEqual(['(app)', '(tabs)', 'index']);
    expect(resolve('/home', config)).toEqual(['(patient)', '(tabs)', 'home']);
    expect(resolve('/login', config)).toEqual(['login']);
  });
});
