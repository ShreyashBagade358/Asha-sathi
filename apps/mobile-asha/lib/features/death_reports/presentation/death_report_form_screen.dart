import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../data/death_report_model.dart';

/// Death report form with verbal autopsy + maternal/child markers.
class DeathReportFormScreen extends ConsumerStatefulWidget {
  const DeathReportFormScreen({super.key});

  @override
  ConsumerState<DeathReportFormScreen> createState() => _DeathReportFormScreenState();
}

class _DeathReportFormScreenState extends ConsumerState<DeathReportFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _ageController = TextEditingController();
  final _dateController = TextEditingController();
  final _placeController = TextEditingController();
  final _causeCategoryController = TextEditingController();
  final _causeDescController = TextEditingController();
  final _autopsyController = TextEditingController();

  String _gender = 'female';
  bool _maternal = false;
  bool _child = false;
  bool _saving = false;

  static const _causeCategories = [
    'Maternal',
    'Child / Infant',
    'Cardiovascular',
    'Respiratory',
    'Infectious disease',
    'Malnutrition',
    'Accident / Injury',
    'Other',
  ];

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 7)),
      firstDate: DateTime(DateTime.now().year - 2),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _dateController.text = formatDate(picked));
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final now = DateTime.now().toIso8601String();
    final model = DeathReportModel(
      deathReportId: 'DR-${DateTime.now().millisecondsSinceEpoch}',
      deceasedName: _nameController.text.trim(),
      deceasedGender: _gender,
      deceasedAge: int.tryParse(_ageController.text),
      deathDate: tryParseDate(_dateController.text)?.toIso8601String(),
      deathPlace: _placeController.text.trim().isEmpty
          ? null
          : _placeController.text.trim(),
      causeCategory: _causeCategoryController.text.trim().isEmpty
          ? null
          : _causeCategoryController.text.trim(),
      causeDescription: _causeDescController.text.trim().isEmpty
          ? null
          : _causeDescController.text.trim(),
      isMaternalDeath: _maternal,
      isChildDeath: _child,
      verbalAutopsyNotes: _autopsyController.text.trim().isEmpty
          ? null
          : _autopsyController.text.trim(),
      status: 'reported',
      createdAt: now,
      updatedAt: now,
    );
    await ref.read(deathReportRepositoryProvider).save(model);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Death report submitted')),
    );
    context.pop();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _ageController.dispose();
    _dateController.dispose();
    _placeController.dispose();
    _causeCategoryController.dispose();
    _causeDescController.dispose();
    _autopsyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Report Death',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(ASHASpacing.marginMobile),
            children: [
              ASHATextField(
                label: 'Deceased name *',
                controller: _nameController,
                prefixIcon: Icon(Icons.person_outline),
                validator: nonEmpty('Name is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
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
                      label: 'Death date',
                      hint: 'dd mmm yyyy',
                      controller: _dateController,
                      prefixIcon: Icon(Icons.calendar_month_outlined),
                      onTap: _pickDate,
                      validator: required<DateTime>('Death date required'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Gender', style: ASHATypography.labelLG),
              const SizedBox(height: ASHASpacing.stackSM),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'female', label: Text('Female')),
                  ButtonSegment(value: 'male', label: Text('Male')),
                ],
                selected: {_gender},
                onSelectionChanged: (s) => setState(() => _gender = s.first),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Place of death',
                controller: _placeController,
                prefixIcon: Icon(Icons.location_on_outlined),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Cause category', style: ASHATypography.labelLG),
              const SizedBox(height: ASHASpacing.stackSM),
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(border: OutlineInputBorder()),
                items: _causeCategories
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) => _causeCategoryController.text = v ?? '',
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Cause description',
                controller: _causeDescController,
                prefixIcon: Icon(Icons.notes),
                maxLines: 2,
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              Text('Special markers', style: ASHATypography.headlineMD),
              const SizedBox(height: ASHASpacing.stackSM),
              _CheckRow(
                label: 'Maternal death',
                value: _maternal,
                onChanged: (v) => setState(() => _maternal = v),
              ),
              _CheckRow(
                label: 'Child death (under 5)',
                value: _child,
                onChanged: (v) => setState(() => _child = v),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Verbal autopsy notes', style: ASHATypography.headlineMD),
              const SizedBox(height: ASHASpacing.stackSM),
              ASHATextField(
                label: 'Narrative summary',
                controller: _autopsyController,
                prefixIcon: Icon(Icons.edit_note),
                maxLines: 4,
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              ASHAButton(
                label: _saving ? 'Submitting…' : 'Submit Report',
                onPressed: _saving ? null : _save,
                loading: _saving,
                fullWidth: true,
                height: ASHASpacing.touchTargetMin,
                icon: Icons.send_outlined,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CheckRow extends StatelessWidget {
  const _CheckRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

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
