import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'report_model.dart';
import 'report_repository.dart';

/// Monthly facility KPI reports.
class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  List<ReportModel> _reports = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final reports = await ref.read(reportRepositoryProvider).fetchReports();
    if (mounted) setState(() {
      _reports = reports;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: ASHATopAppBar(title: 'Reports'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _reports.isEmpty
              ? const ASHAEmptyState(
                  icon: Icons.insert_chart_outlined,
                  title: 'No reports yet',
                  message: 'Reports will appear here once data is synced.',
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(ASHASpacing.gutter),
                    itemCount: _reports.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final report = _reports[index];
                      return _ReportCard(
                        report: report,
                        onTap: () => context.push('/reports/${report.period}'),
                      );
                    },
                  ),
                ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report, required this.onTap});

  final ReportModel report;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final periodLabel = '${report.period.substring(5)}/${report.period.substring(0, 4)}';

    return ASHACard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('${report.period} report',
                    style: ASHATypography.titleMedium),
              ),
              Text(periodLabel, style: ASHATypography.bodySmall.copyWith(
                  color: theme.colorScheme.onSurfaceVariant)),
            ],
          ),
          const SizedBox(height: ASHASpacing.stackMD),
          Row(
            children: [
              Expanded(
                child: _KpiStat(
                  label: 'Registrations',
                  value: '${report.maternalRegistrations}',
                  icon: Icons.pregnant_woman_outlined,
                ),
              ),
              Expanded(
                child: _KpiStat(
                  label: 'Deliveries',
                  value: '${report.totalDeliveries}',
                  icon: Icons.local_hospital_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: ASHASpacing.stackSM),
          Row(
            children: [
              Expanded(
                child: _KpiStat(
                  label: 'Immunized',
                  value: '${report.childrenImmunized}',
                  icon: Icons.vaccines_outlined,
                ),
              ),
              Expanded(
                child: _KpiStat(
                  label: 'NCD screened',
                  value: '${report.ncdScreened}',
                  icon: Icons.monitor_heart_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _KpiStat extends StatelessWidget {
  const _KpiStat({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 18, color: theme.colorScheme.primary),
        const SizedBox(width: ASHASpacing.stackSM),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value, style: ASHATypography.titleLarge),
              Text(label, style: ASHATypography.bodySmall.copyWith(
                  color: theme.colorScheme.onSurfaceVariant)),
            ],
          ),
        ),
      ],
    );
  }
}
