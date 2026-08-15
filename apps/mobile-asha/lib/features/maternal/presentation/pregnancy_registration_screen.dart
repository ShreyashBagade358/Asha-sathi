import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../data/maternal_models.dart';

class PregnancyRegistrationScreen extends ConsumerStatefulWidget {
  const PregnancyRegistrationScreen({super.key});

  @override
  ConsumerState<PregnancyRegistrationScreen> createState() =>
      _PregnancyRegistrationScreenState();
}

class _PregnancyRegistrationScreenState
    extends ConsumerState<PregnancyRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _beneficiaryController = TextEditingController();
  final _lmpController = TextEditingController();
  final _gravidaController = TextEditingController();
  final _paraController = TextEditingController();
  final _bloodGroupController = TextEditingController();

  bool _highRisk = false;
  final _riskReasons = <String>{};
  bool _saving = false;

  static const _riskOptions = [
    'Age <18 or >35',
    'Previous C-section',
    'Multiple pregnancy',
    'Anemia (Hb <7)',
    'Hypertension',
    'Diabetes',
    'Bleeding',
    'Breech / malpresentation',
    'Previous stillbirth',
  ];

  Future<void> _pickLmp() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 120)),
      firstDate: DateTime(DateTime.now().year - 1),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _lmpController.text = formatDate(picked);
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final now = DateTime.now().toIso8601String();
    final lmp = tryParseDate(_lmpController.text);
    final model = PregnancyModel(
      pregnancyId: 'PREG-${DateTime.now().millisecondsSinceEpoch}',
      beneficiaryId: _beneficiaryController.text.trim(),
      lmp: lmp?.toIso8601String(),
      edd: estimateEDD(lmp)?.toIso8601String(),
      gravida: int.tryParse(_gravidaController.text),
      para: int.tryParse(_paraController.text),
      bloodGroup: _bloodGroupController.text.trim().isEmpty
          ? null
          : _bloodGroupController.text.trim(),
      status: 'active',
      highRisk: _highRisk,
      highRiskReasons: _riskReasons.toList(),
      createdAt: now,
      updatedAt: now,
    );
    final saved = await ref.read(maternalRepositoryProvider).savePregnancy(model);
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Pregnancy registered')),
    );
    context.pushReplacementNamed(
      AppRoutes.pregnancy,
      extra: saved.pregnancyId,
    );
  }

  @override
  void dispose() {
    _beneficiaryController.dispose();
    _lmpController.dispose();
    _gravidaController.dispose();
    _paraController.dispose();
    _bloodGroupController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Register Pregnancy',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(ASHASpacing.marginMobile),
            children: [
              ASHATextField(
                label: 'Beneficiary ID *',
                hint: 'BEN-xxxxx',
                controller: _beneficiaryController,
                prefixIcon: Icon(Icons.person_outline),
                validator: nonEmpty('Beneficiary ID is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Last Menstrual Period (LMP)',
                hint: 'dd mmm yyyy',
                controller: _lmpController,
                prefixIcon: Icon(Icons.calendar_month_outlined),
                onTap: _pickLmp,
                validator: required<DateTime>('LMP is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Row(
                children: [
                  Expanded(
                    child: ASHATextField(
                      label: 'Gravida',
                      hint: 'Total pregnancies',
                      controller: _gravidaController,
                      keyboardType: TextInputType.number,
                      prefixIcon: Icon(Icons.numbers),
                    ),
                  ),
                  const SizedBox(width: ASHASpacing.stackSM),
                  Expanded(
                    child: ASHATextField(
                      label: 'Para',
                      hint: 'Live births',
                      controller: _paraController,
                      keyboardType: TextInputType.number,
                      prefixIcon: Icon(Icons.child_care_outlined),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Blood group',
                hint: 'e.g. B+',
                controller: _bloodGroupController,
                prefixIcon: Icon(Icons.water_drop_outlined),
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              Text('High-risk pregnancy?', style: ASHATypography.headlineMD),
              const SizedBox(height: ASHASpacing.stackSM),
              ASHACard(
                child: Row(
                  children: [
                    Expanded(
                      child: Text('Flag this pregnancy as high risk',
                          style: ASHATypography.bodyMD),
                    ),
                    Switch(
                      value: _highRisk,
                      onChanged: (v) => setState(() => _highRisk = v),
                      activeColor: ASHAColors.error,
                    ),
                  ],
                ),
              ),
              if (_highRisk) ...[
                const SizedBox(height: ASHASpacing.stackSM),
                Text('Select risk reasons', style: ASHATypography.labelLG),
                const SizedBox(height: ASHASpacing.stackSM),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _riskOptions.map((r) {
                    final sel = _riskReasons.contains(r);
                    return FilterChip(
                      label: Text(r),
                      selected: sel,
                      onSelected: (v) => setState(() {
                        if (v) {
                          _riskReasons.add(r);
                        } else {
                          _riskReasons.remove(r);
                        }
                      }),
                      selectedColor: ASHAColors.errorContainer,
                      checkmarkColor: ASHAColors.onErrorContainer,
                      side: BorderSide(
                        color: sel ? ASHAColors.error : ASHAColors.outlineVariant,
                      ),
                    );
                  }).toList(),
                ),
              ],
              const SizedBox(height: ASHASpacing.stackLG),
              ASHAButton(
                label: _saving ? 'Saving…' : 'Register Pregnancy',
                onPressed: _saving ? null : _save,
                loading: _saving,
                fullWidth: true,
                height: ASHASpacing.touchTargetMin,
                icon: Icons.check_circle_outline,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
