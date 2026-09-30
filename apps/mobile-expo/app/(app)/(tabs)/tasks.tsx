import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Icon } from '@/components/ui/Icon';
import { PageHeader, Pill } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { listTasks, setTaskStatus, type TaskFilter, type TaskWithPatient } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';
import { scheduleSync } from '@/sync/network';
import { cx } from '@/cx';

const FILTERS: TaskFilter[] = ['pending', 'done', 'all'];

function isDone(task: TaskWithPatient): boolean {
  return task.status === 'completed' || task.status === 'done';
}

export default function TasksScreen() {
  const { t } = useLocalization();
  const [filter, setFilter] = useState<TaskFilter>('pending');
  const [tasks, setTasks] = useState<TaskWithPatient[]>([]);

  const load = useCallback(async () => {
    setTasks(await listTasks('all'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = {
    pending: tasks.filter((task) => !isDone(task)).length,
    done: tasks.filter(isDone).length,
    all: tasks.length,
  };

  const visible = tasks.filter((task) => {
    if (filter === 'all') return true;
    return filter === 'done' ? isDone(task) : !isDone(task);
  });

  const toggle = async (task: TaskWithPatient) => {
    const next = !isDone(task);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Optimistic, matching the web store's instant flip; setTaskStatus then
    // commits the row and the outbox entry in one transaction.
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, status: next ? 'completed' : 'pending' } : x)));
    try {
      await setTaskStatus(task, next);
      scheduleSync(400);
    } finally {
      void load();
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-4 pb-28" showsVerticalScrollIndicator={false}>
        <PageHeader title={t('asha.tasksTitle')} subtitle={t('asha.tasksSubtitle')}
          actions={
            <>
              <LanguageToggle onSurface />
              <MoreButton />
            </>
          }
        />

        <View className="mb-4 flex-row gap-2">
          {FILTERS.map((key) => (
            <Pill
              key={key}
              label={t(`asha.filter${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
              count={counts[key]}
              active={filter === key}
              onPress={() => setFilter(key)}
            />
          ))}
        </View>

        {visible.length === 0 ? (
          <EmptyState icon="checkCircle" title={t('asha.noTasks')} description={t('asha.noTasksHint')} />
        ) : (
          <View className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            {visible.map((task, index) => {
              const done = isDone(task);
              return (
                <View
                  key={task.id}
                  className={cx(
                    'flex-row items-center gap-3 p-4',
                    index < visible.length - 1 && 'border-b border-outline-variant/40',
                    done && 'bg-surface-container-low/60',
                  )}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={done ? t('asha.markPending') : t('asha.markDone')}
                    onPress={() => void toggle(task)}
                    className={cx('h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-90', done ? 'bg-secondary-container' : 'bg-tertiary-container')}
                  >
                    <Icon name={done ? 'checkCircle' : 'check'} size={24} />
                  </Pressable>

                  <View className="flex-1">
                    <Text className={cx('font-label-md text-label-md font-semibold text-on-surface', done && 'opacity-60 line-through')}>
                      {task.task_type ?? t('asha.pendingTasks')}
                    </Text>
                    <Text numberOfLines={1} className="font-caption text-caption text-on-surface-variant">
                      {[task.patient_name, task.household_hhid].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </View>

                  <View className={cx('shrink-0 rounded-full px-2.5 py-1', done ? 'bg-secondary-container' : 'bg-surface-container')}>
                    <Text className="font-caption text-caption font-semibold text-on-surface-variant">
                      {task.scheduled_time ?? task.task_date ?? '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
          <View className="flex-1 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-container">
              <Icon name="activity" size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('asha.upcomingTasks')}</Text>
              <Text className="font-caption text-caption text-on-surface-variant">{t('asha.upcomingHint')}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="link" onPress={() => setFilter('all')} className="flex-row items-center gap-1">
            <Text className="font-label-md text-label-md font-semibold text-primary">{t('asha.viewAgenda')}</Text>
            <Icon name="chevronRight" size={16} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
