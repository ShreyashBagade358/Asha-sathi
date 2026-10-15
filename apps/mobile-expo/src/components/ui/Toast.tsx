import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { shadow } from '@/theme';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export type ToastApi = {
  toast: (message: string, tone?: ToastTone) => void;
};

const TONE_CLS: Record<ToastTone, string> = {
  success: 'bg-tertiary',
  error: 'bg-error',
  info: 'bg-primary',
  warning: 'bg-secondary',
};

/** Success is the only tone the check glyph suits; everything else warns. */
const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'checkCircle',
  error: 'alert',
  info: 'alertCircle',
  warning: 'alert',
};

const DISMISS_MS = 3000;
const FADE_MS = 180;
/**
 * Backlog cap: a retry loop that fails on every press should not replay a
 * growing list of stale messages after the user has moved on.
 */
const MAX_QUEUE = 5;

type QueuedToast = { message: string; tone: ToastTone };
type Phase = 'idle' | 'showing' | 'hiding';

const ToastContext = createContext<ToastApi>({ toast: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/**
 * Port of AdminLayout's ToastContainer: a single bottom-anchored toast with
 *   flex-row items-center gap-2 rounded-lg px-4 py-3 text-body-md text-white
 *   shadow-modal
 * tinted bg-tertiary / bg-error / bg-primary / bg-secondary by tone, auto
 * dismissed after 3s with a fade + slide.
 *
 * Messages raised while one is on screen queue instead of overwriting it, so
 * a "saved" confirmation fired during the previous error's 3s window is still
 * read out rather than silently replacing it. The hold and fade steps are
 * timer-driven (the animations are cosmetic), which keeps the promotion of the
 * next message deterministic under Jest's fake timers.
 *
 * `useToast` falls back to a no-op outside a provider so a screen mounted
 * without one (a Jest smoke test, a modal route) still renders.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<QueuedToast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const queue = useRef<QueuedToast[]>([]);
  const phase = useRef<Phase>('idle');
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // show <-> fade call each other (show schedules the fade, the fade promotes
  // the next message); the back-reference lives in a ref so both callbacks
  // keep stable identities without a dependency cycle.
  const advance = useRef<() => void>(() => {});

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const startFade = useCallback(() => {
    if (phase.current !== 'showing') return;
    phase.current = 'hiding';
    clearHold();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 12, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
    fadeTimer.current = setTimeout(() => {
      fadeTimer.current = null;
      advance.current();
    }, FADE_MS);
  }, [clearHold, opacity, translateY]);

  const show = useCallback(
    (next: QueuedToast) => {
      phase.current = 'showing';
      setCurrent(next);
      translateY.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      clearHold();
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        startFade();
      }, DISMISS_MS);
    },
    [clearHold, startFade, translateY],
  );

  const showNext = useCallback(() => {
    const next = queue.current.shift();
    if (next) {
      show(next);
      return;
    }
    phase.current = 'idle';
    setCurrent(null);
  }, [show]);

  useEffect(() => {
    advance.current = showNext;
  }, [showNext]);

  useEffect(
    () => () => {
      clearHold();
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [clearHold],
  );

  const toast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const entry: QueuedToast = { message, tone };
      if (phase.current === 'idle') {
        show(entry);
        return;
      }
      if (queue.current.length >= MAX_QUEUE) queue.current.shift();
      queue.current.push(entry);
    },
    [show],
  );

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current !== null ? (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 bottom-4 z-50 px-4"
          style={{ paddingBottom: insets.bottom }}
        >
          <Animated.View
            accessibilityLiveRegion="polite"
            style={{ opacity, transform: [{ translateY }] }}
          >
            <Pressable
              accessibilityRole="alert"
              onPress={startFade}
              className={cx('flex-row items-center gap-2 rounded-lg px-4 py-3 shadow-modal', TONE_CLS[current.tone])}
              style={shadow.modal}
            >
              <Icon name={TONE_ICON[current.tone]} size={18} color="#ffffff" />
              <Text className="flex-1 text-body-md text-white">{current.message}</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
