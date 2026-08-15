import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/maternal_models.dart';

class DeliveryRecordScreen extends ConsumerStatefulWidget {
  const DeliveryRecordScreen({super.key, required this.pregnancyId});

  final String pregnancyId;

  @override
  ConsumerState<DeliveryRecordScreen> createState() => _DeliveryRecordScreenState();
}

class _DeliveryRecordScreenState extends ConsumerState<DeliveryRecordScreen> {
  final _childNameController = TextEditingController();
  final _birthWeightController = TextEditingController();
  String _place = 'Home';
  String _mode = 'normal';
  String _childGender = 'male';
  String _outcome = 'live';
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Delivery Record',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            Text('Place of delivery', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'Home', label: Text('Home')),
                ButtonSegment(value: 'PHC', label: Text('PHC')),
                ButtonSegment(value: 'CHC', label: Text('CHC')),
                ButtonSegment(value: 'Hospital', label: Text('Hospital')),
              ],
              selected: {_place},
              onSelectionChanged: (s) => setState(() => _place = s.first),
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: ASHAColors.primary,
                selectedForegroundColor: ASHAColors.onPrimary,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text('Mode of delivery', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'normal', label: Text('Normal')),
                ButtonSegment(value: 'c-section', label: Text('C-section')),
                ButtonSegment(value: 'assisted', label: Text('Assisted')),
              ],
              selected: {_mode},
              onSelectionChanged: (s) => setState(() => _mode = s.first),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Child name',
              hint: 'Name of newborn',
              controller: _childNameController,
              prefixIcon: Icon(Icons.badge_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text('Child gender', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'male', label: Text('Male')),
                ButtonSegment(value: 'female', label: Text('Female')),
              ],
              selected: {_childGender},
              onSelectionChanged: (s) => setState(() => _childGender = s.first),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Birth weight (kg)',
              hint: 'e.g. 2.9',
              controller: _birthWeightController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              prefixIcon: Icon(Icons.monitor_weight_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text('Outcome', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'live', label: Text('Live')),
                ButtonSegment(value: 'stillbirth', label: Text('Stillbirth')),
              ],
              selected: {_outcome},
              onSelectionChanged: (s) => setState(() => _outcome = s.first),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save Delivery',
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      final now = DateTime.now().toIso8601String();
                      final model = DeliveryOutcomeModel(
                        deliveryId: 'DEL-${DateTime.now().millisecondsSinceEpoch}',
                        pregnancyId: widget.pregnancyId,
                        beneficiaryId: '',
                        deliveryDate: now,
                        deliveryPlace: _place,
                        deliveryMode: _mode,
                        childName: _childNameController.text.trim().isEmpty
                            ? null
                            : _childNameController.text.trim(),
                        childGender: _childGender,
                        birthWeightKg: double.tryParse(_birthWeightController.text),
                        outcome: _outcome,
                        createdAt: now,
                        updatedAt: now,
                      );
                      await ref.read(maternalRepositoryProvider).saveDelivery(model);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Delivery recorded')),
                      );
                      context.pushNamed(AppRoutes.childRegister);
                    },
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.check_circle_outline,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHAButton(
              label: 'Record PNC Visit',
              onPressed: () => context.pushNamed(
                AppRoutes.pncRecord,
                pathParameters: {'beneficiaryId': ''},
              ),
              variant: ASHAButtonVariant.outline,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
            ),
          ],
        ),
      ),
    );
  }
}
