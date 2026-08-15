import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/incentive_models.dart';

/// Village form entry with templates for VHND/VHNC/PHC/AHD/Deworming.
class VillageFormScreen extends ConsumerStatefulWidget {
  const VillageFormScreen({super.key});

  @override
  ConsumerState<VillageFormScreen> createState() => _VillageFormScreenState();
}

class _VillageFormScreenState extends ConsumerState<VillageFormScreen> {
  String _formType = 'VHND';
  final _placeController = TextEditingController();
  final _attendedController = TextEditingController();

  final _dataControllers = <String, TextEditingController>{};
  bool _saving = false;

  static const _templates = {
    'VHND': ['Pregnant women attended', 'Children immunized', 'IEC material distributed'],
    'VHNC': ['Children weighed', 'Severely wasted children', 'Counseling done'],
    'PHC': ['Cases referred', 'Routine check-ups', 'Samples collected'],
    'AHD': ['Adult screened', 'Diabetes/hypertension suspected', 'Referred'],
    'Deworming': ['Albendazole doses given', 'Schools covered', 'AWC sessions covered'],
  };

  List<String> get _fields => _templates[_formType]!;

  @override
  void dispose() {
    _placeController.dispose();
    _attendedController.dispose();
    for (final c in _dataControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Village Form',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            Text('Form type', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            SegmentedButton<String>(
              segments: _templates.keys
                  .map((k) => ButtonSegment(value: k, label: Text(k)))
                  .toList(),
              selected: {_formType},
              onSelectionChanged: (s) => setState(() {
                _formType = s.first;
                _dataControllers.clear();
              }),
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: ASHAColors.primary,
                selectedForegroundColor: ASHAColors.onPrimary,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Place / session venue',
              controller: _placeController,
              prefixIcon: Icon(Icons.place_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Attended by',
              controller: _attendedController,
              prefixIcon: Icon(Icons.person_outline),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            Text('${_formType} details', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
            ..._fields.asMap().entries.map((e) {
              final field = e.value;
              final controller = _dataControllers.putIfAbsent(field, () {
                final c = TextEditingController();
                return c;
              });
              return Padding(
                padding: const EdgeInsets.only(bottom: ASHASpacing.stackMD),
                child: ASHATextField(
                  label: field,
                  hint: '0',
                  controller: controller,
                  keyboardType: TextInputType.number,
                  prefixIcon: Icon(Icons.numbers),
                ),
              );
            }),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save & Submit Form',
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      final now = DateTime.now().toIso8601String();
                      final data = <String, dynamic>{};
                      for (final f in _fields) {
                        data[f] = int.tryParse(
                                _dataControllers[f]?.text ?? '') ??
                            0;
                      }
                      final model = VillageFormModel(
                        formId: 'VF-${DateTime.now().millisecondsSinceEpoch}',
                        formType: _formType,
                        formDate: now,
                        place: _placeController.text.trim().isEmpty
                            ? null
                            : _placeController.text.trim(),
                        attendedBy: _attendedController.text.trim().isEmpty
                            ? null
                            : _attendedController.text.trim(),
                        data: data,
                        status: 'submitted',
                        createdAt: now,
                        updatedAt: now,
                      );
                      await ref.read(incentiveRepositoryProvider).saveForm(model);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Form submitted')),
                      );
                      context.pop();
                    },
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.send_outlined,
            ),
          ],
        ),
      ),
    );
  }
}
