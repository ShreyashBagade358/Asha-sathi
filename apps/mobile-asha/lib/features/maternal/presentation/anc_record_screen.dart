import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/maternal_models.dart';

class ANCRecordScreen extends ConsumerStatefulWidget {
  const ANCRecordScreen({super.key, required this.pregnancyId});

  final String pregnancyId;

  @override
  ConsumerState<ANCRecordScreen> createState() => _ANCRecordScreenState();
}

class _ANCRecordScreenState extends ConsumerState<ANCRecordScreen> {
  final _weightController = TextEditingController();
  final _hbController = TextEditingController();
  final _fhrController = TextEditingController();
  final _notesController = TextEditingController();

  int? _bpSystolic;
  int? _bpDiastolic;
  final _dangerSigns = <String>{};
  bool _referral = false;
  bool _saving = false;

  static const _dangerSignOptions = [
    'Severe headache',
    'Blurred vision',
    'Convulsions',
    'Vaginal bleeding',
    'Swelling of face/hands',
    'High fever',
    'Reduced fetal movement',
    'Severe abdominal pain',
  ];

  Future<void> _save() async {
    setState(() => _saving = true);
    final now = DateTime.now().toIso8601String();
    final model = ANCVisitModel(
      ancVisitId: 'ANC-${DateTime.now().millisecondsSinceEpoch}',
      pregnancyId: widget.pregnancyId,
      beneficiaryId: '',
      visitDate: now,
      weightKg: double.tryParse(_weightController.text),
      bpSystolic: _bpSystolic,
      bpDiastolic: _bpDiastolic,
      hemoglobin: double.tryParse(_hbController.text),
      fetalHeartRate: int.tryParse(_fhrController.text),
      dangerSigns: _dangerSigns.toList(),
      referral: _referral ? 'PHC referral needed' : null,
      observations: _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim(),
      createdAt: now,
      updatedAt: now,
    );
    await ref.read(maternalRepositoryProvider).saveANCVisit(model);
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('ANC visit recorded')),
    );
    context.pop();
  }

  @override
  void dispose() {
    _weightController.dispose();
    _hbController.dispose();
    _fhrController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'ANC Visit',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            Text('Vitals', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
            ASHATextField(
              label: 'Weight (kg)',
              hint: 'e.g. 54.5',
              controller: _weightController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              prefixIcon: Icon(Icons.monitor_weight_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Row(
              children: [
                Expanded(
                  child: ASHATextField(
                    label: 'BP systolic',
                    hint: '120',
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.compress),
                    onChanged: (v) => _bpSystolic = int.tryParse(v ?? ''),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'BP diastolic',
                    hint: '80',
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.compress),
                    onChanged: (v) => _bpDiastolic = int.tryParse(v ?? ''),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Row(
              children: [
                Expanded(
                  child: ASHATextField(
                    label: 'Hemoglobin (g/dL)',
                    hint: '11.2',
                    controller: _hbController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    prefixIcon: Icon(Icons.opacity),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'Fetal heart rate',
                    hint: '140',
                    controller: _fhrController,
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.monitor_heart_outlined),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            Text('Danger signs', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _dangerSignOptions.map((d) {
                final sel = _dangerSigns.contains(d);
                return FilterChip(
                  label: Text(d),
                  selected: sel,
                  onSelected: (v) => setState(() {
                    if (v) {
                      _dangerSigns.add(d);
                    } else {
                      _dangerSigns.remove(d);
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
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Observations / notes',
              controller: _notesController,
              prefixIcon: Icon(Icons.notes),
              maxLines: 3,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHACard(
              child: Row(
                children: [
                  Expanded(
                    child: Text('Refer to higher facility', style: ASHATypography.bodyMD),
                  ),
                  Switch(
                    value: _referral,
                    onChanged: (v) => setState(() => _referral = v),
                    activeColor: ASHAColors.error,
                  ),
                ],
              ),
            ),
            if (_referral) ...[
              const SizedBox(height: ASHASpacing.stackSM),
              StatusChip(
                status: StatusChipType.danger,
                label: 'Referral required',
              ),
            ],
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save ANC Visit',
              onPressed: _saving ? null : _save,
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
