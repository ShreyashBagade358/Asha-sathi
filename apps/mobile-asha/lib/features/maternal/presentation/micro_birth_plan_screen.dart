import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/offline/sync_queue.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/validators.dart';
import '../data/maternal_models.dart';

/// Micro birth plan (9th month readiness) for a pregnancy.
class MicroBirthPlanScreen extends ConsumerStatefulWidget {
  const MicroBirthPlanScreen({super.key, required this.pregnancyId});

  final String pregnancyId;

  @override
  ConsumerState<MicroBirthPlanScreen> createState() => _MicroBirthPlanScreenState();
}

class _MicroBirthPlanScreenState extends ConsumerState<MicroBirthPlanScreen> {
  final _formKey = GlobalKey<FormState>();
  final _facilityController = TextEditingController();
  final _transportController = TextEditingController();
  final _attendantController = TextEditingController();
  final _emergencyController = TextEditingController();
  final _notesController = TextEditingController();

  bool _funds = false;
  bool _bloodDonor = false;
  int _advance = 0;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Micro Birth Plan',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(ASHASpacing.marginMobile),
            children: [
              ASHATextField(
                label: 'Delivery facility',
                hint: 'PHC / CHC / Hospital name',
                controller: _facilityController,
                prefixIcon: Icon(Icons.local_hospital_outlined),
                validator: nonEmpty('Facility is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Mode of transport',
                hint: 'Ambulance / Auto / Bike',
                controller: _transportController,
                prefixIcon: Icon(Icons.local_taxi_outlined),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Attendant / birth companion',
                controller: _attendantController,
                prefixIcon: Icon(Icons.group_outlined),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Emergency contact *',
                hint: '10-digit number',
                controller: _emergencyController,
                keyboardType: TextInputType.phone,
                prefixIcon: Icon(Icons.phone_outlined),
                validator: nonEmpty('Emergency contact is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Advance arrangement done', style: ASHATypography.labelLG),
              const SizedBox(height: ASHASpacing.stackSM),
              SegmentedButton<int>(
                segments: const [
                  ButtonSegment(value: 0, label: Text('Not yet')),
                  ButtonSegment(value: 1, label: Text('Partially')),
                  ButtonSegment(value: 2, label: Text('Ready')),
                ],
                selected: {_advance},
                onSelectionChanged: (s) => setState(() => _advance = s.first),
                style: SegmentedButton.styleFrom(
                  selectedBackgroundColor: ASHAColors.primary,
                  selectedForegroundColor: ASHAColors.onPrimary,
                ),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              _CheckRow(
                label: 'Funds arranged',
                value: _funds,
                onChanged: (v) => setState(() => _funds = v),
              ),
              _CheckRow(
                label: 'Blood donor identified',
                value: _bloodDonor,
                onChanged: (v) => setState(() => _bloodDonor = v),
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
                label: _saving ? 'Saving…' : 'Save Birth Plan',
                onPressed: _saving
                    ? null
                    : () async {
                        if (!_formKey.currentState!.validate()) return;
                        setState(() => _saving = true);
                        final now = DateTime.now().toIso8601String();
                        final model = MicroBirthPlanModel(
                          planId: 'MBP-${DateTime.now().millisecondsSinceEpoch}',
                          pregnancyId: widget.pregnancyId,
                          facility: _facilityController.text.trim(),
                          modeOfTransport: _transportController.text.trim(),
                          attendant: _attendantController.text.trim(),
                          emergencyContact: _emergencyController.text.trim(),
                          advanceArrangement: _advance,
                          fundsArranged: _funds,
                          bloodDonorIdentified: _bloodDonor,
                          notes: _notesController.text.trim().isEmpty
                              ? null
                              : _notesController.text.trim(),
                          createdAt: now,
                          updatedAt: now,
                        );
                        await SyncQueue.enqueue(
                          db: ref.read(databaseProvider),
                          table: 'micro_birth_plans',
                          recordId: model.planId,
                          operation: 'update',
                          payload: model.toJson(),
                        );
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Birth plan saved')),
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
