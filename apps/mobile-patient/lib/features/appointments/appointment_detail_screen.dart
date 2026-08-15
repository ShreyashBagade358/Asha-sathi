import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'appointment_model.dart';
import 'appointments_repository.dart';

/// Details of one appointment with reschedule / cancel actions.
class AppointmentDetailScreen extends ConsumerStatefulWidget {
  const AppointmentDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<AppointmentDetailScreen> createState() =>
      _AppointmentDetailScreenState();
}

class _AppointmentDetailScreenState
    extends ConsumerState<AppointmentDetailScreen> {
  AppointmentModel? _appointment;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final appointment =
        await ref.read(appointmentsRepositoryProvider).fetchById(widget.id);
    if (mounted) setState(() {
      _appointment = appointment;
      _loading = false;
    });
  }

  Future<void> _cancel() async {
    if (_busy) return;
    setState(() => _busy = true);
    await ref.read(appointmentsRepositoryProvider).cancel(widget.id);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _appointment = _appointment?.copyWith(status: 'cancelled');
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Appointment cancelled')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final appointment = _appointment;
    final cancellable = appointment != null && appointment.isUpcoming;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Appointment',
        onBack: () => context.pop(),
      ),
      body: _loading || appointment == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ASHACard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              appointment.title,
                              style: ASHATypography.titleLarge,
                            ),
                          ),
                          StatusChip(
                            status: statusChipTypeFrom(appointment.status),
                            label: appointment.status,
                          ),
                        ],
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      Text(
                        _formatSlot(appointment.scheduledAt ?? DateTime.now()),
                        style: ASHATypography.titleMedium.copyWith(
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Details'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    children: [
                      _InfoRow(icon: Icons.location_on_outlined, label: 'Facility', value: appointment.facilityName.isEmpty ? '—' : appointment.facilityName),
                      _InfoRow(icon: Icons.person_outline, label: 'Provider', value: appointment.providerName.isEmpty ? '—' : appointment.providerName),
                      _InfoRow(icon: Icons.description_outlined, label: 'Purpose', value: appointment.purpose.isEmpty ? '—' : appointment.purpose),
                      if (appointment.notes.isNotEmpty)
                        _InfoRow(icon: Icons.sticky_note_2_outlined, label: 'Notes', value: appointment.notes),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                if (cancellable) ...[
                  ASHAButton(
                    label: 'Reschedule',
                    icon: Icons.update,
                    variant: ASHAButtonVariant.outline,
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Rescheduling coming soon')),
                      );
                    },
                  ),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHAButton(
                    label: 'Cancel appointment',
                    icon: Icons.event_busy_outlined,
                    variant: ASHAButtonVariant.danger,
                    loading: _busy,
                    onPressed: _cancel,
                  ),
                ],
              ],
            ),
    );
  }

  String _formatSlot(DateTime date) {
    return '${DateFormat('EEEE, dd MMMM yyyy').format(date)} at ${DateFormat('hh:mm a').format(date)}';
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Text(label, style: ASHATypography.bodySmall.copyWith(
                color: theme.colorScheme.onSurfaceVariant)),
          ),
          Expanded(
            child: Text(value, style: ASHATypography.bodyMD, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}
