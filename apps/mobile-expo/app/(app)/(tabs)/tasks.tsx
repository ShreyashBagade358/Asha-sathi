import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { DailyPlanCard, formatDay, type ViewTask } from '@/components/asha/DailyPlanCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, Pill } from '@/components/ui/Card';
import {
  listTasks,
  readTaskMetadata,
  setTaskStatus,
  type TaskFilter,
  type TaskWithPatient,
} from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';
import { scheduleSync } from '@/sync/network';
import { cx } from '@/cx';
import { colors } from '@/theme';

const FILTERS: TaskFilter[] = ['pending', 'done', 'all'];

type T = ReturnType<typeof useLocalization>['t'];

/**
 * Server task types are codes, so each one carries its own label key. A code
 * with no entry falls through to the raw value: it is data from the server, and
 * guessing a translation for an unknown code would show the worker the wrong
 * name rather than the true one.
 */
const TASK_TITLE_KEY: Record<string, string> = {
  anc_visit: 'asha.taskTypeAncVisit',
  pnc_visit: 'asha.taskTypePncVisit',
  ec_followup: 'asha.taskTypeEcFollowup',
  ncd_followup: 'asha.taskTypeNcdFollowup',
  immunization: 'asha.taskTypeImmunization',
  child_checkup: 'asha.taskTypeChildCheckup',
  referral_followup: 'asha.taskTypeReferralFollowup',
  household_visit: 'asha.taskTypeHouseholdVisit',
};

const PRIORITY_KEY: Record<string, string> = {
  high: 'asha.priorityHigh',
  medium: 'asha.priorityMedium',
  low: 'asha.priorityLow',
};

const PRIORITY_CLS: Record<string, string> = {
  high: 'bg-error-container text-on-error-container',
  medium: 'bg-tertiary-container text-on-tertiary-container',
  low: 'bg-surface-variant text-on-surface-variant',
};

function isDone(task: TaskWithPatient): boolean {
  return task.status === 'completed' || task.status === 'done';
}

function taskTitle(code: string, t: T): string {
  const key = TASK_TITLE_KEY[code];
  return key ? t(key) : code;
}

function priorityLabel(priority: string | null, t: T): string {
  const key = priority ? PRIORITY_KEY[priority] : undefined;
  return key ? t(key) : (priority ?? '');
}

function scheduledLabel(iso: string | null, t: T): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');
  return `${t('asha.detailScheduled')} ${hour}:${minute}`;
}

function toViewTask(task: TaskWithPatient, t: T): ViewTask {
  const meta = readTaskMetadata(task);
  const code = task.task_type ?? '';
  return {
    id: task.id,
    title: taskTitle(code, t),
    subtitle: task.notes || scheduledLabel(task.scheduled_time, t),
    done: isDone(task),
    due: task.task_date ?? '',
    priority: task.priority ?? '',
    status: task.status ?? '',
    householdId: task.household_id ?? undefined,
    householdHhid: task.household_hhid ?? undefined,
    householdLabel: [task.patient_name, task.household_hhid].filter(Boolean).join(' · '),
    carriedFrom: typeof meta.carried_from === 'string' ? meta.carried_from : undefined,
  };
}

