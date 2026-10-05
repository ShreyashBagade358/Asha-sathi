import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
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

const DISMISS_MS = 3000;

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
 * `useToast` falls back to a no-op outside a provider so a screen mounted
 * without one (a Jest smoke test, a modal route) still renders.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>('success');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 12, duration: 180, useNativeDriver: true }),
    ]).start(() => setMessage(null));
  }, [opacity, translateY]);

  const toast = useCallback(
    (next: string, nextTone: ToastTone = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      setTone(nextTone);
      translateY.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(() => {
        timer.current = null;
        dismiss();
      }, DISMISS_MS);
    },
    [dismiss, opacity, translateY],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message !== null ? (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 bottom-4 z-50 px-4"
          style={{ paddingBottom: insets.bottom }}
        >
          <Animated.View style={{ opacity, transform: [{ translateY }] }}>
            <Pressable
              accessibilityRole="alert"
              onPress={() => {
                if (timer.current) clearTimeout(timer.current);
                dismiss();
              }}
              className={cx('flex-row items-center gap-2 rounded-lg px-4 py-3 shadow-modal', TONE_CLS[tone])}
              style={shadow.modal}
            >
              <Icon name={tone === 'error' ? 'alert' : 'checkCircle'} size={18} color="#ffffff" />
              <Text className="flex-1 text-body-md text-white">{message}</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
