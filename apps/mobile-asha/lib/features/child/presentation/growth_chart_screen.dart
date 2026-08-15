import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/offline/sync_queue.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/child_models.dart';

/// Growth chart screen: weight/height plotting over time (sampled list view
/// plus a record-new-measurement form). Uses a lightweight custom painter to
/// render the chart without extra charting dependencies.
class GrowthChartScreen extends ConsumerStatefulWidget {
  const GrowthChartScreen({super.key, required this.childId});

  final String childId;

  @override
  ConsumerState<GrowthChartScreen> createState() => _GrowthChartScreenState();
}

class _GrowthChartScreenState extends ConsumerState<GrowthChartScreen> {
  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  bool _showForm = false;

  final _records = <GrowthRecordModel>[
    GrowthRecordModel(
      recordId: 'G-1',
      childId: 'seed',
      measuredOn: DateTime.now().subtract(const Duration(days: 90)).toIso8601String(),
      ageMonths: 3,
      weightKg: 5.2,
      heightCm: 58,
    ),
    GrowthRecordModel(
      recordId: 'G-2',
      childId: 'seed',
      measuredOn: DateTime.now().subtract(const Duration(days: 60)).toIso8601String(),
      ageMonths: 4,
      weightKg: 6.0,
      heightCm: 61,
    ),
    GrowthRecordModel(
      recordId: 'G-3',
      childId: 'seed',
      measuredOn: DateTime.now().subtract(const Duration(days: 30)).toIso8601String(),
      ageMonths: 5,
      weightKg: 6.8,
      heightCm: 64,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Growth Chart',
        onBack: () => context.pop(),
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Weight plotted against age. Add measurements regularly.')),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            ASHACard(
              title: 'Weight for Age',
              subtitle: 'Latest ${_records.last.weightKg ?? 0} kg at ${_records.last.ageMonths ?? 0} months',
              child: SizedBox(
                height: 220,
                child: CustomPaint(
                  size: const Size(double.infinity, 220),
                  painter: _GrowthChartPainter(
                    records: _records,
                    values: (r) => r.weightKg ?? 0,
                    color: ASHAColors.primary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _showForm ? 'Hide form' : 'Record new measurement',
              onPressed: () => setState(() => _showForm = !_showForm),
              variant: ASHAButtonVariant.outline,
              fullWidth: true,
              height: 48,
              icon: Icons.add_chart_outlined,
            ),
            if (_showForm) ...[
              const SizedBox(height: ASHASpacing.stackMD),
              Row(
                children: [
                  Expanded(
                    child: ASHATextField(
                      label: 'Weight (kg)',
                      controller: _weightController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      prefixIcon: Icon(Icons.monitor_weight_outlined),
                    ),
                  ),
                  const SizedBox(width: ASHASpacing.stackSM),
                  Expanded(
                    child: ASHATextField(
                      label: 'Height (cm)',
                      controller: _heightController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      prefixIcon: Icon(Icons.height_outlined),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHAButton(
                label: 'Add measurement',
                onPressed: () async {
                  final now = DateTime.now();
                  final record = GrowthRecordModel(
                    recordId: 'G-${now.millisecondsSinceEpoch}',
                    childId: widget.childId,
                    measuredOn: now.toIso8601String(),
                    ageMonths: ageFromDob(DateTime.now()).totalMonths,
                    weightKg: double.tryParse(_weightController.text),
                    heightCm: double.tryParse(_heightController.text),
                    createdAt: now.toIso8601String(),
                  );
                  setState(() {
                    _records.add(record);
                    _showForm = false;
                    _weightController.clear();
                    _heightController.clear();
                  });
                  await SyncQueue.enqueue(
                    db: ref.read(databaseProvider),
                    table: 'growth_records',
                    recordId: record.recordId,
                    operation: 'update',
                    payload: record.toJson(),
                  );
                },
                fullWidth: true,
                height: 48,
              ),
            ],
            const SizedBox(height: ASHASpacing.stackLG),
            Text('History', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
            ..._records.reversed.map((r) => ASHACard(
                  title: '${r.ageMonths ?? 0} months',
                  subtitle:
                      '${r.weightKg ?? 0} kg · ${r.heightCm ?? 0} cm · ${formatDate(tryParseDate(r.measuredOn))}',
                  child: const SizedBox.shrink(),
                )),
          ],
        ),
      ),
    );
  }
}

class _GrowthChartPainter extends CustomPainter {
  _GrowthChartPainter({
    required this.records,
    required this.values,
    required this.color,
  });

  final List<GrowthRecordModel> records;
  final double Function(GrowthRecordModel) values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (records.length < 2) return;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final points = records.map((r) {
      final x = ((r.ageMonths ?? 0) / 36).clamp(0.0, 1.0) * size.width;
      final y = size.height - (values(r) / 15).clamp(0.0, 1.0) * size.height;
      return Offset(x, y);
    }).toList();

    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final p in points.skip(1)) {
      path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(path, paint);

    final dotPaint = Paint()..color = color;
    for (final p in points) {
      canvas.drawCircle(p, 4, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _GrowthChartPainter oldDelegate) => true;
}
