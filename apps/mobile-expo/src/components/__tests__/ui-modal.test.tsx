import React from 'react';
import { Modal as RNModal, Pressable, StyleSheet, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { Modal } from '@/components/ui/Modal';
import i18n from '@/i18n';

import { ownClass, subtreeText } from './ui-helpers';

/**
 * The sheet's dismissal surface (backdrop tap, header x, Android back) and
 * its safe-area padding - the two things a bottom sheet silently gets wrong
 * on a notched phone or without onRequestClose.
 */

function closersOf(tree: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance[] {
  return tree.root.findAll(
    (node) => typeof node.props?.onPress === 'function' && node.props?.accessibilityLabel === i18n.t('common.close'),
  );
}

describe('Modal', () => {
  it('dismisses from the backdrop, the header button and Android back', () => {
    const onClose = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Modal visible onClose={onClose} title="Filter patients">
          <Text>Body</Text>
        </Modal>,
      );
    });

    expect(tree.root.findByType(RNModal).props.onRequestClose).toBe(onClose);
    expect(subtreeText(tree.root)).toContain('Filter patients');

    const closers = closersOf(tree);
    // backdrop + header x, both translated
    expect(closers.length).toBe(2);
    for (const closer of closers) {
      act(() => closer.props.onPress());
    }
    expect(onClose).toHaveBeenCalledTimes(2);

    act(() => tree.unmount());
  });

  it('folds the home-indicator inset into the sheet padding', () => {
    const onClose = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Modal visible onClose={onClose} title="Options">
          <Text>Body</Text>
        </Modal>,
      );
    });

    // ownClass, not hasClass: the backdrop's children include the panel, so a
    // walking check would match the backdrop first (it has no style padding).
    const panel = tree.root.findAll(
      (node) => typeof node.props?.className === 'string' && ownClass(node, 'shadow-modal'),
    )[0]!;
    expect(panel).toBeDefined();
    // jest.setup mocks useSafeAreaInsets().bottom to 16; the sheet adds 20.
    expect(StyleSheet.flatten(panel.props.style).paddingBottom).toBe(36);

    act(() => tree.unmount());
  });

  it('drops the header x when hideClose is set, keeping the backdrop', () => {
    const onClose = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Modal visible onClose={onClose} title="Form" hideClose>
          <Text>Body</Text>
        </Modal>,
      );
    });

    expect(closersOf(tree).length).toBe(1);

    act(() => tree.unmount());
  });

  it('renders nothing while hidden', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Modal visible={false} onClose={() => {}} title="Form">
          <Text>Body</Text>
        </Modal>,
      );
    });

    expect(subtreeText(tree.root)).not.toContain('Form');
    act(() => tree.unmount());
  });

  it('uses the centered shell for the centered variant', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Modal visible onClose={() => {}} variant="centered" title="Confirm">
          <Text>Body</Text>
        </Modal>,
      );
    });

    const panel = tree.root.findAll((node) => typeof node.props?.className === 'string' && ownClass(node, 'rounded-2xl'))[0]!;
    expect(panel).toBeDefined();
    expect(ownClass(panel, 'w-[88%]')).toBe(true);

    act(() => tree.unmount());
  });
});
