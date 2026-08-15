import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/utils/formatters.dart';
import '../data/ai_models.dart';
import '../data/ai_repository.dart';

/// NCD risk screen: CBAC score + measurements → risk.
class NCDRiskScreen extends ConsumerStatefulWidget {
  const NCDRiskScreen({super.key});

  @override
  ConsumerState<NCDRiskScreen> createState() => _NCDRiskScreenState();
}

class _NCDRiskScreenState extends ConsumerState<NCDRiskScreen> {
  final _cbacController = TextEditingController();
  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  final _bpSysController = TextEditingController();
  final _bpDiaController = TextEditingController();
  final _sugarController = TextEditingController();
  bool _loading = false;
  AIRiskPredictionModel? _result;

  Future<void> _predict() async {
    final cbac = int.tryParse(_cbacController.text);
    final sys = int.tryParse(_bpSysController.text);
    final dia = int.tryParse(_bpDiaController.text);
    if (cbac == null || sys == null || dia == null) return;
    final bmi = bmi(double.tryParse(_weightController.text),
        double.tryParse(_heightController.text));
    setState(() {
      _loading = true;
      _result = null;
    });
    final result = await ref.read(aiRepositoryProvider).predictNCDRisk(
          cbacScore: cbac,
          bmi: bmi ?? 0,
          bpSystolic: sys,
          bpDiastolic: dia,
          bloodSugar: double.tryParse(_sugarController.text),
        );
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
        title: 'NCD Risk',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            ASHATextField(
              label: 'CBAC score',
              controller: _cbacController,
              keyboardType: TextInputType.number,
              prefixIcon: Icon(Icons.checklist_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Row(
              children: [
                Expanded(
                  child: ASHATextField(
                    label: 'Weight (kg)',
                    controller: _weightController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    prefixIcon: Icon(Icons.monitor_weight_outlined),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'Height (cm)',
                    controller: _heightController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    prefixIcon: Icon(Icons.height_outlined),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Row(
              children: [
                Expanded(
                  child: ASHATextField(
                    label: 'BP systolic',
                    controller: _bpSysController,
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.compress),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'BP diastolic',
                    controller: _bpDiaController,
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.compress),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Random blood sugar (mg/dL)',
              controller: _sugarController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              prefixIcon: Icon(Icons.opacity),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _loading ? 'Predicting…' : 'Predict Risk',
              onPressed: _loading ? null : _predict,
              loading: _loading,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.favorite_outline,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            if (_result != null)
              ASHACard(
                title: 'NCD Risk: ${_result!.riskLevel.toUpperCase()}',
                subtitle: 'Based on CBAC + measurements',
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
