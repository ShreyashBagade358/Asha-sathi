import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';

/// Create or link an ABHA (Health ID) via OTP / biometric / demographic.
class ABHALinkScreen extends ConsumerStatefulWidget {
  const ABHALinkScreen({super.key});

  @override
  ConsumerState<ABHALinkScreen> createState() => _ABHALinkScreenState();
}

class _ABHALinkScreenState extends ConsumerState<ABHALinkScreen> {
  int _method = 0; // 0 OTP, 1 biometric, 2 demographic
  final _abhaController = TextEditingController();
  final _otpController = TextEditingController();
  final _beneficiaryController = TextEditingController();
  final _nameController = TextEditingController();
  final _dobController = TextEditingController();
  bool _saving = false;

  Future<void> _submit() async {
    setState(() => _saving = true);
    final repo = ref.read(abhaRepositoryProvider);
    try {
      switch (_method) {
        case 0:
          await repo.linkByOtp(_abhaController.text.trim(), _otpController.text.trim());
        case 1:
          await repo.linkByBiometric(_abhaController.text.trim());
        case 2:
          await repo.createByDemographic({
            'beneficiary_id': _beneficiaryController.text.trim(),
            'name': _nameController.text.trim(),
            'dob': _dobController.text.trim(),
          });
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ABHA linked successfully')),
      );
      context.pushReplacementNamed(AppRoutes.abhaStatus);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not link ABHA. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _abhaController.dispose();
    _otpController.dispose();
    _beneficiaryController.dispose();
    _nameController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Link ABHA',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            ASHACard(
              title: 'What is ABHA?',
              subtitle: 'A 14-digit health ID that consolidates the beneficiary\'s health records.',
              child: const Icon(Icons.health_and_safety, color: ASHAColors.primary),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('OTP')),
                ButtonSegment(value: 1, label: Text('Biometric')),
                ButtonSegment(value: 2, label: Text('Demographic')),
              ],
              selected: {_method},
              onSelectionChanged: (s) => setState(() => _method = s.first),
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: ASHAColors.primary,
                selectedForegroundColor: ASHAColors.onPrimary,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            switch (_method) {
              0 => Column(
                  children: [
                    ASHATextField(
                      label: 'ABHA / Health ID number',
                      controller: _abhaController,
                      keyboardType: TextInputType.number,
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                    const SizedBox(height: ASHASpacing.stackMD),
                    ASHATextField(
                      label: 'OTP',
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      prefixIcon: Icon(Icons.pin_outlined),
                    ),
                  ],
                ),
              1 => ASHATextField(
                  label: 'ABHA / Health ID number',
                  controller: _abhaController,
                  keyboardType: TextInputType.number,
                  prefixIcon: Icon(Icons.fingerprint),
                ),
              _ => Column(
                  children: [
                    ASHATextField(
                      label: 'Beneficiary ID',
                      controller: _beneficiaryController,
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    const SizedBox(height: ASHASpacing.stackMD),
                    ASHATextField(
                      label: 'Full name',
                      controller: _nameController,
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                    const SizedBox(height: ASHASpacing.stackMD),
                    ASHATextField(
                      label: 'Date of birth',
                      controller: _dobController,
                      prefixIcon: Icon(Icons.cake_outlined),
                    ),
                  ],
                ),
            },
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Linking…' : 'Link ABHA',
              onPressed: _saving ? null : _submit,
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.link_outlined,
            ),
          ],
        ),
      ),
    );
  }
}
