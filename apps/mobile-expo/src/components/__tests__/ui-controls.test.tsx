import React from 'react';
import { ActivityIndicator } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { Button, IconButton } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { Tabs } from '@/components/ui/Tabs';
import { colors, toneColor } from '@/theme';

import { hasClass, subtreeText } from './ui-helpers';

/**
 * Controls: the disabled/loading/pressed states the callers rely on, the
 * 44pt hit areas, and StatCard's tone-tinted glyph (a Feather icon reads its
 * own `color` prop, so it used to stay grey inside a tone-coloured row).
 */

function buttonOf(tree: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance {
  // Role-based: a Button without an onPress prop still has to be findable.
  return tree.root.findAll((node) => node.props?.accessibilityRole === 'button')[0]!;
}

describe('Button', () => {
  it('renders the primary recipe and merges caller classes', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Button label="Save" className="mt-4" />);
    });

    const button = buttonOf(tree);
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(button.props.disabled).toBeFalsy();
    expect(hasClass(tree.root, 'bg-primary')).toBe(true);
    expect(hasClass(tree.root, 'h-touch-target')).toBe(true);
    expect(hasClass(tree.root, 'mt-4')).toBe(true);
    expect(subtreeText(tree.root)).toContain('Save');

    act(() => tree.unmount());
  });

  it('blocks presses and dims when disabled', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Button label="Save" disabled onPress={onPress} />);
    });

    const button = buttonOf(tree);
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(hasClass(tree.root, 'opacity-60')).toBe(true);

    act(() => tree.unmount());
  });

  it('swaps the icon for a spinner and marks itself busy while loading', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Button label="Save" icon="check" loading />);
    });

    const button = buttonOf(tree);
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(1);

    act(() => tree.unmount());
  });
});

describe('IconButton', () => {
  it('forwards presses and exposes a 44pt target', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<IconButton name="x" onPress={onPress} accessibilityLabel="Close" />);
    });

    const button = buttonOf(tree);
    expect(button.props.accessibilityLabel).toBe('Close');
    expect(hasClass(tree.root, 'h-11')).toBe(true);
    expect(hasClass(tree.root, 'w-11')).toBe(true);

    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  it('reports and paints the disabled state', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<IconButton name="menu" onPress={() => {}} accessibilityLabel="More" disabled />);
    });

    const button = buttonOf(tree);
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    expect(hasClass(tree.root, 'opacity-60')).toBe(true);

    act(() => tree.unmount());
  });
});

describe('Pill', () => {
  it('is a 44pt pressable that announces selection', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Pill label="Pending" count={4} active onPress={onPress} />);
    });

    const pill = buttonOf(tree);
    expect(pill.props.accessibilityState).toEqual({ selected: true });
    expect(hasClass(tree.root, 'min-h-11')).toBe(true);
    expect(hasClass(tree.root, 'bg-primary')).toBe(true);
    expect(subtreeText(tree.root)).toContain('4');

    act(() => pill.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  it('renders inert when disabled', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Pill label="Pending" disabled onPress={() => {}} />);
    });

    // Skip the composite Pill instance, whose own `onPress` prop is the caller's fn.
    expect(
      tree.root.findAll((node) => typeof node.props?.onPress === 'function' && typeof node.props?.className === 'string')
        .length,
    ).toBe(0);
    expect(hasClass(tree.root, 'opacity-60')).toBe(true);

    act(() => tree.unmount());
  });
});

describe('ProgressBar', () => {
  it('exposes a clamped 0-100 progressbar value', () => {
    const cases: Array<[number, number]> = [
      [0.42, 42],
      [1.5, 100],
      [-3, 0],
      [Number.NaN, 0],
    ];

    for (const [value, now] of cases) {
      let tree!: TestRenderer.ReactTestRenderer;
      act(() => {
        tree = TestRenderer.create(<ProgressBar value={value} accessibilityLabel="Vaccination" />);
      });
      const bar = tree.root.findByProps({ accessibilityRole: 'progressbar' });
      expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now });
      expect(bar.props.accessibilityLabel).toBe('Vaccination');
      act(() => tree.unmount());
    }
  });
});

describe('StatCard', () => {
  it('tints the glyph with the tone colour and keeps the KPI shell', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<StatCard label="High risk" value={7} icon="alert" tone="error" />);
    });

    expect(tree.root.findByType(Icon).props.color).toBe(toneColor.error);
    expect(toneColor.error).toBe(colors.error);
    expect(hasClass(tree.root, 'text-error')).toBe(true);
    expect(hasClass(tree.root, 'rounded-2xl')).toBe(true);
    expect(subtreeText(tree.root)).toContain('7');

    act(() => tree.unmount());
  });

  it('defaults the glyph to the primary tone', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<StatCard label="Patients" value="1,204" icon="users" />);
    });
    expect(tree.root.findByType(Icon).props.color).toBe(toneColor.primary);
    act(() => tree.unmount());
  });
});

describe('Tabs', () => {
  it('marks the active tab and gives every tab a 44pt hit area', () => {
    const onChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Tabs tabs={[{ key: 'a', label: 'Profile' }, { key: 'b', label: 'Records' }]} active="a" onChange={onChange} />);
    });

    const tabs = tree.root.findAll((node) => typeof node.props?.onPress === 'function' && node.props?.accessibilityRole === 'tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0]!.props.accessibilityState).toEqual({ selected: true });
    expect(tabs[1]!.props.accessibilityState).toEqual({ selected: false });
    // label-md is a 20px line; pt-4 pb-2 puts the target at 44pt.
    expect(hasClass(tabs[0]!, 'pt-4')).toBe(true);

    act(() => tabs[1]!.props.onPress());
    expect(onChange).toHaveBeenCalledWith('b');

    act(() => tree.unmount());
  });
});

describe('Skeleton', () => {
  it('hides the decorative shimmer from assistive tech', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Skeleton width={120} height={20} />);
    });
    const block = tree.root.find((node) => node.props?.accessibilityElementsHidden === true);
    expect(block.props.importantForAccessibility).toBe('no-hide-descendants');
    act(() => tree.unmount());
  });
});