export default function TasksScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const [filter, setFilter] = useState<TaskFilter>('pending');
  const [tasks, setTasks] = useState<TaskWithPatient[]>([]);
  const [selected, setSelected] = useState<TaskWithPatient | null>(null);

  const load = useCallback(async () => {
    setTasks(await listTasks('all'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const view = useMemo(() => tasks.map((task) => toViewTask(task, t)), [tasks, t]);

  const counts = {
    pending: view.filter((task) => !task.done).length,
    done: view.filter((task) => task.done).length,
    all: view.length,
  };

  const visible = view.filter((task) => {
    if (filter === 'all') return true;
    return filter === 'done' ? task.done : !task.done;
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

  const selectedTask = selected ? toViewTask(selected, t) : null;

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-4 pb-28" showsVerticalScrollIndicator={false}>
        <PageHeader
          title={t('asha.tasksTitle')}
          subtitle={t('asha.tasksSubtitle')}
          actions={
            <>
              <LanguageToggle onSurface />
              <MoreButton />
            </>
          }
        />

        <DailyPlanCard tasks={view} />

        <View className="mb-4 flex-row flex-wrap gap-2">
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
          <EmptyTasks onAction={() => setFilter('all')} />
        ) : (
          <View className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            {visible.map((task, index) => {
              const source = tasks.find((row) => row.id === task.id);
              const done = task.done;
              const startVisit = Boolean(task.householdId && task.householdHhid && !done);
              return (
                <View
                  key={task.id}
                  testID={source?.task_type ?? undefined}
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
                    onPress={() => source && void toggle(source)}
                    className={cx(
                      'h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-90',
                      done ? 'bg-secondary-container' : 'bg-tertiary-container',
                    )}
                  >
                    <Icon name={done ? 'checkCircle' : 'check'} size={24} />
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => source && setSelected(source)}
                    className="min-w-0 flex-1"
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text
                        className={cx(
                          'font-label-md text-label-md font-semibold text-on-surface',
                          done && 'line-through opacity-60',
                        )}
                      >
                        {task.title}
                      </Text>
                      {task.priority && !done ? (
                        <View className={cx('rounded-full px-2 py-0.5', PRIORITY_CLS[task.priority] ?? PRIORITY_CLS.low)}>
                          <Text className="font-caption text-[11px] font-semibold">
                            {priorityLabel(task.priority, t)}
                          </Text>
                        </View>
                      ) : null}
                      {task.carriedFrom && !done ? (
                        <View className="rounded-full bg-tertiary-container px-2 py-0.5">
                          <Text className="font-caption text-[11px] font-semibold text-on-tertiary-container">
                            {`${t('asha.carriedBadge')} ${formatDay(task.carriedFrom)}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {task.householdLabel ? (
                      <Text className="font-caption text-caption text-on-surface-variant" numberOfLines={1}>
                        {task.householdLabel}
                      </Text>
                    ) : null}
                    {task.subtitle ? (
                      <Text className="font-caption text-caption text-on-surface-variant" numberOfLines={1}>
                        {task.subtitle}
                      </Text>
                    ) : null}
                  </Pressable>

                  <View className="shrink-0">
                    {startVisit ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={t('asha.navigateTo', { name: task.householdLabel })}
                        onPress={() => task.householdId && router.push(`/household/${task.householdId}/visit`)}
                        className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-1.5"
                      >
                        <Text className="font-label-md text-label-md font-semibold text-on-primary">
                          {t('asha.startVisit')}
                        </Text>
                        <Icon name="chevronRight" size={14} color={colors.onPrimary} />
                      </Pressable>
                    ) : (
                      <View className={cx('rounded-full px-2.5 py-1', done ? 'bg-secondary-container' : 'bg-surface-variant')}>
                        <Text
                          className={cx(
                            'font-caption text-caption font-semibold',
                            done ? 'text-on-secondary-container' : 'text-on-surface-variant',
                          )}
                        >
                          {formatDay(task.due)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
          <View className="flex-1 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-container">
              <Icon name="activity" size={20} color={colors.onPrimaryContainer} />
            </View>
            <View className="flex-1">
              <Text className="font-label-md text-label-md font-semibold text-on-surface">
                {t('asha.upcomingTasks')}
              </Text>
              <Text className="font-caption text-caption text-on-surface-variant">{t('asha.upcomingHint')}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="link" onPress={() => setFilter('all')} className="flex-row items-center gap-1">
            <Text className="font-label-md text-label-md font-semibold text-primary">{t('asha.viewAgenda')}</Text>
            <Icon name="chevronRight" size={16} />
          </Pressable>
        </View>
      </ScrollView>

      <TaskDetailModal
        task={selectedTask}
        taskType={selected?.task_type ?? null}
        onClose={() => setSelected(null)}
        onToggle={() => {
          if (selected) void toggle(selected);
          setSelected(null);
        }}
        onStartVisit={() => {
          const id = selectedTask?.householdId;
          setSelected(null);
          if (id) router.push(`/household/${id}/visit`);
        }}
      />
    </View>
  );
}

function TaskDetailModal({
  task,
  taskType,
  onClose,
  onToggle,
  onStartVisit,
}: {
  task: ViewTask | null;
  taskType: string | null;
  onClose: () => void;
  onToggle: () => void;
  onStartVisit: () => void;
}) {
  const { t } = useLocalization();
  if (!task) return null;

  const canVisit = Boolean(task.householdId && !task.done);

  return (
    <Modal visible onClose={onClose} title={task.title}>
      <View className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          {task.priority ? (
            <View className={cx('rounded-full px-2.5 py-1', PRIORITY_CLS[task.priority] ?? PRIORITY_CLS.low)}>
              <Text className="font-caption text-caption font-semibold">
                {priorityLabel(task.priority, t)}
              </Text>
            </View>
          ) : null}
          <View className={cx('rounded-full px-2.5 py-1', task.done ? 'bg-secondary-container' : 'bg-surface-container')}>
            <Text className="font-caption text-caption font-semibold text-on-surface-variant">{task.status}</Text>
          </View>
        </View>

        <Meta label={t('asha.detailType')} value={taskType ?? '—'} />
        {task.householdLabel ? <Meta label={t('asha.detailHousehold')} value={task.householdLabel} /> : null}
        <Meta label={t('common.date')} value={formatDay(task.due) || '—'} />
        <Meta label={t('asha.detailNotes')} value={task.subtitle || '—'} />
        {task.carriedFrom ? <Meta label={t('asha.carriedBadge')} value={formatDay(task.carriedFrom)} /> : null}

        <View className="mt-1 flex-row flex-wrap gap-2">
          <Button label={task.done ? t('asha.markPending') : t('asha.markDone')} shape="pill" onPress={onToggle} />
          {canVisit ? (
            <Button label={t('asha.startVisit')} variant="secondary" shape="pill" onPress={onStartVisit} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="font-caption text-caption text-on-surface-variant">{label}</Text>
      <Text className="font-body-md text-body-md text-on-surface">{value}</Text>
    </View>
  );
}

/**
 * The mock's empty block: a 128px disc with the same pulse the web draws from
 * `animate-pulse`, the copy from the design, and the primary-container pill
 * that sends the worker to the whole agenda.
 */
function EmptyTasks({ onAction }: { onAction: () => void }) {
  const { t } = useLocalization();
  const [pulse] = useState(() => new Animated.Value(0.06));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.16, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.06, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View className="items-center justify-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-14 shadow-card">
      <View className="h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-surface-container-high shadow-sm">
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 999,
            backgroundColor: colors.secondary,
            opacity: pulse,
          }}
        />
        <Icon name="checkCircle" size={64} color={colors.secondary} />
      </View>
      <View className="gap-1 px-6">
        <Text className="text-center font-headline-md text-headline-md text-on-surface">{t('asha.noTasks')}</Text>
        <Text className="text-center font-body-md text-body-md text-on-surface-variant">{t('asha.noTasksHint')}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        className="flex-row items-center gap-1 rounded-full bg-primary-container px-4 py-2.5 active:opacity-90"
      >
        <Text className="font-label-md text-label-md font-semibold text-on-primary">
          {t('asha.viewUpcomingTasks')}
        </Text>
        <Icon name="chevronRight" size={16} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}
