import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/offline/sync_queue.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/ec_models.dart';

/// Follow-up counselling form: method use, side effects, missed period.
class ECFollowupScreen extends ConsumerStatefulWidget {
  const ECFollowupScreen({super.key, required this.ecId});

  final String ecId;

  @override
  ConsumerState<ECFollowupScreen> createState() => _ECFollowupScreenState();
}

class _ECFollowupScreenState extends ConsumerState<ECFollowupScreen> {
  String _method = 'OCP';
  bool _counseling = false;
  bool _missedPeriod = false;
  final _sideEffects = <String>{};
  bool _saving = false;

  static const _sideEffectOptions = [
    'Nausea',
    'Headache',
    'Irregular bleeding',
    'Weight gain',
    'Mood changes',
    'Lower abdominal pain',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'EC Follow-up',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            Text('Method in use', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            DropdownButtonFormField<String>(
              initialValue: _method,
              decoration: const InputDecoration(border: OutlineInputBorder()),
              items: const [
                'OCP', 'IUCD', 'Condom', 'Injectable', 'Sterilization', 'None'
              ]
                  .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                  .toList(),
              onChanged: (v) => setState(() => _method = v ?? _method),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text('Side effects', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _sideEffectOptions.map((s) {
                final sel = _sideEffects.contains(s);
                return FilterChip(
                  label: Text(s),
                  selected: sel,
                  onSelected: (v) => setState(() {
                    if (v) {
                      _sideEffects.add(s);
                    } else {
                      _sideEffects.remove(s);
                    }
                  }),
                  selectedColor: ASHAColors.primaryContainer,
                  checkmarkColor: ASHAColors.primary,
                  side: BorderSide(
                    color: sel ? ASHAColors.primary : ASHAColors.outlineVariant,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            _CheckRow(
              label: 'Family planning counselling done',
              value: _counseling,
              onChanged: (v) => setState(() => _counseling = v),
            ),
            _CheckRow(
              label: 'Missed period (possible pregnancy)',
              value: _missedPeriod,
              onChanged: (v) => setState(() => _missedPeriod = v),
            ),
            if (_missedPeriod)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: StatusChip(
                  status: StatusChipType.danger,
                  label: 'Advise pregnancy test',
                ),
              ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save Follow-up',
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      final now = DateTime.now().toIso8601String();
                      final model = ECFollowupModel(
                        followupId: 'ECF-${DateTime.now().millisecondsSinceEpoch}',
                        ecId: widget.ecId,
                        followupDate: now,
                        methodUsed: _method,
                        sideEffects: _sideEffects.toList(),
                        counselingDone: _counseling,
                        missedPeriod: _missedPeriod,
                        createdAt: now,
                        updatedAt: now,
                      );
                      await SyncQueue.enqueue(
                        db: ref.read(databaseProvider),
                        table: 'ec_followups',
                        recordId: model.followupId,
                        operation: 'update',
                        payload: model.toJson(),
                      );
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Follow-up saved')),
                      );
                      context.pop();
                    },
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.favorite_outline,
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
