import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/validators.dart';
import '../data/ec_models.dart';

class ECRegistrationScreen extends ConsumerStatefulWidget {
  const ECRegistrationScreen({super.key});

  @override
  ConsumerState<ECRegistrationScreen> createState() => _ECRegistrationScreenState();
}

class _ECRegistrationScreenState extends ConsumerState<ECRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _husbandController = TextEditingController();
  final _wifeController = TextEditingController();
  final _wifeBeneficiaryController = TextEditingController();
  final _addressController = TextEditingController();
  final _ageController = TextEditingController();
  final _childrenController = TextEditingController();

  String _method = 'None';
  bool _needsFP = false;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Register Couple',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(ASHASpacing.marginMobile),
            children: [
              ASHATextField(
                label: 'Husband name *',
                controller: _husbandController,
                prefixIcon: Icon(Icons.person_outline),
                validator: nonEmpty('Husband name is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Wife name *',
                controller: _wifeController,
                prefixIcon: Icon(Icons.person_outline),
                validator: nonEmpty('Wife name is required'),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Wife beneficiary ID (optional)',
                controller: _wifeBeneficiaryController,
                prefixIcon: Icon(Icons.badge_outlined),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHATextField(
                label: 'Address',
                controller: _addressController,
                prefixIcon: Icon(Icons.home_outlined),
                maxLines: 2,
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Row(
                children: [
                  Expanded(
                    child: ASHATextField(
                      label: 'Wife age',
                      controller: _ageController,
                      keyboardType: TextInputType.number,
                      prefixIcon: Icon(Icons.cake_outlined),
                    ),
                  ),
                  const SizedBox(width: ASHASpacing.stackSM),
                  Expanded(
                    child: ASHATextField(
                      label: 'Children',
                      controller: _childrenController,
                      keyboardType: TextInputType.number,
                      prefixIcon: Icon(Icons.child_care_outlined),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              Text('Contraceptive method', style: ASHATypography.labelLG),
              const SizedBox(height: ASHASpacing.stackSM),
              DropdownButtonFormField<String>(
                initialValue: _method,
                decoration: const InputDecoration(border: OutlineInputBorder()),
                items: const [
                  'None', 'OCP', 'IUCD', 'Condom', 'Injectable', 'Sterilization (female)', 'Sterilization (male)'
                ]
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) => setState(() => _method = v ?? _method),
              ),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHACard(
                child: Row(
                  children: [
                    Expanded(
                      child: Text('Needs family planning counselling',
                          style: ASHATypography.bodyMD),
                    ),
                    Switch(
                      value: _needsFP,
                      onChanged: (v) => setState(() => _needsFP = v),
                      activeColor: ASHAColors.primary,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: ASHASpacing.stackLG),
              ASHAButton(
                label: _saving ? 'Saving…' : 'Register Couple',
                onPressed: _saving
                    ? null
                    : () async {
                        if (!_formKey.currentState!.validate()) return;
                        setState(() => _saving = true);
                        final now = DateTime.now().toIso8601String();
                        final model = EligibleCoupleModel(
                          ecId: 'EC-${DateTime.now().millisecondsSinceEpoch}',
                          husbandName: _husbandController.text.trim(),
                          wifeName: _wifeController.text.trim(),
                          wifeBeneficiaryId:
                              _wifeBeneficiaryController.text.trim().isEmpty
                                  ? null
                                  : _wifeBeneficiaryController.text.trim(),
                          address: _addressController.text.trim().isEmpty
                              ? null
                              : _addressController.text.trim(),
                          age: int.tryParse(_ageController.text),
                          childrenCount: int.tryParse(_childrenController.text),
                          contraceptiveMethod: _method == 'None' ? null : _method,
                          needsFamilyPlanning: _needsFP,
                          createdAt: now,
                          updatedAt: now,
                        );
                        final saved =
                            await ref.read(eligibleCoupleRepositoryProvider).save(model);
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Couple registered')),
                        );
                        context.pushReplacementNamed(
                          AppRoutes.ecDetail,
                          pathParameters: {'id': saved.ecId},
                        );
                      },
                loading: _saving,
                fullWidth: true,
                height: ASHASpacing.touchTargetMin,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
