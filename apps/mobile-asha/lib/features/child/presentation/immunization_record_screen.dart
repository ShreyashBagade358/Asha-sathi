import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/offline/sync_queue.dart';
import '../../../core/providers/providers.dart';
import '../data/child_models.dart';

class ImmunizationRecordScreen extends ConsumerStatefulWidget {
  const ImmunizationRecordScreen({
    super.key,
    required this.childId,
    required this.vaccineId,
  });

  final String childId;
  final String vaccineId;

  @override
  ConsumerState<ImmunizationRecordScreen> createState() =>
      _ImmunizationRecordScreenState();
}

class _ImmunizationRecordScreenState
    extends ConsumerState<ImmunizationRecordScreen> {
  final _batchController = TextEditingController();
  String _givenAt = 'VHND session';
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Record Vaccine',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            ASHACard(
              title: 'Vaccine',
              subtitle: 'Administering the dose now.',
              child: const Icon(Icons.vaccines, color: ASHAColors.primary),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text('Session type', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'VHND session', label: Text('VHND')),
                ButtonSegment(value: 'PHC', label: Text('PHC')),
                ButtonSegment(value: 'Home', label: Text('Home')),
                ButtonSegment(value: 'Outreach', label: Text('Outreach')),
              ],
              selected: {_givenAt},
              onSelectionChanged: (s) => setState(() => _givenAt = s.first),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Batch number',
              hint: 'Vaccine batch / lot no.',
              controller: _batchController,
              prefixIcon: Icon(Icons.qr_code_2_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Confirm Dose Given',
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      final now = DateTime.now().toIso8601String();
                      final model = ImmunizationModel(
                        immunizationId: widget.vaccineId,
                        childId: widget.childId,
                        vaccineName: 'Dose',
                        givenDate: now,
                        givenAt: _givenAt,
                        batchNumber: _batchController.text.trim().isEmpty
                            ? null
                            : _batchController.text.trim(),
                        status: 'given',
                        createdAt: now,
                        updatedAt: now,
                      );
                      await SyncQueue.enqueue(
                        db: ref.read(databaseProvider),
                        table: 'immunizations',
                        recordId: model.immunizationId,
                        operation: 'update',
                        payload: model.toJson(),
                      );
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Dose recorded')),
                      );
                      context.pop();
                    },
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.check_circle_outline,
            ),
          ],
        ),
      ),
    );
  }
}
