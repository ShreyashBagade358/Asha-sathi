import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../data/ai_models.dart';
import '../data/ai_repository.dart';

/// Child growth risk: age + weight → z-score based assessment.
class ChildGrowthScreen extends ConsumerStatefulWidget {
  const ChildGrowthScreen({super.key});

  @override
  ConsumerState<ChildGrowthScreen> createState() => _ChildGrowthScreenState();
}

class _ChildGrowthScreenState extends ConsumerState<ChildGrowthScreen> {
  final _ageController = TextEditingController();
  final _weightController = TextEditingController();
  bool _loading = false;
  AIRiskPredictionModel? _result;

  Future<void> _predict() async {
    final age = int.tryParse(_ageController.text);
    final weight = double.tryParse(_weightController.text);
    if (age == null || weight == null) return;
    setState(() {
      _loading = true;
      _result = null;
    });
    final result = await ref
        .read(aiRepositoryProvider)
        .predictChildGrowth(ageMonths: age, weightKg: weight);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _result = result;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Child Growth',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            Row(
              children: [
                Expanded(
                  child: ASHATextField(
                    label: 'Age (months)',
                    controller: _ageController,
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.calendar_month_outlined),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'Weight (kg)',
                    controller: _weightController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    prefixIcon: Icon(Icons.monitor_weight_outlined),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHAButton(
              label: _loading ? 'Assessing…' : 'Assess Growth',
              onPressed: _loading ? null : _predict,
              loading: _loading,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.timeline_outlined,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            if (_result != null)
              ASHACard(
                title: 'Growth: ${_result!.riskLevel.toUpperCase()}',
                subtitle: 'Weight-for-age assessment',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: ASHASpacing.stackSM),
                    StatusChip(
                      status: _result!.riskLevel == 'high'
                          ? StatusChipType.danger
                          : _result!.riskLevel == 'moderate'
                              ? StatusChipType.warning
                              : StatusChipType.success,
                      label: _result!.riskLevel.toUpperCase(),
                    ),
                    const SizedBox(height: ASHASpacing.stackSM),
                    ..._result!.riskFactors
                        .map((f) => Text('• $f', style: ASHATypography.bodyMD)),
                    const SizedBox(height: ASHASpacing.stackSM),
                    Text(_result!.recommendation, style: ASHATypography.bodyMD),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
