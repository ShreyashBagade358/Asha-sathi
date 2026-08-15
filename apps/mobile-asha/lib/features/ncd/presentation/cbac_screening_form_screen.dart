import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/ncd_screening_model.dart';

/// CBAC (Community Based Assessment Checklist) screening form with the
/// 12-question checklist, measurements and auto-computed risk score.
class CBACScreeningFormScreen extends ConsumerStatefulWidget {
  const CBACScreeningFormScreen({super.key});

  @override
  ConsumerState<CBACScreeningFormScreen> createState() => _CBACScreeningFormScreenState();
}

class _CBACScreeningFormScreenState extends ConsumerState<CBACScreeningFormScreen> {
  final _beneficiaryController = TextEditingController();
  final _ageController = TextEditingController();
  final _bpSystolicController = TextEditingController();
  final _bpDiastolicController = TextEditingController();
  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  final _sugarController = TextEditingController();

  static const _questions = [
    'Do you have frequent thirst?',
    'Do you pass urine more often?',
    'Do you have unexplained weight loss?',
    'Do you feel tired all the time?',
    'Do you have burning sensation while passing urine?',
    'Do you have blurry vision?',
    'Do you have chest pain / tightness?',
    'Do you get breathless on routine work?',
    'Do you have swelling of feet / ankles?',
    'Do you have headache in the morning?',
    'Do you have tingling / numbness in hands or feet?',
    'Is there a family history of diabetes or hypertension?',
  ];

  final _answers = List<bool>.filled(_questions.length, false);
  bool _saving = false;

  int get _riskScore => ref.read(ncdRepositoryProvider).computeRiskScore(_answers);

  String get _riskLevel =>
      ref.read(ncdRepositoryProvider).riskLevelFor(_riskScore);

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(ncdRepositoryProvider);
    final score = _riskScore;
    final level = repo.riskLevelFor(score);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'CBAC Screening',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            ASHATextField(
              label: 'Beneficiary ID *',
              controller: _beneficiaryController,
              prefixIcon: Icon(Icons.person_outline),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Age',
              controller: _ageController,
              keyboardType: TextInputType.number,
              prefixIcon: Icon(Icons.cake_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            Text('CBAC Checklist', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
            Text(
              'Ask these 12 questions. Answer Yes or No.',
              style: ASHATypography.bodyMD.copyWith(color: ASHAColors.onSurfaceVariant),
            ),
            const SizedBox(height: ASHASpacing.stackSM),
            ..._questions.asMap().entries.map((e) {
              final idx = e.key;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ASHACard(
                  title: '${idx + 1}. ${e.value}',
                  child: SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: true, label: Text('Yes')),
                      ButtonSegment(value: false, label: Text('No')),
                    ],
                    selected: {_answers[idx]},
                    onSelectionChanged: (s) =>
                        setState(() => _answers[idx] = s.first),
                    style: SegmentedButton.styleFrom(
                      selectedBackgroundColor: idx == 0 ? null : null,
                    ),
                  ),
                ),
              );
            }),
            const SizedBox(height: ASHASpacing.stackLG),
            Text('Measurements', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
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
            ASHATextField(
              label: 'Blood sugar (random, mg/dL)',
              controller: _sugarController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              prefixIcon: Icon(Icons.opacity),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHACard(
              title: 'Auto risk score',
              subtitle:
                  'Score $score / ${_questions.length} · ${_riskLevel.toUpperCase()} risk',
              child: Row(
                children: [
                  StatusChip(
                    status: level == 'high'
                        ? StatusChipType.danger
                        : level == 'moderate'
                            ? StatusChipType.warning
                            : StatusChipType.success,
                    label: level.toUpperCase(),
                  ),
                ],
              ),
            ),
            if (score >= 4) ...[
              const SizedBox(height: ASHASpacing.stackSM),
              StatusChip(
                status: StatusChipType.danger,
                label: 'Refer to PHC for confirmatory testing',
              ),
            ],
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save Screening',
              onPressed: _saving
                  ? null
                  : () async {
                      if (_beneficiaryController.text.trim().isEmpty) return;
                      setState(() => _saving = true);
                      final now = DateTime.now().toIso8601String();
                      final weight = double.tryParse(_weightController.text);
                      final height = double.tryParse(_heightController.text);
                      final model = NCDScreeningModel(
                        screeningId:
                            'NCD-${DateTime.now().millisecondsSinceEpoch}',
                        beneficiaryId: _beneficiaryController.text.trim(),
                        screeningDate: now,
                        age: int.tryParse(_ageController.text),
                        bpSystolic: int.tryParse(_bpSystolicController.text),
                        bpDiastolic: int.tryParse(_bpDiastolicController.text),
                        bmi: bmi(weight, height),
                        bloodSugar: double.tryParse(_sugarController.text),
                        riskScore: score,
                        riskLevel: level,
                        questions: _questions
                            .asMap()
                            .entries
                            .where((e) => _answers[e.key])
                            .map((e) => e.value)
                            .toList(),
                        referralStatus:
                            score >= 4 ? 'referred' : null,
                        createdAt: now,
                        updatedAt: now,
                      );
                      await ref.read(ncdRepositoryProvider).save(model);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Screening saved')),
                      );
                      context.pop();
                    },
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.save_outlined,
            ),
          ],
        ),
      ),
    );
  }
}
