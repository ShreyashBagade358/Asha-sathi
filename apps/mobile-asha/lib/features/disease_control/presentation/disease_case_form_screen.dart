import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/disease_models.dart';

/// Dynamic disease case form: fields change per selected disease type.
class DiseaseCaseFormScreen extends ConsumerStatefulWidget {
  const DiseaseCaseFormScreen({super.key});

  @override
  ConsumerState<DiseaseCaseFormScreen> createState() => _DiseaseCaseFormScreenState();
}

class _DiseaseCaseFormScreenState extends ConsumerState<DiseaseCaseFormScreen> {
  String _type = 'malaria';
  String _status = 'under-treatment';

  // Common fields
  final _nameController = TextEditingController();
  final _localityController = TextEditingController();
  final _pincodeController = TextEditingController();
  final _treatmentController = TextEditingController();

  // Malaria
  final _houseNumberController = TextEditingController();
  String _species = 'pf';
  bool _microscopy = false;
  bool _rdt = false;
  bool _irs = false;

  // TB
  String _tbType = 'pulmonary';
  bool _sputum = false;
  final _dotsController = TextEditingController();

  bool _saving = false;

  Future<void> _save() async {
    if (_nameController.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final now = DateTime.now().toIso8601String();

    if (_type == 'malaria') {
      final model = MalariaCaseModel(
        caseId: 'MAL-${DateTime.now().millisecondsSinceEpoch}',
        patientName: _nameController.text.trim(),
        diagnosisDate: now,
        species: _species,
        microscopyPositive: _microscopy,
        rapidTestPositive: _rdt,
        indoorResidualSprayDone: _irs,
        treatment: _treatmentController.text.trim(),
        houseNumber: _houseNumberController.text.trim(),
        locality: _localityController.text.trim(),
        pincode: _pincodeController.text.trim(),
        status: _status,
        createdAt: now,
        updatedAt: now,
      );
      await ref.read(diseaseRepositoryProvider).saveMalaria(model);
    } else {
      final model = TBCaseModel(
        caseId: 'TB-${DateTime.now().millisecondsSinceEpoch}',
        patientName: _nameController.text.trim(),
        diagnosisDate: now,
        tbType: _tbType,
        sputumPositive: _sputum,
        dotsProvider: _dotsController.text.trim(),
        treatmentRegimen: _treatmentController.text.trim(),
        locality: _localityController.text.trim(),
        pincode: _pincodeController.text.trim(),
        status: _status,
        createdAt: now,
        updatedAt: now,
      );
      await ref.read(diseaseRepositoryProvider).saveTB(model);
    }

    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Case recorded')),
    );
    context.pop();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _localityController.dispose();
    _pincodeController.dispose();
    _treatmentController.dispose();
    _houseNumberController.dispose();
    _dotsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Report Case',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            Text('Disease type', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'malaria', label: Text('Malaria')),
                ButtonSegment(value: 'tb', label: Text('TB')),
              ],
              selected: {_type},
              onSelectionChanged: (s) => setState(() => _type = s.first),
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: ASHAColors.primary,
                selectedForegroundColor: ASHAColors.onPrimary,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Patient name *',
              controller: _nameController,
              prefixIcon: Icon(Icons.person_outline),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Locality',
              controller: _localityController,
              prefixIcon: Icon(Icons.location_on_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Pincode',
              controller: _pincodeController,
              keyboardType: TextInputType.number,
              prefixIcon: Icon(Icons.pin_drop_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text('Status', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: const InputDecoration(border: OutlineInputBorder()),
              items: const ['under-treatment', 'cured', 'referred', 'defaulted']
                  .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                  .toList(),
              onChanged: (v) => setState(() => _status = v ?? _status),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            if (_type == 'malaria') ..._malariaFields() else ..._tbFields(),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save Case',
              onPressed: _saving ? null : _save,
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.add_circle_outline,
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _malariaFields() {
    return [
      Text('Malaria details', style: ASHATypography.headlineMD),
      const SizedBox(height: ASHASpacing.stackSM),
      ASHATextField(
        label: 'House number',
        controller: _houseNumberController,
        prefixIcon: Icon(Icons.home_outlined),
      ),
      const SizedBox(height: ASHASpacing.stackMD),
      Text('Species', style: ASHATypography.labelLG),
      const SizedBox(height: ASHASpacing.stackSM),
      SegmentedButton<String>(
        segments: const [
          ButtonSegment(value: 'pf', label: Text('P. falciparum')),
          ButtonSegment(value: 'pv', label: Text('P. vivax')),
        ],
        selected: {_species},
        onSelectionChanged: (s) => setState(() => _species = s.first),
      ),
      const SizedBox(height: ASHASpacing.stackMD),
      _ToggleRow('Microscopy positive', _microscopy,
          (v) => setState(() => _microscopy = v)),
      _ToggleRow('Rapid diagnostic test positive', _rdt,
          (v) => setState(() => _rdt = v)),
      _ToggleRow('IRS (fogging) done in area', _irs,
          (v) => setState(() => _irs = v)),
      const SizedBox(height: ASHASpacing.stackMD),
      ASHATextField(
        label: 'Treatment given',
        controller: _treatmentController,
        prefixIcon: Icon(Icons.medication_outlined),
      ),
    ];
  }

  List<Widget> _tbFields() {
    return [
      Text('TB details', style: ASHATypography.headlineMD),
      const SizedBox(height: ASHASpacing.stackSM),
      Text('Type', style: ASHATypography.labelLG),
      const SizedBox(height: ASHASpacing.stackSM),
      SegmentedButton<String>(
        segments: const [
          ButtonSegment(value: 'pulmonary', label: Text('Pulmonary')),
          ButtonSegment(value: 'extra-pulmonary', label: Text('Extra-pulmonary')),
        ],
        selected: {_tbType},
        onSelectionChanged: (s) => setState(() => _tbType = s.first),
      ),
      const SizedBox(height: ASHASpacing.stackMD),
      _ToggleRow('Sputum positive', _sputum, (v) => setState(() => _sputum = v)),
      const SizedBox(height: ASHASpacing.stackMD),
      ASHATextField(
        label: 'DOTS provider',
        controller: _dotsController,
        prefixIcon: Icon(Icons.support_agent_outlined),
      ),
      const SizedBox(height: ASHASpacing.stackMD),
      ASHATextField(
        label: 'Treatment regimen',
        controller: _treatmentController,
        prefixIcon: Icon(Icons.medication_outlined),
      ),
    ];
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow(this.label, this.value, this.onChanged);

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
