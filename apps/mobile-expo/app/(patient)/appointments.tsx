import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, Pill } from '@/components/ui/Card';
import { DateField, SelectField, TextField } from '@/components/ui/Field';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { listFollowUps, setFollowUpDone, type FollowUp } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { listAppointments } from '@/patient/appointments';
import { createAppointmentRequest } from '@/patient/api';
import type { Appointment, AppointmentStatus } from '@/patient/types';
import { dateToIso } from '@/utils/date';

type TabKey = 'all' | AppointmentStatus;

type State = { appointments: Appointment[]; followUps: FollowUp[] };

const REASON_KEYS = [
  { value: 'anc', labelKey: 'patient.reasonAnc' },
  { value: 'child', labelKey: 'patient.reasonChild' },
  { value: 'pnc', labelKey: 'patient.reasonPnc' },
  { value: 'general', labelKey: 'patient.reasonGeneral' },
] as const;

export default function PatientAppointmentsScreen() {
  const { t } = useLocalization();
  const { toast } = useToast();
  const [data, setData] = useState<State | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [filter, setFilter] = useState<TabKey>('upcoming');
  const [attended, setAttended] = useState<Record<string, boolean>>({});
  const [busyFollowUp, setBusyFollowUp] = useState<string | null>(null);

  // Booking form state
  const [booking, setBooking] = useState(false);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [appointments, followUps] = await Promise.all([listAppointments(), listFollowUps()]);
      setData({ appointments, followUps });
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, []);

  const markDone = async (fu: FollowUp) => {
    if (busyFollowUp) return;
    setBusyFollowUp(fu.id);
    try {
      await setFollowUpDone(fu, true);
      setData((prev) =>
        prev ? { ...prev, followUps: prev.followUps.filter((row) => row.id !== fu.id) } : prev,
      );
      toast(t('asha.fuDoneToast'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.errorMsg'), 'error');
    } finally {
      setBusyFollowUp(null);
    }
  };

  const submitBooking = async () => {
    if (bookingBusy) return;
    if (!reason) {
      setBookingError(t('patient.selectReason'));
      return;
    }
    if (!date) {
      setBookingError(t('patient.selectDateError'));
      return;
    }
    setBookingBusy(true);
    setBookingError(null);
    try {
      const reasonLabel =
        REASON_KEYS.find((r) => r.value === reason)?.labelKey ?? reason;
      await createAppointmentRequest({
        reason: t(reasonLabel),
        preferredDate: date,
        preferredTime: time || undefined,
        notes: notes || undefined,
      });
      setBooking(false);
      setReason('');
      setDate('');
      setTime('');
      setNotes('');
      toast(t('patient.appointmentBooked'), 'success');
      await load();
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : t('common.errorMsg'));
    } finally {
      setBookingBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const appointments = data?.appointments ?? [];
  const followUps = data?.followUps ?? [];

  const upcomingCount = appointments.filter((a) => a.status === 'upcoming').length;
  const pastCount = appointments.filter((a) => a.status === 'past').length;
  const visible = appointments.filter((a) => (filter === 'all' ? true : a.status === filter));

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'upcoming', label: t('patient.tabUpcoming'), count: upcomingCount },
    { key: 'past', label: t('patient.tabPast'), count: pastCount },
    { key: 'all', label: t('patient.tabAll'), count: appointments.length },
  ];

  return (
    <Screen
      title={t('patient.appointmentsTitle')}
      subtitle={t('patient.appointmentsSubtitle')}
      back
      withTabBar={false}
      actions={
        <Button
          label={t('patient.bookAppointment')}
          icon="plus"
          shape="pill"
          onPress={() => {
            setBookingError(null);
            setBooking(true);
          }}
          testID="book-appointment"
        />
      }
    >
      {status === 'failed' ? (
        <ErrorState message={t('common.errorMsg')} onRetry={() => void load()} />
      ) : status === 'loading' ? (
        <LoadingState />
      ) : (
        <>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {tabs.map((tab) => (
              <Pill
                key={tab.key}
                label={tab.label}
                count={tab.count}
                active={filter === tab.key}
                onPress={() => setFilter(tab.key)}
              />
            ))}
          </View>

          {visible.length === 0 ? (
            <Card className="mb-6">
              <Text className="p-6 text-center text-body-md text-body-md text-on-surface-variant">
                {filter === 'upcoming' ? t('patient.noUpcomingAppointments') : t('patient.noPastAppointments')}
              </Text>
            </Card>
          ) : (
            <View className="mb-6 gap-3">
              {visible.map((appointment) => {
                const isAttended = attended[appointment.id];
                return (
                  <Card key={appointment.id}>
                    <View className="flex-row items-start justify-between gap-3 p-4">
                      <View className="flex-row items-center gap-3">
                        <View
                          className={cx(
                            'h-11 w-11 shrink-0 items-center justify-center rounded-full',
                            appointment.status === 'upcoming'
                              ? 'bg-primary-container'
                              : 'bg-surface-container-high',
                          )}
                        >
                          <Icon name="calendar" size={22} />
                        </View>
                        <View>
                          <Text className="text-label-md text-label-md font-semibold text-on-surface">
                            {appointment.type}
                          </Text>
                          {appointment.doctor ? (
                            <Text className="text-caption text-caption text-on-surface-variant">
                              {appointment.doctor}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Pill
                        label={appointment.status === 'upcoming' ? t('patient.tabUpcoming') : t('patient.tabPast')}
                        active={appointment.status === 'upcoming'}
                        disabled
                      />
                    </View>

                    <View className="flex-row flex-wrap gap-x-6 gap-y-1 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                      <View className="flex-row items-center gap-1.5">
                        <Icon name="mapPin" size={14} />
                        <Text className="text-caption text-caption text-on-surface-variant">
                          {appointment.location}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Icon name="calendar" size={14} />
                        <Text className="text-caption text-caption text-on-surface-variant">
                          {appointment.date} · {appointment.time}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}

          <Text className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">
            {t('patient.followUps')}
          </Text>
          {followUps.length === 0 ? (
            <Card>
              <Text className="p-6 text-center text-body-md text-body-md text-on-surface-variant">
                {t('patient.noUpcoming')}
              </Text>
            </Card>
          ) : (
            <View className="gap-3">
              {followUps.map((fu) => (
                <Card key={fu.id}>
                  <View className="flex-row items-center gap-3 p-4">
                    <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tertiary-container">
                      <Icon name="activity" size={22} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-label-md text-label-md font-semibold text-on-surface" numberOfLines={1}>
                        {fu.title}
                      </Text>
                      <Text className="text-caption text-caption text-on-surface-variant" numberOfLines={1}>
                        {fu.due_date ?? '—'} · {fu.detail ?? t('asha.fuScheduled')}
                      </Text>
                    </View>
                    <Button
                      label={t('asha.fuMarkDone')}
                      icon="check"
                      shape="pill"
                      variant="secondary"
                      loading={busyFollowUp === fu.id}
                      disabled={busyFollowUp !== null && busyFollowUp !== fu.id}
                      onPress={() => void markDone(fu)}
                      testID={`follow-up-done-${fu.id}`}
                    />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </>
      )}

      <Modal visible={booking} onClose={() => setBooking(false)} title={t('patient.bookAppointmentTitle')}>
        <View className="gap-4 pb-2">
          <Text className="text-body-md text-on-surface-variant">
            {t('patient.bookAppointmentSubtitle')}
          </Text>

          <SelectField
            label={t('patient.selectReason')}
            value={reason}
            options={REASON_KEYS.map((r) => ({ label: t(r.labelKey), value: r.value }))}
            onChange={setReason}
            placeholder={t('patient.selectReason')}
            errorText={bookingError && !reason ? t('patient.selectReason') : undefined}
          />

          <DateField
            label={t('patient.preferredDate')}
            value={date}
            onChange={setDate}
            placeholder={t('patient.preferredDate')}
            minIso={dateToIso(new Date())}
            errorText={bookingError && !date ? t('patient.selectDateError') : undefined}
          />

          <TextField
            label={t('patient.preferredTime')}
            value={time}
            onChangeText={setTime}
            placeholder="10:00 AM"
            autoCapitalize="none"
          />

          <TextField
            label={t('patient.addNotes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('patient.addNotes')}
            multiline
            numberOfLines={2}
          />

          {bookingError ? (
            <Text className="text-caption text-error">{bookingError}</Text>
          ) : null}

          <Button
            label={t('patient.bookAppointment')}
            icon="calendar"
            shape="pill"
            full
            loading={bookingBusy}
            onPress={() => void submitBooking()}
            testID="submit-booking"
          />
        </View>
      </Modal>
    </Screen>
  );
}
