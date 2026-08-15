import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../data/ai_models.dart';
import '../data/ai_repository.dart';

/// Maternal risk screen: input vitals → predicted risk.
class MaternalRiskScreen extends ConsumerStatefulWidget {
  const MaternalRiskScreen({super.key});

  @override
  ConsumerState<MaternalRiskScreen> createState() => _MaternalRiskScreenState();
}

class _MaternalRiskScreenState extends ConsumerState<MaternalRiskScreen> {
  final _ageController = TextEditingController();
  final _gaController = TextEditingController();
  final _hbController = TextEditingController();
  final _bpSystolicController = TextEditingController();
  final _bpDiastolicController = TextEditingController();

  bool _cSection = false;
  bool _multiple = false;
  bool _diabetes = false;
  bool _hypertension = false;
  bool _loading = false;

  AIRiskPredictionModel? _result;

  Future<void> _predict() async {
    final age = int.tryParse(_ageController.text);
    final ga = int.tryParse(_gaController.text);
    final hb = double.tryParse(_hbController.text);
    final sys = int.tryParse(_bpSystolicController.text);
    final dia = int.tryParse(_bpDiastolicController.text);
    if (age == null || hb == null || sys == null || dia == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fill age, Hb and BP to predict')),
      );
      return;
    }
    setState(() {
      _loading = true;
      _result = null;
    });
    final result = await ref.read(aiRepositoryProvider).predictMaternalRisk(
          age: age,
          gestationalAgeWeeks: ga ?? 0,
          hemoglobin: hb,
          bpSystolic: sys,
          bpDiastolic: dia,
          previousCSection: _cSection,
          multiplePregnancy: _multiple,
          preExistingDiabetes: _diabetes,
          preExistingHypertension: _hypertension,
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
        title: 'Maternal Risk',
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
                    label: 'Age',
                    controller: _ageController,
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.cake_outlined),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'GA (weeks)',
                    controller: _gaController,
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.pregnant_woman),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Hemoglobin (g/dL)',
              controller: _hbController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              prefixIcon: Icon(Icons.opacity),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Row(
              children: [
                Expanded(
                  child: ASHATextField(
                    label: 'BP systolic',
                    controller: _bpSystolicController,
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.compress),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'BP diastolic',
                    controller: _bpDiastolicController,
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.compress),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            _Check('Previous C-section', _cSection, (v) => setState(() => _cSection = v)),
            _Check('Multiple pregnancy', _multiple, (v) => setState(() => _multiple = v)),
            _Check('Pre-existing diabetes', _diabetes, (v) => setState(() => _diabetes = v)),
            _Check('Pre-existing hypertension', _hypertension,
                (v) => setState(() => _hypertension = v)),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _loading ? 'Predicting…' : 'Predict Risk',
              onPressed: _loading ? null : _predict,
              loading: _loading,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.auto_awesome_outlined,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            if (_result != null) _RiskResultCard(result: _result!),
          ],
        ),
      ),
    );
  }
}

class _Check extends StatelessWidget {
  const _Check(this.label, this.value, this.onChanged);

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return ASHACard(
      child: Row(
        children: [
          Expanded(child: Text(label, style: ASHATypography.bodyMD)),
          Switch(value: value, onChanged: onChanged, activeColor: ASHAColors.primary),
        ],
      ),
    );
  }
}

class _RiskResultCard extends StatelessWidget {
  const _RiskResultCard({required this.result});

  final AIRiskPredictionModel result;

  @override
  Widget build(BuildContext context) {
    final level = result.riskLevel;
    return ASHACard(
      title: 'Risk: ${level.toUpperCase()}',
      subtitle:
          'Score ${(result.riskScore * 100).toStringAsFixed(0)}% · ${result.modelVersion}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: ASHASpacing.stackSM),
          StatusChip(
            status: level == 'high'
                ? StatusChipType.danger
                : level == 'moderate'
                    ? StatusChipType.warning
                    : StatusChipType.success,
            label: level.toUpperCase(),
          ),
          const SizedBox(height: ASHASpacing.stackSM),
          if (result.riskFactors.isNotEmpty)
            ...result.riskFactors.map((f) => Text('• $f', style: ASHATypography.bodyMD)),
          const SizedBox(height: ASHASpacing.stackSM),
          Text(result.recommendation, style: ASHATypography.bodyMD),
        ],
      ),
    );
  }
}
