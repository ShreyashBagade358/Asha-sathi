import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_repository.dart';
import '../../core/config/app_config.dart';
import '../alerts/alert_model.dart';
import '../alerts/alert_repository.dart';
import '../beneficiary_review/pending_verification_model.dart';
import '../beneficiary_review/verification_repository.dart';
import '../reports/report_model.dart';
import '../reports/report_repository.dart';

/// PHC dashboard: KPIs, pending work and quick links.
class PHCDashboardScreen extends ConsumerStatefulWidget {
  const PHCDashboardScreen({super.key});

  @override
  ConsumerState<PHCDashboardScreen> createState() => _PHCDashboardScreenState();
}

class _PHCDashboardScreenState extends ConsumerState<PHCDashboardScreen> {
  List<PendingVerificationModel> _queue = [];
  List<AlertModel> _alerts = [];
  ReportModel? _latestReport;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final queue = await ref.read(verificationRepositoryProvider).fetchQueue();
    final alerts = await ref.read(alertRepositoryProvider).fetchAlerts();
    final reports = await ref.read(reportRepositoryProvider).fetchReports();
    if (mounted) setState(() {
      _queue = queue;
      _alerts = alerts;
      _latestReport = reports.isEmpty ? null : reports.first;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = ref.watch(authControllerProvider);
    final user = auth is AuthAuthenticated ? auth.user : null;

    final pending = _queue.where((q) => q.status == 'pending').length;
    final openAlerts = _alerts.where((a) => a.status != 'dismissed').length;
    final highAlerts = _alerts.where((a) => a.priority == 'high').length;
    final report = _latestReport;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'PHC Dashboard',
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.gutter),
          children: [
            Text(
              'Good morning, ${user?.name.split(' ').first ?? 'Admin'}',
              style: ASHATypography.headlineMD,
            ),
            Text(
              user?.facilityName ?? AppConfig.defaultFacilityName,
              style: ASHATypography.bodySmall.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            if (_loading)
              const ASHALoadingView(message: 'Loading dashboard…')
            else ...[
              Row(
                children: [
                  Expanded(
                    child: _KpiCard(
                      label: 'Pending review',
                      value: '$pending',
                      icon: Icons.verified_user_outlined,
                      onTap: () => context.push('/verification'),
                    ),
                  ),
                  const SizedBox(width: ASHASpacing.stackSM),
                  Expanded(
                    child: _KpiCard(
                      label: 'Open alerts',
                      value: '$openAlerts',
                      icon: Icons.notifications_active_outlined,
                      onTap: () => context.push('/alerts'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ASHASpacing.stackSM),
              Row(
                children: [
                  Expanded(
                    child: _KpiCard(
                      label: 'High priority',
                      value: '$highAlerts',
                      icon: Icons.priority_high,
                      onTap: () => context.push('/alerts'),
                    ),
                  ),
                  const SizedBox(width: ASHASpacing.stackSM),
                  Expanded(
                    child: _KpiCard(
                      label: 'Registrations',
                      value: '${report?.maternalRegistrations ?? 0}',
                      icon: Icons.pregnant_woman_outlined,
                      onTap: () => context.push('/reports'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              ASHASectionHeader(title: 'Quick actions'),
              const SizedBox(height: ASHASpacing.stackSM),
              Wrap(
                spacing: ASHASpacing.stackSM,
                runSpacing: ASHASpacing.stackSM,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.apartment_outlined, size: 18),
                    label: const Text('Facilities'),
                    onPressed: () => context.push('/facility'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.badge_outlined, size: 18),
                    label: const Text('Staff'),
                    onPressed: () => context.push('/staff'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.insert_chart_outlined, size: 18),
                    label: const Text('Reports'),
                    onPressed: () => context.push('/reports'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.notifications_outlined, size: 18),
                    label: const Text('Alerts'),
                    onPressed: () => context.push('/alerts'),
                  ),
                ],
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              ASHASectionHeader(title: 'Latest monthly report'),
              const SizedBox(height: ASHASpacing.stackSM),
              if (report == null)
                const ASHACard(child: Text('No report data yet.'))
              else
                ASHACard(
                  onTap: () => context.push('/reports/${report.period}'),
                  title: report.period,
                  subtitle: report.facilityName,
                  child: Row(
                    children: [
                      _MiniStat(
                        label: 'Deliveries',
                        value: '${report.totalDeliveries}',
                      ),
                      const SizedBox(width: ASHASpacing.stackLG),
                      _MiniStat(
                        label: 'Immunized',
                        value: '${report.childrenImmunized}',
                      ),
                      const SizedBox(width: ASHASpacing.stackLG),
                      _MiniStat(
                        label: 'NCD',
                        value: '${report.ncdScreened}',
                      ),
                      const Spacer(),
                      const Icon(Icons.chevron_right),
                    ],
                  ),
                ),
              const SizedBox(height: ASHASpacing.stackLG),
              ASHASectionHeader(title: 'Recent alerts'),
              const SizedBox(height: ASHASpacing.stackSM),
              if (_alerts.isEmpty)
                const ASHACard(child: Text('No alerts.'))
              else
                for (final alert in _alerts.take(3)) ...[
                  ASHACard(
                    onTap: () => context.push('/alerts/${alert.id}'),
                    padding: const EdgeInsets.symmetric(
                        horizontal: ASHASpacing.stackMD,
                        vertical: ASHASpacing.stackMD),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(alert.title,
                                  style: ASHATypography.titleMedium),
                              const SizedBox(height: 2),
                              Text(
                                alert.typeLabel,
                                style: ASHATypography.bodySmall.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        StatusChip(
                          status: statusChipTypeFrom(alert.priority),
                          label: alert.priorityLabel,
                          compact: true,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: ASHASpacing.stackSM),
                ],
            ],
          ],
        ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback? onTap;

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
          Text(value, style: ASHATypography.headlineLG),
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

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: ASHATypography.titleLarge),
        Text(
          label,
          style: ASHATypography.bodySmall.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
