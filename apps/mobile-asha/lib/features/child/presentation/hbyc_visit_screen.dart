import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/offline/sync_queue.dart';
import '../../../core/providers/providers.dart';
import '../data/child_models.dart';

/// Home Based Care for Young Child visit form.
class HBYCVisitScreen extends ConsumerStatefulWidget {
  const HBYCVisitScreen({super.key, required this.childId});

  final String childId;

  @override
  ConsumerState<HBYCVisitScreen> createState() => _HBYCVisitScreenState();
}

class _HBYCVisitScreenState extends ConsumerState<HBYCVisitScreen> {
  int? _visitNumber;
  int? _ageMonths;
  bool _feeding = false;
  bool _growthMonitoring = false;
  bool _counseling = false;
  bool _referral = false;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'HBYC Visit',
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
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.numbers),
                    onChanged: (v) => _visitNumber = int.tryParse(v ?? ''),
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackSM),
                Expanded(
                  child: ASHATextField(
                    label: 'Age (months)',
                    keyboardType: TextInputType.number,
                    prefixIcon: Icon(Icons.calendar_month_outlined),
                    onChanged: (v) => _ageMonths = int.tryParse(v ?? ''),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            _CheckRow(
              label: 'Complementary feeding started',
              value: _feeding,
              onChanged: (v) => setState(() => _feeding = v),
            ),
            _CheckRow(
              label: 'Growth monitoring done',
              value: _growthMonitoring,
              onChanged: (v) => setState(() => _growthMonitoring = v),
            ),
            _CheckRow(
              label: 'Counselling given to caregiver',
              value: _counseling,
              onChanged: (v) => setState(() => _counseling = v),
            ),
            _CheckRow(
              label: 'Referral needed',
              value: _referral,
              onChanged: (v) => setState(() => _referral = v),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save HBYC Visit',
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      final now = DateTime.now().toIso8601String();
                      final model = HBYCVisitModel(
                        visitId: 'HBYC-${DateTime.now().millisecondsSinceEpoch}',
                        childId: widget.childId,
                        visitNumber: _visitNumber,
                        visitDate: now,
                        ageMonths: _ageMonths,
                        complementaryFeedingStarted: _feeding,
                        growthMonitoring: _growthMonitoring,
                        counselingGiven: _counseling,
                        referralNeeded: _referral,
                        createdAt: now,
                        updatedAt: now,
                      );
                      await SyncQueue.enqueue(
                        db: ref.read(databaseProvider),
                        table: 'hbyc_visits',
                        recordId: model.visitId,
                        operation: 'update',
                        payload: model.toJson(),
                      );
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('HBYC visit saved')),
                      );
                      context.pop();
                    },
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.child_care_outlined,
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
