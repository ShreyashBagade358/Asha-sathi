import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../data/child_models.dart';

class ChildRegistrationScreen extends ConsumerStatefulWidget {
  const ChildRegistrationScreen({super.key});

  @override
  ConsumerState<ChildRegistrationScreen> createState() => _ChildRegistrationScreenState();
}

class _ChildRegistrationScreenState extends ConsumerState<ChildRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _dobController = TextEditingController();
  final _motherController = TextEditingController();
  final _birthWeightController = TextEditingController();

  String _gender = 'male';
  bool _breastfeeding = false;
  bool _saving = false;

  Future<void> _pickDob() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365)),
      firstDate: DateTime(DateTime.now().year - 6),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _dobController.text = formatDate(picked));
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final now = DateTime.now().toIso8601String();
    final model = ChildModel(
      childId: 'CH-${DateTime.now().millisecondsSinceEpoch}',
      fullName: _nameController.text.trim(),
      gender: _gender,
      dob: tryParseDate(_dobController.text)?.toIso8601String(),
      birthWeight: double.tryParse(_birthWeightController.text),
      motherBeneficiaryId: _motherController.text.trim().isEmpty
          ? null
          : _motherController.text.trim(),
      breastfeedingStarted: _breastfeeding,
      immunizationStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    );
    final saved = await ref.read(childRepositoryProvider).save(model);
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Child registered')),
    );
    context.pushReplacementNamed(
      AppRoutes.childDetail,
      pathParameters: {'id': saved.childId},
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _dobController.dispose();
    _motherController.dispose();
    _birthWeightController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Register Child',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(ASHASpacing.marginMobile),
            children: [
              ASHATextField(
                label: 'Child full name *',
                controller: _nameController,
                prefixIcon: Icon(Icons.badge_outlined),
                validator: nonEmpty('Name is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Date of birth *',
                hint: 'dd mmm yyyy',
                controller: _dobController,
                prefixIcon: Icon(Icons.cake_outlined),
                onTap: _pickDob,
                validator: required<DateTime>('DOB is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Gender', style: ASHATypography.labelLG),
              const SizedBox(height: ASHASpacing.stackSM),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'male', label: Text('Male')),
                  ButtonSegment(value: 'female', label: Text('Female')),
                ],
                selected: {_gender},
                onSelectionChanged: (s) => setState(() => _gender = s.first),
                style: SegmentedButton.styleFrom(
                  selectedBackgroundColor: ASHAColors.primary,
                  selectedForegroundColor: ASHAColors.onPrimary,
                ),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Birth weight (kg)',
                hint: 'e.g. 2.8',
                controller: _birthWeightController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                prefixIcon: Icon(Icons.monitor_weight_outlined),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Mother beneficiary ID',
                hint: 'BEN-xxxxx',
                controller: _motherController,
                prefixIcon: Icon(Icons.person_outline),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHACard(
                child: Row(
                  children: [
                    Expanded(
                      child: Text('Breastfeeding initiated',
                          style: ASHATypography.bodyMD),
                    ),
                    Switch(
                      value: _breastfeeding,
                      onChanged: (v) => setState(() => _breastfeeding = v),
                      activeColor: ASHAColors.primary,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              ASHAButton(
                label: _saving ? 'Saving…' : 'Register Child',
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
