import React from 'react';
import { Platform, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { DateField, PasswordField, SelectField, TextField } from '@/components/ui/Field';
import { SearchBar } from '@/components/ui/SearchBar';
import i18n from '@/i18n';

import { hasClass, labelledPressables, settle, subtreeText } from './ui-helpers';

/**
 * Covers the input family's shared contracts:
 *  - a caller-supplied onFocus/onBlur is *called* by the field's wrapper
 *    rather than replacing it (the wrapper owns the focus border),
 *  - the reveal control keeps a translated label and a 44pt hit area,
 *  - a filter that matches nothing says so instead of repeating the picker
 *    placeholder,
 *  - the iOS date sheet's confirm label comes from the locale.
 */

function firstInput(tree: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance {
  return tree.root.findAllByType(TextInput)[0]!;
}

describe('TextField focus + error', () => {
  it('keeps its own focus border while still invoking the caller handler', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<TextField label="Full name" onFocus={onFocus} onBlur={onBlur} />);
    });

    const input = firstInput(tree);
    expect(input.props.accessibilityLabel).toBe('Full name');
    expect(hasClass(tree.root, 'border-outline')).toBe(true);

    act(() => input.props.onFocus({ nativeEvent: {} }));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(hasClass(tree.root, 'border-primary')).toBe(true);

    act(() => input.props.onBlur({ nativeEvent: {} }));
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(hasClass(tree.root, 'border-outline')).toBe(true);

    act(() => tree.unmount());
  });

  it('paints the error border and surfaces the message', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<TextField label="Phone" errorText="Enter a valid 10-digit mobile number" />);
    });
    expect(hasClass(tree.root, 'border-error')).toBe(true);
    expect(subtreeText(tree.root)).toContain('Enter a valid 10-digit mobile number');
    act(() => tree.unmount());
  });

  it('merges a caller className instead of losing the base field styles', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<TextField label="Village" className="mt-4" />);
    });
    expect(hasClass(tree.root, 'h-touch-target')).toBe(true);
    expect(hasClass(tree.root, 'bg-surface')).toBe(true);
    expect(hasClass(tree.root, 'mt-4')).toBe(true);
    act(() => tree.unmount());
  });
});

describe('PasswordField reveal control', () => {
  it('labels the toggle from the auth strings and flips the mask', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<PasswordField label="Password" value="secret" onChangeText={() => {}} />);
    });

    expect(firstInput(tree).props.secureTextEntry).toBe(true);

    const reveal = labelledPressables(tree).find((node) => node.props.accessibilityRole === 'button');
    expect(reveal).toBeDefined();
    expect(reveal!.props.accessibilityLabel).toBe(i18n.t('auth.showPassword'));
    // 18px glyph + 2*14 hitSlop clears the 44pt target.
    expect(reveal!.props.hitSlop).toBe(14);

    act(() => reveal!.props.onPress());
    expect(firstInput(tree).props.secureTextEntry).toBe(false);
    const mask = labelledPressables(tree).find((node) => node.props.accessibilityRole === 'button');
    expect(mask!.props.accessibilityLabel).toBe(i18n.t('auth.hidePassword'));

    act(() => tree.unmount());
  });

  it('lets an explicit label win over the default', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <PasswordField label="Password" value="x" onChangeText={() => {}} showLabel="Show" hideLabel="Hide" />,
      );
    });
    const reveal = labelledPressables(tree).find((node) => node.props.accessibilityRole === 'button');
    expect(reveal!.props.accessibilityLabel).toBe('Show');
    act(() => tree.unmount());
  });
});

describe('SelectField filter', () => {
  const OPTIONS = Array.from({ length: 40 }, (_, index) => ({
    label: `Village ${index}`,
    value: `v-${index}`,
  }));

  it('reports no matches instead of repeating the placeholder', async () => {
    const onChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <SelectField label="Village" value="" onChange={onChange} placeholder="Select village" options={OPTIONS} />,
      );
    });

    const trigger = labelledPressables(tree).find((node) => node.props.accessibilityLabel === 'Village');
    expect(trigger).toBeDefined();
    await act(async () => {
      trigger!.props.onPress();
    });
    await settle();
    expect(subtreeText(tree.root)).toContain('Village 0');

    const filter = tree.root.findAllByType(TextInput)[0]!;
    await act(async () => {
      filter.props.onChangeText('nowhere');
    });
    await settle();

    expect(subtreeText(tree.root)).toContain(i18n.t('common.noResults'));
    // The empty list itself carries the message (the trigger keeps showing
    // "Select village" - that part is correct, nothing is selected yet).
    const emptyRows = tree.root.findAll(
      (node) => typeof node.props?.children === 'string' && node.props.children === i18n.t('common.noResults'),
    );
    expect(emptyRows.length).toBeGreaterThan(0);

    // Let the FlatList's cell-batch timer fire inside act() rather than after
    // the test, so it does not log an unwrapped state update.
    await settle(2);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    act(() => tree.unmount());
  });
});

describe('DateField iOS sheet', () => {
  it('defaults the confirm button to the localized Done label', async () => {
    expect(Platform.OS).toBe('ios');
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<DateField label="Date of birth" value="2000-01-01" onChange={jest.fn()} />);
    });

    const trigger = labelledPressables(tree).find((node) => node.props.accessibilityLabel === 'Date of birth');
    expect(trigger).toBeDefined();
    await act(async () => {
      trigger!.props.onPress();
    });
    await settle();

    expect(subtreeText(tree.root)).toContain(i18n.t('common.done'));
    act(() => tree.unmount());
  });
});

describe('SearchBar', () => {
  it('runs the caller focus handler and tracks the border', () => {
    const onFocus = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<SearchBar value="" onChangeText={() => {}} placeholder="Search" onFocus={onFocus} />);
    });

    expect(hasClass(tree.root, 'border-outline')).toBe(true);
    const input = firstInput(tree);
    act(() => input.props.onFocus({ nativeEvent: {} }));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(hasClass(tree.root, 'border-primary')).toBe(true);

    act(() => tree.unmount());
  });

  it('offers a clear control only while a query is present', () => {
    const onChangeText = jest.fn();
    let empty!: TestRenderer.ReactTestRenderer;
    let filled!: TestRenderer.ReactTestRenderer;
    act(() => {
      empty = TestRenderer.create(<SearchBar value="" onChangeText={onChangeText} placeholder="Search" />);
      filled = TestRenderer.create(<SearchBar value="rampur" onChangeText={onChangeText} placeholder="Search" />);
    });

    const clearOf = (tree: TestRenderer.ReactTestRenderer) =>
      labelledPressables(tree).find((node) => node.props.accessibilityLabel === i18n.t('common.clear'));

    expect(clearOf(empty)).toBeUndefined();
    expect(hasClass(empty.root, 'pr-4')).toBe(true);

    expect(clearOf(filled)).toBeDefined();
    expect(hasClass(filled.root, 'pr-10')).toBe(true);

    act(() => clearOf(filled)!.props.onPress());
    expect(onChangeText).toHaveBeenCalledWith('');

    act(() => {
      empty.unmount();
      filled.unmount();
    });
  });

  it('merges a caller className over the base field', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<SearchBar value="" onChangeText={() => {}} className="mt-3" />);
    });
    expect(hasClass(tree.root, 'h-12')).toBe(true);
    expect(hasClass(tree.root, 'border')).toBe(true);
    expect(hasClass(tree.root, 'mt-3')).toBe(true);
    act(() => tree.unmount());
  });
});
