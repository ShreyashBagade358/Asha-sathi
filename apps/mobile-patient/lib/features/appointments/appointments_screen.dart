import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'appointment_model.dart';
import 'appointments_repository.dart';

/// Upcoming and past appointments.
class AppointmentsScreen extends ConsumerStatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  ConsumerState<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends ConsumerState<AppointmentsScreen> {
  List<AppointmentModel> _appointments = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final appointments =
        await ref.read(appointmentsRepositoryProvider).fetchAppointments();
    if (mounted) setState(() {
      _appointments = appointments;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final upcoming = _appointments.where((a) => a.isUpcoming).toList();
    final past = _appointments.where((a) => !a.isUpcoming).toList();

    return Scaffold(
      appBar: ASHATopAppBar(title: 'Appointments'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(ASHASpacing.gutter),
                children: [
                  ASHASectionHeader(title: 'Upcoming'),
                  const SizedBox(height: ASHASpacing.stackSM),
                  if (upcoming.isEmpty)
                    const ASHACard(child: Text('No upcoming appointments.'))
                  else
                    for (final appointment in upcoming) ...[
                      _AppointmentTile(
                        appointment: appointment,
                        onTap: () =>
                            context.push('/appointments/${appointment.id}'),
                      ),
                      const SizedBox(height: ASHASpacing.stackSM),
                    ],
                  const SizedBox(height: ASHASpacing.stackMD),
                  ASHASectionHeader(title: 'Past'),
                  const SizedBox(height: ASHASpacing.stackSM),
                  if (past.isEmpty)
                    const ASHACard(child: Text('No past appointments.'))
                  else
                    for (final appointment in past) ...[
                      _AppointmentTile(
                        appointment: appointment,
                        onTap: () =>
                            context.push('/appointments/${appointment.id}'),
                      ),
                      const SizedBox(height: ASHASpacing.stackSM),
                    ],
                ],
              ),
            ),
    );
  }
}

class _AppointmentTile extends StatelessWidget {
  const _AppointmentTile({required this.appointment, required this.onTap});

  final AppointmentModel appointment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheduledAt = appointment.scheduledAt ?? DateTime.now();
    final dateText = DateFormat('EEE, dd MMM').format(scheduledAt);
    final timeText = DateFormat('hh:mm a').format(scheduledAt);

    return ASHACard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 52,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
            ),
            child: Column(
              children: [
                Text(
                  DateFormat('dd').format(scheduledAt),
                  style: ASHATypography.titleLarge.copyWith(
                    color: theme.colorScheme.primary,
                  ),
                ),
                Text(
                  DateFormat('MMM').format(scheduledAt).toUpperCase(),
                  style: ASHATypography.labelMD.copyWith(
                    color: theme.colorScheme.primary,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(appointment.title, style: ASHATypography.titleMedium),
                const SizedBox(height: 2),
                Text(
                  '$dateText · $timeText',
                  style: ASHATypography.bodySmall.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  appointment.facilityName.isEmpty ? '' : appointment.facilityName,
                  style: ASHATypography.bodySmall.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: ASHASpacing.stackSM),
          StatusChip(
            status: statusChipTypeFrom(appointment.status),
            label: appointment.status,
            compact: true,
          ),
        ],
      ),
    );
  }
}
