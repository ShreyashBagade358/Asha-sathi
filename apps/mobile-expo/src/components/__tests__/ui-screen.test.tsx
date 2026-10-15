import React from 'react';
import { ScrollView, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { Screen } from '@/components/Screen';
import i18n from '@/i18n';

import { labelledPressables, subtreeText } from './ui-helpers';

/**
 * Screen chrome: the scroll container must clear the tab bar (pb-28) when one
 * is present and fall back to pb-8 when it is not - the two paddings must
 * never be issued together and left to Tailwind's utility ordering to sort
 * out - plus the back affordance's label and the notification badge.
 */

function contentClasses(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findByType(ScrollView)
    .props.contentContainerClassName.split(/\s+/)
    .filter(Boolean);
}

describe('Screen bottom padding', () => {
  it('clears the tab bar when withTabBar is on', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Screen title="Patients" withTabBar>
          <Text>Body</Text>
        </Screen>,
      );
    });

    const classes = contentClasses(tree);
    expect(classes).toContain('pb-28');
    expect(classes).not.toContain('pb-8');
    expect(classes).toContain('px-4');

    act(() => tree.unmount());
  });

  it('falls back to the small padding when the tab bar is hidden', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Screen title="Patients" withTabBar={false}>
          <Text>Body</Text>
        </Screen>,
      );
    });

    const classes = contentClasses(tree);
    expect(classes).toContain('pb-8');
    expect(classes).not.toContain('pb-28');

    act(() => tree.unmount());
  });

  it('honours a caller contentClassName alongside its own padding', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Screen title="Patients" withTabBar={false} contentClassName="gap-4">
          <Text>Body</Text>
        </Screen>,
      );
    });

    const classes = contentClasses(tree);
    expect(classes).toContain('gap-4');
    expect(classes).toContain('pb-8');

    act(() => tree.unmount());
  });
});

describe('Screen chrome', () => {
  it('renders a labelled back affordance and the title', () => {
    const onBack = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Screen title="Household" subtitle="Rampur" back onBack={onBack}>
          <Text>Body</Text>
        </Screen>,
      );
    });

    const back = labelledPressables(tree).find((node) => node.props.accessibilityLabel === i18n.t('common.back'));
    expect(back).toBeDefined();

    act(() => back!.props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);

    const body = subtreeText(tree.root);
    expect(body).toContain('Household');
    expect(body).toContain('Rampur');

    act(() => tree.unmount());
  });

  it('shows the unread badge only for a non-zero count', () => {
    let withCount!: TestRenderer.ReactTestRenderer;
    let withoutCount!: TestRenderer.ReactTestRenderer;
    act(() => {
      withCount = TestRenderer.create(
        <Screen title="Home" badgeCount={7} onBadgePress={() => {}}>
          <Text>Body</Text>
        </Screen>,
      );
      withoutCount = TestRenderer.create(
        <Screen title="Home" badgeCount={0} onBadgePress={() => {}}>
          <Text>Body</Text>
        </Screen>,
      );
    });

    expect(subtreeText(withCount.root)).toContain('7');
    expect(subtreeText(withoutCount.root)).not.toContain('7');

    act(() => {
      withCount.unmount();
      withoutCount.unmount();
    });
  });

  it('keeps its own scroll container when scroll is off', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Screen title="List" scroll={false}>
          <Text>Body</Text>
        </Screen>,
      );
    });

    expect(tree.root.findAllByType(ScrollView).length).toBe(0);
    expect(subtreeText(tree.root)).toContain('Body');

    act(() => tree.unmount());
  });
});
