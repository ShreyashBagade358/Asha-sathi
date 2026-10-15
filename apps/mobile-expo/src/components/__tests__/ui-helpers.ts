import type TestRenderer from 'react-test-renderer';
import { act } from 'react-test-renderer';

/**
 * Assertions shared by the ui-* component suites.
 *
 * Under Jest the babel config keeps the plain React JSX runtime (no
 * NativeWind transform), so `className` survives on the host instances as a
 * raw prop - which is what makes the class strings below a reliable way to
 * assert styling decisions without a CSS engine in the loop.
 */

/** Every `className` in the tree, walking host children. */
export function classNames(node: TestRenderer.ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (instance: TestRenderer.ReactTestInstance) => {
    const cls = instance.props.className;
    if (typeof cls === 'string') out.push(cls);
    instance.children.forEach((child) => {
      if (typeof child !== 'string') walk(child);
    });
  };
  walk(node);
  return out;
}

export function flatClasses(node: TestRenderer.ReactTestInstance): string {
  return classNames(node).join(' ');
}

/** Token-exact membership in a node's *own* className (does not walk children). */
export function ownClass(node: TestRenderer.ReactTestInstance, token: string): boolean {
  const cls = node.props.className;
  return typeof cls === 'string' && cls.split(/\s+/).includes(token);
}

/** Token-exact class membership (`border-outline` must not match `border-outline-variant`). */
export function hasClass(node: TestRenderer.ReactTestInstance, token: string): boolean {
  return classNames(node).some((cls) => cls.split(/\s+/).includes(token));
}

/** All rendered text in a subtree; safe on trees that mount React elements as props. */
export function subtreeText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  const instance = node as TestRenderer.ReactTestInstance;
  return (instance.children ?? []).map((child) => subtreeText(child)).join(' ');
}

/** Pressables carrying a role + label, e.g. the buttons a screen offers. */
export function labelledPressables(tree: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance[] {
  return tree.root.findAll(
    (node) => typeof node.props?.onPress === 'function' && typeof node.props?.accessibilityLabel === 'string',
  );
}

/** Lets virtualised lists and modal effects settle. */
export async function settle(turns = 10): Promise<void> {
  for (let attempt = 0; attempt < turns; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}
