import React from 'react';
import { ActivityIndicator } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ToastProvider, useToast, type ToastApi } from '@/components/ui/Toast';
import i18n from '@/i18n';

import { hasClass, labelledPressables, subtreeText } from './ui-helpers';

/**
 * The three block states (loading / empty / error) plus the toast queue:
 *  - a second toast raised during the first one's 3s window waits its turn
 *    instead of overwriting it,
 *  - ErrorState reads its retry label from the locale (it used to hardcode
 *    the English "Retry", which stayed English under the Hindi toggle),
 *  - LoadingState exists so screens stop borrowing EmptyState for busy.
 */

let toastApi: ToastApi = { toast: () => {} };

function CaptureToast() {
  toastApi = useToast();
  return null;
}

function renderToasts(): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ToastProvider>
        <CaptureToast />
      </ToastProvider>,
    );
  });
  return tree;
}

describe('Toast queue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    toastApi = { toast: () => {} };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('holds the current toast and queues the next one behind it', () => {
    const tree = renderToasts();

    act(() => toastApi.toast('Profile saved', 'success'));
    expect(subtreeText(tree.root)).toContain('Profile saved');
    expect(hasClass(tree.root, 'bg-tertiary')).toBe(true);

    act(() => toastApi.toast('Upload failed', 'error'));
    // The new message must not clobber the one still on screen.
    expect(subtreeText(tree.root)).toContain('Profile saved');
    expect(subtreeText(tree.root)).not.toContain('Upload failed');

    // 3s hold + 180ms fade, both timer-driven.
    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(subtreeText(tree.root)).toContain('Upload failed');
    expect(hasClass(tree.root, 'bg-error')).toBe(true);

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(subtreeText(tree.root)).not.toContain('Upload failed');

    act(() => tree.unmount());
  });

  it('drains a backlog in order', () => {
    const tree = renderToasts();

    act(() => toastApi.toast('one'));
    act(() => toastApi.toast('two'));
    act(() => toastApi.toast('three'));

    expect(subtreeText(tree.root)).toContain('one');

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(subtreeText(tree.root)).toContain('two');
    expect(subtreeText(tree.root)).not.toContain('one');

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(subtreeText(tree.root)).toContain('three');
    expect(subtreeText(tree.root)).not.toContain('two');

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(subtreeText(tree.root)).not.toContain('three');

    act(() => tree.unmount());
  });

  it('tapping the toast dismisses it early and promotes the next', () => {
    const tree = renderToasts();

    act(() => toastApi.toast('first'));
    act(() => toastApi.toast('second'));

    const toast = tree.root.findAll((node) => node.props?.accessibilityRole === 'alert')[0]!;
    expect(toast).toBeDefined();
    act(() => toast.props.onPress());
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(subtreeText(tree.root)).toContain('second');
    expect(subtreeText(tree.root)).not.toContain('first');

    act(() => tree.unmount());
  });

  it('falls back to a no-op outside a provider', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<CaptureToast />);
    });
    expect(() => toastApi.toast('no provider')).not.toThrow();
    expect(subtreeText(tree.root)).toBe('');
    act(() => tree.unmount());
  });
});

describe('ErrorState', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('takes the retry label from the locale', async () => {
    await act(async () => {
      await i18n.changeLanguage('hi');
    });

    const onRetry = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ErrorState message="Could not load records" onRetry={onRetry} />);
    });

    const retry = labelledPressables(tree).find((node) => node.props.accessibilityRole === 'button');
    expect(retry).toBeDefined();
    expect(retry!.props.accessibilityLabel).toBe(i18n.t('common.retry'));
    expect(subtreeText(tree.root)).toContain(i18n.t('common.retry'));
    // 44pt hit area: py-2 alone is 36px.
    expect(hasClass(tree.root, 'min-h-11')).toBe(true);
    // Same shell footprint as EmptyState so the card does not jump between states.
    expect(hasClass(tree.root, 'rounded-2xl')).toBe(true);
    expect(hasClass(tree.root, 'shadow-card')).toBe(true);

    act(() => retry!.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  it('keeps an explicit retryLabel and skips the button without a handler', () => {
    let withHandler!: TestRenderer.ReactTestRenderer;
    let without!: TestRenderer.ReactTestRenderer;
    act(() => {
      withHandler = TestRenderer.create(<ErrorState message="boom" retryLabel="Try again" onRetry={jest.fn()} />);
      without = TestRenderer.create(<ErrorState message="boom" />);
    });

    const retry = labelledPressables(withHandler).find((node) => node.props.accessibilityRole === 'button');
    expect(retry!.props.accessibilityLabel).toBe('Try again');
    expect(labelledPressables(without).find((node) => node.props.accessibilityRole === 'button')).toBeUndefined();

    act(() => {
      withHandler.unmount();
      without.unmount();
    });
  });
});

describe('EmptyState', () => {
  it('renders title, description and the pill CTA', () => {
    const onActionPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <EmptyState title="No patients yet" description="Registered beneficiaries appear here" actionLabel="Add patient" onActionPress={onActionPress} />,
      );
    });

    const body = subtreeText(tree.root);
    expect(body).toContain('No patients yet');
    expect(body).toContain('Registered beneficiaries appear here');

    // Button derives its label from its child text, so it has no
    // accessibilityLabel to search on - find it by role instead.
    const cta = tree.root.findAll(
      (node) => typeof node.props?.onPress === 'function' && node.props?.accessibilityRole === 'button',
    )[0];
    expect(cta).toBeDefined();
    act(() => cta!.props.onPress());
    expect(onActionPress).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });
});

describe('LoadingState', () => {
  it('announces the localized busy label in the shared state shell', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<LoadingState />);
    });

    expect(subtreeText(tree.root)).toContain(i18n.t('common.loading'));
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(1);
    expect(hasClass(tree.root, 'rounded-2xl')).toBe(true);
    expect(hasClass(tree.root, 'shadow-card')).toBe(true);

    act(() => tree.unmount());
  });

  it('accepts a caller label', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<LoadingState label="Loading households" />);
    });
    expect(subtreeText(tree.root)).toContain('Loading households');
    act(() => tree.unmount());
  });
});
