import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'alert_model.dart';
import 'alert_repository.dart';

/// Triage list of facility alerts sorted by priority.
class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});

  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> {
  List<AlertModel> _alerts = [];
  bool _loading = true;
  String _priorityFilter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final alerts = await ref.read(alertRepositoryProvider).fetchAlerts();
    if (mounted) setState(() {
      _alerts = alerts;
      _loading = false;
    });
  }

  List<AlertModel> get _sorted {
    const rank = {'high': 0, 'medium': 1, 'low': 2};
    final filtered = _priorityFilter == 'all'
        ? _alerts
        : _alerts.where((a) => a.priority == _priorityFilter).toList();
    filtered.sort((a, b) {
      final active = (a.status == 'dismissed' ? 1 : 0) - (b.status == 'dismissed' ? 1 : 0);
      if (active != 0) return active;
      return (rank[a.priority] ?? 3).compareTo(rank[b.priority] ?? 3);
    });
    return filtered;
  }

  int get _openCount => _alerts.where((a) => a.status != 'dismissed').length;

  @override
  Widget build(BuildContext context) {
    final alerts = _sorted;

    return Scaffold(
      appBar: ASHATopAppBar(title: 'Alerts'),
      body: Column(
        children: [
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                  horizontal: ASHASpacing.gutter, vertical: ASHASpacing.stackSM),
              children: [
                for (final priority in const ['all', 'high', 'medium', 'low'])
                  Padding(
                    padding: const EdgeInsets.only(right: ASHASpacing.stackSM),
                    child: FilterChip(
                      label: Text(priority.toUpperCase()),
                      selected: _priorityFilter == priority,
                      onSelected: (_) => setState(() => _priorityFilter = priority),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : alerts.isEmpty
                    ? const ASHAEmptyState(
                        icon: Icons.notifications_off_outlined,
                        title: 'No alerts',
                        message: 'All caught up - no alerts in this category.',
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(ASHASpacing.gutter),
                          itemCount: alerts.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final alert = alerts[index];
                            return _AlertTile(
                              alert: alert,
                              onTap: () => context.push('/alerts/${alert.id}'),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.alert, required this.onTap});

  final AlertModel alert;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDismissed = alert.status == 'dismissed';
    final leadingIcon = switch (alert.type) {
      'maternal' => Icons.pregnant_woman_outlined,
      'child' => Icons.child_care_outlined,
      'nutrition' => Icons.monitor_weight_outlined,
      'ncd' => Icons.monitor_heart_outlined,
      'stock' => Icons.inventory_2_outlined,
      'data' => Icons.storage_outlined,
      _ => Icons.warning_amber_outlined,
    };

    return ASHACard(
      onTap: isDismissed ? null : onTap,
      child: Opacity(
        opacity: isDismissed ? 0.6 : 1,
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
              ),
              child: Icon(leadingIcon, color: theme.colorScheme.primary),
            ),
            const SizedBox(width: ASHASpacing.stackMD),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(alert.title, style: ASHATypography.titleMedium),
                  const SizedBox(height: 2),
                  Text(
                    '${alert.typeLabel}${alert.beneficiaryName.isEmpty ? '' : ' · ${alert.beneficiaryName}'}',
                    style: ASHATypography.bodySmall.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: ASHASpacing.stackSM),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                StatusChip(
                  status: statusChipTypeFrom(alert.priority),
                  label: alert.priorityLabel,
                  compact: true,
                ),
                const SizedBox(height: 4),
                if (isDismissed)
                  Text('Dismissed', style: ASHATypography.labelMD.copyWith(
                      color: theme.colorScheme.onSurfaceVariant))
                else
                  Text(formatDate(alert.createdAt ?? DateTime.now()),
                      style: ASHATypography.labelMD.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
