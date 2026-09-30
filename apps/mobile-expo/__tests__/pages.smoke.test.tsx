import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

/**
 * Mounts every route in app/ and fails if any of them throws while rendering.
 *
 * `tsc` and `expo export` both pass on code that still crashes on mount (a bad
 * hook order, a missing native module, an undefined i18n value dereferenced
 * during the first paint). This is the check that catches that class of bug,
 * and it reports per page so a failure names the screen.
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

const pages = routeFiles(APP_DIR).sort();

describe('every route mounts', () => {
  it('finds the route files', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages.map((file) => [path.relative(APP_DIR, file), file]))('%s', async (label, file) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(file);
    const Page = mod.default;
    expect(typeof Page).toBe('function');

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(<Page />);
    });
    // Let the data-loading effects settle so an async rejection surfaces here
    // rather than as an unhandled rejection after the test ends. Screens load
    // through async SQLite queries, so the number of turns needed varies with
    // machine load; keep going until the output stops changing.
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

    expect(tree).toBeDefined();
    expect(tree!.toJSON()).not.toBeNull();

    await act(async () => {
      tree!.unmount();
    });
  });
});
