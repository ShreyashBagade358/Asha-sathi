import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../data/beneficiary_model.dart';

/// Registration form for a new beneficiary (demographics, contact, family).
class BeneficiaryFormScreen extends ConsumerStatefulWidget {
  const BeneficiaryFormScreen({super.key, this.householdId});

  /// Optional pre-selected household link.
  final String? householdId;

  @override
  ConsumerState<BeneficiaryFormScreen> createState() => _BeneficiaryFormScreenState();
}

class _BeneficiaryFormScreenState extends ConsumerState<BeneficiaryFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _abhaController = TextEditingController();
  final _householdController = TextEditingController();
  final _dobController = TextEditingController();

  String _gender = 'female';
  String _maritalStatus = 'unmarried';
  String _bloodGroup = 'Unknown';
  bool _isPregnant = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _householdController.text = widget.householdId ?? '';
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 25),
      firstDate: DateTime(now.year - 100),
      lastDate: now,
    );
    if (picked != null) {
      setState(() => _dobController.text = formatDate(picked));
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final now = DateTime.now().toIso8601String();
    final model = BeneficiaryModel(
      beneficiaryId: 'BEN-${DateTime.now().millisecondsSinceEpoch}',
      householdId: _householdController.text.trim().isEmpty
          ? null
          : _householdController.text.trim(),
      abhaId: _abhaController.text.trim().isEmpty
          ? null
          : _abhaController.text.trim(),
      fullName: _nameController.text.trim(),
      gender: _gender,
      dob: tryParseDate(_dobController.text)?.toIso8601String(),
      phone: normalisePhone(_phoneController.text),
      maritalStatus: _maritalStatus,
      bloodGroup: _bloodGroup,
      isPregnant: _isPregnant,
      createdAt: now,
      updatedAt: now,
    );
    final saved = await ref.read(beneficiaryRepositoryProvider).save(model);
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Beneficiary registered')),
    );
    context.pushReplacementNamed(
      AppRoutes.beneficiaryDetail,
      pathParameters: {'id': saved.beneficiaryId},
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _abhaController.dispose();
    _householdController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Register Beneficiary',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(ASHASpacing.marginMobile),
            children: [
              Text('Demographics', style: ASHATypography.headlineMD),
              const SizedBox(height: ASHASpacing.stackSM),
              ASHATextField(
                label: 'Full name *',
                hint: 'As on ID / Aadhaar',
                controller: _nameController,
                prefixIcon: Icon(Icons.badge_outlined),
                validator: nonEmpty('Name is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Date of Birth',
                hint: 'dd mmm yyyy',
                controller: _dobController,
                prefixIcon: Icon(Icons.cake_outlined),
                onTap: _pickDob,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  if (tryParseDate(v) == null) return 'Invalid date';
                  return null;
                },
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Gender', style: ASHATypography.labelLG),
              const SizedBox(height: ASHASpacing.stackSM),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'female', label: Text('Female')),
                  ButtonSegment(value: 'male', label: Text('Male')),
                  ButtonSegment(value: 'transgender', label: Text('Transgender')),
                ],
                selected: {_gender},
                onSelectionChanged: (s) => setState(() => _gender = s.first),
                style: SegmentedButton.styleFrom(
                  selectedBackgroundColor: ASHAColors.primary,
                  selectedForegroundColor: ASHAColors.onPrimary,
                ),
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              Text('Contact', style: ASHATypography.headlineMD),
              const SizedBox(height: ASHASpacing.stackSM),
              ASHATextField(
                label: 'Mobile number',
                hint: '10-digit mobile',
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                prefixIcon: Icon(Icons.phone_outlined),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  if (normalisePhone(v) == null) {
                    return 'Enter a valid 10-digit number';
                  }
                  return null;
                },
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Marital status', style: ASHATypography.labelLG),
              const SizedBox(height: ASHASpacing.stackSM),
              DropdownButtonFormField<String>(
                initialValue: _maritalStatus,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                ),
                items: ['unmarried', 'married', 'widowed', 'divorced', 'separated']
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) => setState(() => _maritalStatus = v ?? _maritalStatus),
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              Text('Family & Health', style: ASHATypography.headlineMD),
              const SizedBox(height: ASHASpacing.stackSM),
              ASHATextField(
                label: 'ABHA / Health ID (optional)',
                hint: 'ABHA number',
                controller: _abhaController,
                prefixIcon: Icon(Icons.health_and_safety_outlined),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Household ID (optional)',
                controller: _householdController,
                prefixIcon: Icon(Icons.home_work_outlined),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Blood group', style: ASHATypography.labelLG),
              const SizedBox(height: ASHASpacing.stackSM),
              DropdownButtonFormField<String>(
                initialValue: _bloodGroup,
                decoration: const InputDecoration(border: OutlineInputBorder()),
                items: const [
                  'Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
                ]
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) => setState(() => _bloodGroup = v ?? _bloodGroup),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHACard(
                child: Row(
                  children: [
                    Expanded(
                      child: Text('Currently pregnant', style: ASHATypography.bodyMD),
                    ),
                    Switch(
                      value: _isPregnant,
                      onChanged: (v) => setState(() => _isPregnant = v),
                      activeColor: ASHAColors.primary,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              ASHAButton(
                label: _saving ? 'Registering…' : 'Register Beneficiary',
                onPressed: _saving ? null : _save,
                loading: _saving,
                fullWidth: true,
                height: ASHASpacing.touchTargetMin,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
