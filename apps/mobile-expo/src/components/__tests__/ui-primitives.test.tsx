import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { Chip, chipToneColor, type ChipTone } from '@/components/ui/Chip';
import { RiskStrip } from '@/components/ui/RiskStrip';
import { Toggle } from '@/components/ui/Toggle';

function classNames(node: TestRenderer.ReactTestInstance): string[] {
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

function textOf(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

describe('Chip', () => {
  const TONES: { tone: ChipTone; bg: string; fg: string }[] = [
    { tone: 'success', bg: 'bg-secondary-container', fg: 'text-on-secondary-container' },
    { tone: 'error', bg: 'bg-error-container', fg: 'text-on-error-container' },
    { tone: 'warning', bg: 'bg-amber-light', fg: 'text-amber' },
    { tone: 'info', bg: 'bg-tertiary-container', fg: 'text-on-tertiary-container' },
    { tone: 'neutral', bg: 'bg-surface-variant', fg: 'text-on-surface-variant' },
  ];

  it.each(TONES)('renders the $tone tone pair', ({ tone, bg, fg }) => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Chip tone={tone}>High</Chip>);
    });
    const flat = classNames(tree.root).join(' ');
    expect(flat).toContain(bg);
    expect(flat).toContain(fg);
    expect(textOf(tree)).toContain('High');
    act(() => tree.unmount());
  });

  it('uses the caption recipe at sm and label-md at md', () => {
    let sm!: TestRenderer.ReactTestRenderer;
    let md!: TestRenderer.ReactTestRenderer;
    act(() => {
      sm = TestRenderer.create(<Chip size="sm">A</Chip>);
      md = TestRenderer.create(<Chip size="md">B</Chip>);
    });
    expect(classNames(sm.root).join(' ')).toContain('font-caption text-caption font-semibold');
    expect(classNames(md.root).join(' ')).toContain('font-label-md text-label-md');
    act(() => {
      sm.unmount();
      md.unmount();
    });
  });

  it('exposes the icon tint for every tone', () => {
    expect(Object.keys(chipToneColor).sort()).toEqual(['error', 'info', 'neutral', 'success', 'warning']);
  });
});

describe('Toggle', () => {
  it('announces switch state and forwards presses', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Toggle value={false} onValueChange={onValueChange} accessibilityLabel="Notifications" />);
    });

    const sw = tree.root.findByProps({ accessibilityRole: 'switch' });
    expect(sw.props.accessibilityState).toEqual({ checked: false, disabled: false });
    expect(sw.props.accessibilityLabel).toBe('Notifications');
    expect(classNames(tree.root).join(' ')).toContain('bg-outline-variant');

    act(() => sw.props.onPress());
    expect(onValueChange).toHaveBeenCalledWith(true);

    act(() => tree.unmount());
  });

  it('paints the track secondary when on and blocks presses when disabled', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Toggle value onValueChange={onValueChange} disabled />);
    });

    const sw = tree.root.findByProps({ accessibilityRole: 'switch' });
    expect(sw.props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(classNames(tree.root).join(' ')).toContain('bg-secondary');
    expect(sw.props.disabled).toBe(true);

    act(() => tree.unmount());
  });
});

describe('RiskStrip', () => {
  it.each([
    ['high', 'bg-error'],
    ['medium', 'bg-amber'],
    ['low', 'bg-secondary'],
    ['none', 'bg-primary'],
  ] as const)('renders the %s rail colour', (risk, expected) => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <RiskStrip risk={risk}>
          <></>
        </RiskStrip>,
      );
    });
    const flat = classNames(tree.root).join(' ');
    expect(flat).toContain(expected);
    expect(flat).toContain('absolute bottom-0 left-0 top-0 w-2');
    expect(flat).toContain('overflow-hidden rounded-2xl border border-outline-variant/40');
    act(() => tree.unmount());
  });

  it('pads content pl-5 by default and pl-8 for the lg variant', () => {
    let md!: TestRenderer.ReactTestRenderer;
    let lg!: TestRenderer.ReactTestRenderer;
    act(() => {
      md = TestRenderer.create(
        <RiskStrip risk="high">
          <></>
        </RiskStrip>,
      );
      lg = TestRenderer.create(
        <RiskStrip risk="high" variant="lg">
          <></>
        </RiskStrip>,
      );
    });
    expect(classNames(md.root).join(' ')).toContain('p-4 pl-5');
    expect(classNames(lg.root).join(' ')).toContain('p-5 pl-8');
    act(() => {
      md.unmount();
      lg.unmount();
    });
  });

  it('renders children', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <RiskStrip risk="medium">
          <></>
        </RiskStrip>,
      );
    });
    expect(tree.toJSON()).not.toBeNull();
    act(() => tree.unmount());
  });
});
