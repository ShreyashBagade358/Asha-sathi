import { Pressable, ScrollView, Text, View } from 'react-native';

import { cx } from '@/cx';

export type TabItem = {
  key: string;
  label: string;
};

export type TabsProps = {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
};

/**
 * The underline tab strip from PatientDetailsAshaSathi:
 *   border-b border-outline-variant > flex gap-6 > button
 *   whitespace-nowrap border-b-2 pb-2 font-label-md text-label-md font-semibold
 *   active: border-primary text-primary / inactive: border-transparent
 * text-on-surface-variant
 *
 * The web wraps it in overflow-x-auto; here it is a horizontal ScrollView so a
 * five-tab strip still fits a 360px phone.
 */
export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <View className={cx('border-b border-outline-variant', className)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row gap-6"
        keyboardShouldPersistTaps="handled"
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab.key === active }}
            onPress={() => onChange(tab.key)}
            className={cx(
              'shrink-0 border-b-2 pb-2',
              'font-label-md text-label-md font-semibold',
              tab.key === active ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant',
            )}
          >
            <Text
              className={cx(
                'font-label-md text-label-md font-semibold',
                tab.key === active ? 'text-primary' : 'text-on-surface-variant',
              )}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
