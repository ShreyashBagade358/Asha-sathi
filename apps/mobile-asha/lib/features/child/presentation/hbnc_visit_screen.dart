import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/offline/sync_queue.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/child_models.dart';

/// Home Based Newborn Care visit form (day 3/7/14/21/28).
class HBNCVisitScreen extends ConsumerStatefulWidget {
  const HBNCVisitScreen({super.key, required this.childId});

  final String childId;

  @override
  ConsumerState<HBNCVisitScreen> createState() => _HBNCVisitScreenState();
}

class _HBNCVisitScreenState extends ConsumerState<HBNCVisitScreen> {
  final _weightController = TextEditingController();
  final _temperatureController = TextEditingController();
  final _notesController = TextEditingController();

  int? _visitNumber;
  int? _dayOfLife;
  bool _jaundice = false;
  bool _referral = false;
  final _dangerSigns = <String>{};
  bool _saving = false;

  static const _dangerOptions = [
    'Not feeding well',
    'Convulsions',
    'Fast breathing',
    'Severe chest in-drawing',
    'Lethargic / unresponsive',
    'Fever',
    'Hypothermia (cold)',
    'Umbilicus red / pus',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'HBNC Visit',
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
                    label: 'Visit number',
                    hint: '3/7/14/21/28',
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.numbers),
                    onChanged: (v) => _visitNumber = int.tryParse(v ?? ''),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'Day of life',
                    hint: 'e.g. 7',
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.today_outlined),
                    onChanged: (v) => _dayOfLife = int.tryParse(v ?? ''),
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
                    label: 'Temperature',
                    hint: '°C',
                    controller: _temperatureController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    prefixIcon: Icon(Icons.thermostat_outlined),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            _CheckRow(
              label: 'Jaundice',
              value: _jaundice,
              onChanged: (v) => setState(() => _jaundice = v),
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
            _CheckRow(
              label: 'Referral needed',
              value: _referral,
              onChanged: (v) => setState(() => _referral = v),
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
              label: _saving ? 'Saving…' : 'Save HBNC Visit',
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      final now = DateTime.now().toIso8601String();
                      final model = HBNCVisitModel(
                        visitId: 'HBNC-${DateTime.now().millisecondsSinceEpoch}',
                        childId: widget.childId,
                        visitNumber: _visitNumber,
                        visitDate: now,
                        dayOfLife: _dayOfLife,
                        weightKg: double.tryParse(_weightController.text),
                        temperature: double.tryParse(_temperatureController.text),
                        jaundice: _jaundice,
                        dangerSigns: _dangerSigns.toList(),
                        referralNeeded: _referral,
                        notes: _notesController.text.trim().isEmpty
                            ? null
                            : _notesController.text.trim(),
                        createdAt: now,
                        updatedAt: now,
                      );
                      await SyncQueue.enqueue(
                        db: ref.read(databaseProvider),
                        table: 'hbnc_visits',
                        recordId: model.visitId,
                        operation: 'update',
                        payload: model.toJson(),
                      );
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('HBNC visit saved')),
                      );
                      context.pop();
                    },
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.home_outlined,
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
          Expanded(child: Text(label, style: ASHATypography.bodyMD)),
          Switch(value: value, onChanged: onChanged, activeColor: ASHAColors.primary),
        ],
      ),
    );
  }
}
