import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'alert_model.dart';
import 'alert_repository.dart';

/// Detail view of one alert with assign / escalate / dismiss actions.
class AlertDetailScreen extends ConsumerStatefulWidget {
  const AlertDetailScreen({super.key, required this.alertId});

  final String alertId;

  @override
  ConsumerState<AlertDetailScreen> createState() => _AlertDetailScreenState();
}

class _AlertDetailScreenState extends ConsumerState<AlertDetailScreen> {
  AlertModel? _alert;
  bool _loading = true;
  bool _busy = false;
  String _selectedAsha = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final alert = await ref.read(alertRepositoryProvider).fetchById(widget.alertId);
    if (mounted) setState(() {
      _alert = alert;
      _selectedAsha = alert?.assignedAsha ?? '';
      _loading = false;
    });
  }

  Future<void> _mutate(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    await action();
    if (!mounted) return;
    setState(() => _busy = false);
  }

  Future<void> _assign() async {
    if (_selectedAsha.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select an ASHA first')),
      );
      return;
    }
    await _mutate(() async {
      await ref
          .read(alertRepositoryProvider)
          .assign(widget.alertId, ashaName: _selectedAsha);
      _alert = _alert?.copyWith(status: 'assigned', assignedAsha: _selectedAsha);
    });
  }

  Future<void> _escalate() async {
    await _mutate(() async {
      await ref.read(alertRepositoryProvider).escalate(widget.alertId);
      _alert = _alert?.copyWith(status: 'escalated');
    });
  }

  Future<void> _dismiss() async {
    await _mutate(() async {
      await ref.read(alertRepositoryProvider).dismiss(widget.alertId);
      _alert = _alert?.copyWith(status: 'dismissed');
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final alert = _alert;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Alert',
        onBack: () => context.pop(),
      ),
      body: _loading || alert == null
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
                          StatusChip(
                            status: statusChipTypeFrom(alert.priority),
                            label: alert.priorityLabel,
                          ),
                          const SizedBox(width: ASHASpacing.stackSM),
                          StatusChip(
                            status: statusChipTypeFrom(alert.status),
                            label: alert.statusLabel,
                          ),
                        ],
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      Text(alert.title, style: ASHATypography.titleLarge),
                      const SizedBox(height: ASHASpacing.stackSM),
                      Text(alert.description, style: ASHATypography.bodyMD),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Details'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    children: [
                      _InfoRow(icon: Icons.category_outlined, label: 'Category', value: alert.typeLabel),
                      _InfoRow(icon: Icons.person_outline, label: 'Beneficiary', value: alert.beneficiaryName.isEmpty ? '—' : alert.beneficiaryName),
                      _InfoRow(icon: Icons.village_outlined, label: 'Village', value: alert.village.isEmpty ? '—' : alert.village),
                      _InfoRow(icon: Icons.badge_outlined, label: 'Assigned ASHA', value: alert.assignedAsha.isEmpty ? 'Unassigned' : alert.assignedAsha),
                      _InfoRow(icon: Icons.calendar_today_outlined, label: 'Raised', value: formatDate(alert.createdAt ?? DateTime.now())),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                if (alert.status == 'dismissed')
                  ASHACard(
                    child: Row(
                      children: [
                        Icon(Icons.check_circle_outline,
                            color: theme.colorScheme.primary),
                        const SizedBox(width: ASHASpacing.stackMD),
                        const Expanded(
                          child: Text('This alert has been dismissed.'),
                        ),
                      ],
                    ),
                  )
                else ...[
                  ASHASectionHeader(title: 'Assign to ASHA'),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHACard(
                    child: DropdownButtonFormField<String>(
                      value: _selectedAsha.isEmpty
                          ? null
                          : AlertRepository.mockAshaList().contains(_selectedAsha)
                              ? _selectedAsha
                              : null,
                      decoration: const InputDecoration(
                        labelText: 'Select ASHA',
                        border: OutlineInputBorder(),
                      ),
                      items: AlertRepository.mockAshaList()
                          .map((name) => DropdownMenuItem(
                                value: name,
                                child: Text(name),
                              ))
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _selectedAsha = value ?? ''),
                    ),
                  ),
                  const SizedBox(height: ASHASpacing.stackMD),
                  ASHAButton(
                    label: 'Assign',
                    icon: Icons.person_add_alt,
                    loading: _busy,
                    onPressed: _assign,
                  ),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHAButton(
                    label: 'Escalate to block level',
                    icon: Icons.swap_upward_outlined,
                    variant: ASHAButtonVariant.outline,
                    loading: _busy,
                    onPressed: _escalate,
                  ),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHAButton(
                    label: 'Dismiss',
                    icon: Icons.close,
                    variant: ASHAButtonVariant.danger,
                    loading: _busy,
                    onPressed: _dismiss,
                  ),
                ],
              ],
            ),
    );
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
          Text(value, style: ASHATypography.bodyMD),
        ],
      ),
    );
  }
}
