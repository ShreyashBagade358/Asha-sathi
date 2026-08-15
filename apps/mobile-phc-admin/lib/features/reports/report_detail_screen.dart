import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'report_model.dart';
import 'report_repository.dart';

/// Drill-down view of one monthly report with custom-drawn bar charts.
class ReportDetailScreen extends ConsumerStatefulWidget {
  const ReportDetailScreen({super.key, required this.period});

  final String period;

  @override
  ConsumerState<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends ConsumerState<ReportDetailScreen> {
  ReportModel? _report;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final report =
        await ref.read(reportRepositoryProvider).fetchById(widget.period);
    if (mounted) setState(() {
      _report = report;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final report = _report;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: report?.period ?? 'Report',
        onBack: () => context.pop(),
      ),
      body: _loading || report == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ASHACard(
                  title: report.facilityName,
                  subtitle:
                      'Generated on ${formatDate(report.generatedAt ?? DateTime.now())}',
                  child: Column(
                    children: [
                      _StatRow(
                        icon: Icons.pregnant_woman_outlined,
                        label: 'Maternal registrations',
                        value: '${report.maternalRegistrations}',
                      ),
                      _StatRow(
                        icon: Icons.warning_amber_outlined,
                        label: 'High-risk pregnancies',
                        value: '${report.highRiskPregnancies}',
                      ),
                      _StatRow(
                        icon: Icons.local_hospital_outlined,
                        label: 'Institutional deliveries',
                        value: '${report.institutionalDeliveries}',
                      ),
                      _StatRow(
                        icon: Icons.home_outlined,
                        label: 'Home deliveries',
                        value: '${report.homeDeliveries}',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHACard(
                  title: 'Delivery safety',
                  subtitle: '${report.institutionalDeliveryRate.toStringAsFixed(1)}% institutional',
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusFull),
                    child: LinearProgressIndicator(
                      value: (report.institutionalDeliveryRate / 100).clamp(0, 1),
                      minHeight: 10,
                    ),
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHACard(
                  title: 'Child nutrition',
                  subtitle: '${report.malnutritionCases} cases detected',
                  child: Column(
                    children: [
                      _StatRow(
                        icon: Icons.vaccines_outlined,
                        label: 'Children immunized',
                        value: '${report.childrenImmunized}',
                      ),
                      _StatRow(
                        icon: Icons.monitor_weight_outlined,
                        label: 'SAM cases',
                        value: '${report.samCases}',
                      ),
                      _StatRow(
                        icon: Icons.monitor_weight_outlined,
                        label: 'MAM cases',
                        value: '${report.mamCases}',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHACard(
                  title: 'NCD screening',
                  subtitle: '${report.totalNcdCases} new cases out of ${report.ncdScreened} screened',
                  child: Column(
                    children: [
                      _StatRow(
                        icon: Icons.monitor_heart_outlined,
                        label: 'Hypertension',
                        value: '${report.hypertensionCases}',
                      ),
                      _StatRow(
                        icon: Icons.monitor_heart_outlined,
                        label: 'Diabetes',
                        value: '${report.diabetesCases}',
                      ),
                      _StatRow(
                        icon: Icons.medical_information_outlined,
                        label: 'Referrals',
                        value: '${report.referralCount}',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Registration trend'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: SizedBox(
                    height: 180,
                    child: CustomPaint(
                      size: Size.infinite,
                      painter: _BarChartPainter(
                        points: report.registrationTrend,
                        barColor: theme.colorScheme.primary,
                        labelColor: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHAButton(
                  label: 'Export report',
                  icon: Icons.download_outlined,
                  variant: ASHAButtonVariant.outline,
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Report export queued')),
                    );
                  },
                ),
              ],
            ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({
    required this.icon,
    required this.label,
    required this.value,
  });

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
          Icon(icon, size: 18, color: theme.colorScheme.primary),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(child: Text(label, style: ASHATypography.bodyMD)),
          Text(value, style: ASHATypography.titleMedium),
        ],
      ),
    );
  }
}

/// Lightweight vertical bar chart drawn with [CustomPaint].
class _BarChartPainter extends CustomPainter {
  const _BarChartPainter({
    required this.points,
    required this.barColor,
    required this.labelColor,
  });

  final List<ReportTrendPoint> points;
  final Color barColor;
  final Color labelColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final maxValue = points.map((p) => p.value).reduce((a, b) => a > b ? a : b);
    const labelSpace = 24.0;
    final chartHeight = size.height - labelSpace;
    final barWidth = size.width / points.length * 0.5;
    final gap = size.width / points.length;

    final paint = Paint()
      ..color = barColor
      ..style = PaintingStyle.fill
      ..strokeCap = StrokeCap.round;

    for (var i = 0; i < points.length; i++) {
      final point = points[i];
      final barHeight = maxValue == 0
          ? 0.0
          : (point.value / maxValue) * (chartHeight - 12);
      final centerX = gap * i + gap / 2;

      final rect = RRect.fromRectAndCorners(
        Rect.fromLTWH(
          centerX - barWidth / 2,
          chartHeight - barHeight,
          barWidth,
          barHeight,
        ),
        topLeft: const Radius.circular(6),
        topRight: const Radius.circular(6),
      );
      canvas.drawRRect(rect, paint);

      final textPainter = TextPainter(
        text: TextSpan(
          text: point.label,
          style: ASHATypography.labelMD.copyWith(
            color: labelColor,
            fontSize: 10,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(
        canvas,
        Offset(centerX - textPainter.width / 2, chartHeight + 6),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter oldDelegate) =>
      oldDelegate.points != points;
}
