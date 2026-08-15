import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/offline/sync_queue.dart';
import '../../../core/providers/providers.dart';
import '../data/maternal_models.dart';

class PNCRecordScreen extends ConsumerStatefulWidget {
  const PNCRecordScreen({super.key, required this.beneficiaryId});

  final String beneficiaryId;

  @override
  ConsumerState<PNCRecordScreen> createState() => _PNCRecordScreenState();
}

class _PNCRecordScreenState extends ConsumerState<PNCRecordScreen> {
  final _weightController = TextEditingController();
  final _notesController = TextEditingController();
  int? _bpSystolic;
  int? _bpDiastolic;
  bool _breastfeeding = false;
  bool _uterusInvoluted = false;
  bool _lochiaNormal = false;
  final _dangerSigns = <String>{};
  bool _saving = false;

  static const _dangerOptions = [
    'High fever',
    'Heavy bleeding',
    'Severe headache',
    'Breast pain / redness',
    'Foul-smelling discharge',
    'Difficulty breathing',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'PNC Visit',
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
                    label: 'Mother weight (kg)',
                    controller: _weightController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    prefixIcon: Icon(Icons.monitor_weight_outlined),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'BP',
                    hint: '120/80',
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.compress),
                    onChanged: (v) {
                      final parts = (v ?? '').split('/');
                      _bpSystolic = int.tryParse(parts.isEmpty ? '' : parts[0]);
                      _bpDiastolic = parts.length > 1 ? int.tryParse(parts[1]) : null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            _CheckRow(
              label: 'Breastfeeding started',
              value: _breastfeeding,
              onChanged: (v) => setState(() => _breastfeeding = v),
            ),
            _CheckRow(
              label: 'Uterus involuted',
              value: _uterusInvoluted,
              onChanged: (v) => setState(() => _uterusInvoluted = v),
            ),
            _CheckRow(
              label: 'Lochia normal',
              value: _lochiaNormal,
              onChanged: (v) => setState(() => _lochiaNormal = v),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text('Danger signs', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _dangerOptions.map((d) {
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
              label: 'Notes',
              controller: _notesController,
              prefixIcon: Icon(Icons.notes),
              maxLines: 2,
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save PNC Visit',
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      final now = DateTime.now().toIso8601String();
                      final model = PNCVisitModel(
                        pncVisitId: 'PNC-${DateTime.now().millisecondsSinceEpoch}',
                        beneficiaryId: widget.beneficiaryId,
                        visitDate: now,
                        motherWeightKg: double.tryParse(_weightController.text),
                        bpSystolic: _bpSystolic,
                        bpDiastolic: _bpDiastolic,
                        breastfeedingStarted: _breastfeeding,
                        uterusInvoluted: _uterusInvoluted,
                        lochiaNormal: _lochiaNormal,
                        dangerSigns: _dangerSigns.toList(),
                        notes: _notesController.text.trim().isEmpty
                            ? null
                            : _notesController.text.trim(),
                        createdAt: now,
                        updatedAt: now,
                      );
                      await SyncQueue.enqueue(
                        db: ref.read(databaseProvider),
                        table: 'pnc_visits',
                        recordId: model.pncVisitId,
                        operation: 'update',
                        payload: model.toJson(),
                      );
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('PNC visit saved')),
                      );
                      context.pop();
                    },
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
            ),
          ],
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
          Expanded(
            child: Text(label, style: ASHATypography.bodyMD),
          ),
          Switch(value: value, onChanged: onChanged, activeColor: ASHAColors.primary),
        ],
      ),
    );
  }
}
