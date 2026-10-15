import React from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { SelectField } from '../src/components/ui/Field';

/**
 * The village select carries thousands of rows (~1900 for Pune), so it
 * renders through a virtualised FlatList with a filter box rather than
 * mounting every option. This proves the modal actually paints its rows,
 * narrows them as you type, and reports the pick - the failure mode the
 * user sees as "the dropdown shows no content".
 */

function subtreeText(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((child) => subtreeText(child as never)).join(' ');
}

const OPTIONS = Array.from({ length: 500 }, (_, index) => ({
  label: `Village ${index}`,
  value: `v-${index}`,
}));

async function settle(): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe('SelectField with a large option list', () => {
  it('opens, renders rows, filters, and reports the pick', async () => {
    const onChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <SelectField label="Village" value="" onChange={onChange} placeholder="Select village" options={OPTIONS} />,
      );
    });

    // The chevron renders a hidden icon-font glyph inside the trigger, so the
    // a11y label is the reliable way to find it - text comparison sees the glyph.
    const triggers = tree.root.findAll(
      (node) => typeof node.props?.onPress === 'function' && node.props?.accessibilityLabel === 'Village',
    );
    expect(triggers[0]).toBeDefined();
    await act(async () => {
      triggers[0]?.props.onPress();
    });
    await settle();

    // toJSON() goes circular once the modal mounts React elements as props,
    // so assertions read the rendered text through the instance tree instead.
    const body = subtreeText(tree.root);
    // The first window of virtualised rows is painted.
    expect(body).toContain('Village 0');
    // More than 30 options: the filter box appears.
    expect(tree.root.findAllByType(TextInput).length).toBeGreaterThan(0);

    // Type a query that matches exactly one row.
    const input = tree.root.findAllByType(TextInput)[0]!;
    await act(async () => {
      input.props.onChangeText('Village 499');
    });
    await settle();

    const filtered = subtreeText(tree.root);
    expect(filtered).toContain('Village 499');
    expect(filtered).not.toContain('Village 498');

    // The sheet's backdrop Pressable also carries the row's text, so pick the
    // innermost match - tapping the backdrop would only close the modal.
    const matches = tree.root.findAll(
      (node) => typeof node.props?.onPress === 'function' && subtreeText(node).includes('Village 499'),
    );
    const option = matches.find(
      (node) =>
        !matches.some((other) => {
          let ancestor: typeof node | null = other.parent;
          while (ancestor) {
            if (ancestor === node) return true;
            ancestor = ancestor.parent;
          }
          return false;
        }),
    );
    expect(option).toBeDefined();
    await act(async () => {
      option!.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('v-499');
  });
});
