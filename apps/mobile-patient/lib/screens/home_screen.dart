import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_repository.dart';
import '../core/config/app_config.dart';
import '../features/appointments/appointment_model.dart';
import '../features/appointments/appointments_repository.dart';
import '../features/health_records/health_record_model.dart';
import '../features/health_records/health_records_repository.dart';
import '../features/reminders/reminder_model.dart';
import '../features/reminders/reminders_repository.dart';

/// Beneficiary home: greeting, ABHA quick view and action shortcuts.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  List<AppointmentModel> _appointments = [];
  List<HealthRecordModel> _records = [];
  List<ReminderModel> _reminders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final appointments = await ref.read(appointmentsRepositoryProvider).fetchAppointments();
    final records = await ref.read(healthRecordsRepositoryProvider).fetchRecords();
    final reminders = await ref.read(remindersRepositoryProvider).fetchReminders();
    if (mounted) setState(() {
      _appointments = appointments;
      _records = records;
      _reminders = reminders;
      _loading = false;
    });
  }

  AppointmentModel? get _upcoming {
    for (final a in _appointments) {
      if (a.status == 'upcoming' || a.status == 'scheduled') return a;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = ref.watch(authControllerProvider);
    final user = auth is AuthAuthenticated ? auth.user : null;

    final upcoming = _upcoming;
    final dueReminders = _reminders.where((r) => r.status == 'due').length;

    return Scaffold(
      appBar: ASHATopAppBar(title: 'Home'),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.gutter),
          children: [
            Text(
              'Hello, ${user?.name.split(' ').first ?? 'Beneficiary'}',
              style: ASHATypography.headlineMD,
            ),
            Text(
              user?.village ?? 'Registered with ASHA Sathi',
              style: ASHATypography.bodySmall.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHACard(
              onTap: () => context.push('/profile'),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: ASHAColors.abhaTeal.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
                    ),
                    child: const Icon(Icons.health_and_safety_outlined,
                        color: ASHAColors.abhaTeal),
                  ),
                  const SizedBox(width: ASHASpacing.stackMD),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('My ABHA Card', style: ASHATypography.titleMedium),
                        const SizedBox(height: 2),
                        Text(
                          user?.abhaNumber ?? AppConfig.defaultAbhaNumber,
                          style: ASHATypography.bodySmall.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            if (upcoming != null)
              ASHACard(
                onTap: () => context.push('/appointments/${upcoming.id}'),
                child: Row(
                  children: [
                    Icon(Icons.event_available_outlined,
                        color: theme.colorScheme.primary),
                    const SizedBox(width: ASHASpacing.stackMD),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Next appointment', style: ASHATypography.titleMedium),
                          const SizedBox(height: 2),
                          Text(
                            '${upcoming.title} · ${formatDate(upcoming.scheduledAt)}',
                            style: ASHATypography.bodySmall.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    StatusChip(
                      status: statusChipTypeFrom(upcoming.status),
                      label: upcoming.status,
                      compact: true,
                    ),
                  ],
                ),
              ),
            const SizedBox(height: ASHASpacing.stackMD),
            Row(
              children: [
                Expanded(
                  child: _ActionCard(
                    icon: Icons.folder_shared_outlined,
                    label: 'Records',
                    count: '${_records.length}',
                    onTap: () => context.push('/records'),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: _ActionCard(
                    icon: Icons.event_note_outlined,
                    label: 'Appointments',
                    count: '${_appointments.length}',
                    onTap: () => context.push('/appointments'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackSM),
            Row(
              children: [
                Expanded(
                  child: _ActionCard(
                    icon: Icons.alarm_outlined,
                    label: 'Reminders',
                    count: '$dueReminders due',
                    onTap: () => context.push('/reminders'),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: _ActionCard(
                    icon: Icons.volunteer_activism_outlined,
                    label: 'Schemes',
                    count: '3',
                    onTap: () => context.push('/schemes'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHACard(
              onTap: () => context.push('/emergency'),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
                    ),
                    child: Icon(Icons.emergency_outlined,
                        color: theme.colorScheme.error),
                  ),
                  const SizedBox(width: ASHASpacing.stackMD),
                  const Expanded(
                    child: Text('Emergency support',
                        style: ASHATypography.titleMedium),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHACard(
              onTap: () => context.push('/grievance'),
              child: Row(
                children: [
                  Icon(Icons.report_problem_outlined,
                      color: theme.colorScheme.onSurfaceVariant),
                  const SizedBox(width: ASHASpacing.stackMD),
                  const Expanded(
                    child: Text('Raise a grievance',
                        style: ASHATypography.titleMedium),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.label,
    required this.count,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ASHACard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: theme.colorScheme.primary),
          const SizedBox(height: ASHASpacing.stackMD),
          Text(count, style: ASHATypography.headlineLG),
          const SizedBox(height: 2),
          Text(
            label,
            style: ASHATypography.bodySmall.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
