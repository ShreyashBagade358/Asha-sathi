import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_repository.dart';
import '../core/config/app_config.dart';

/// Phone + OTP login for PHC Admin staff.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();

  bool _otpSent = false;
  bool _busy = false;
  int _resendIn = 0;
  String? _error;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    await ref.read(authControllerProvider.notifier).requestOtp(_phoneController.text);
    setState(() {
      _busy = false;
      _otpSent = true;
      _resendIn = AppConfig.otpResendCooldownSeconds;
      _error = null;
    });
    _startResendTimer();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('OTP sent to your phone.')),
      );
    }
  }

  void _startResendTimer() {
    Future.doWhile(() async {
      if (!mounted) return false;
      await Future<void>.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      if (_resendIn <= 0) return false;
      setState(() => _resendIn--);
      return true;
    });
  }

  Future<void> _verifyOtp() async {
    if (_otpController.text.trim().length < 4) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .verifyOtp(_phoneController.text, _otpController.text.trim());
      if (mounted) context.go('/');
    } catch (e) {
      setState(() => _error = '$e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_error!), backgroundColor: Theme.of(context).colorScheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(ASHASpacing.marginMobile),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.local_hospital,
                      size: 64,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(height: ASHASpacing.stackLG),
                    Text(
                      'PHC Admin Login',
                      textAlign: TextAlign.center,
                      style: ASHATypography.headlineLG,
                    ),
                    const SizedBox(height: ASHASpacing.stackSM),
                    Text(
                      'Access facility, staff and beneficiary verification for your Primary Health Centre.',
                      textAlign: TextAlign.center,
                      style: ASHATypography.bodyMD.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: ASHASpacing.stackXL),
                    ASHATextField(
                      controller: _phoneController,
                      label: 'Mobile number',
                      hint: '10-digit mobile number',
                      keyboardType: TextInputType.phone,
                      prefixIcon: const Icon(Icons.phone_android),
                      validator: (value) {
                        final digits = (value ?? '').replaceAll(RegExp(r'[^0-9]'), '');
                        return digits.length == 10 ? null : 'Enter a valid 10-digit number';
                      },
                    ),
                    const SizedBox(height: ASHASpacing.stackMD),
                    if (!_otpSent) ...[
                      ASHAButton(
                        label: 'Send OTP',
                        icon: Icons.sms_outlined,
                        onPressed: _sendOtp,
                        loading: _busy,
                      ),
                    ] else ...[
                      ASHATextField(
                        controller: _otpController,
                        label: 'OTP',
                        hint: '6-digit OTP',
                        keyboardType: TextInputType.number,
                        prefixIcon: const Icon(Icons.password),
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      Row(
                        children: [
                          Expanded(
                            child: ASHAButton(
                              label: _resendIn > 0 ? 'Resend OTP ($_resendIn s)' : 'Resend OTP',
                              variant: ASHAButtonVariant.outline,
                              onPressed: _resendIn > 0 ? () {} : _sendOtp,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      ASHAButton(
                        label: 'Verify & Login',
                        icon: Icons.login,
                        onPressed: _busy ? null : _verifyOtp,
                        loading: _busy,
                      ),
                      const SizedBox(height: ASHASpacing.stackSM),
                      Text(
                        'Demo offline mode: use OTP 123456.',
                        textAlign: TextAlign.center,
                        style: ASHATypography.bodySmall.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
