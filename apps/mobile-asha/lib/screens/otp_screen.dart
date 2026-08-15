import 'dart:async';

import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_repository.dart';
import '../core/auth/auth_state.dart';
import '../core/config/app_config.dart';
import '../core/l10n/app_strings.dart';
import '../core/navigation/router.dart';
import '../core/providers/providers.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _controllers = List.generate(6, (_) => TextEditingController());
  final _foci = List.generate(6, (_) => FocusNode());
  bool _isVerifying = false;
  String? _error;
  int _cooldown = AppConfig.otpResendCooldownSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => _cooldown = AppConfig.otpResendCooldownSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      if (_cooldown <= 1) {
        t.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown--);
      }
    });
  }

  String get _otp => _controllers.map((c) => c.text).join();

  void _onDigitChanged(int index, String value) {
    if (value.isNotEmpty && index < 5) {
      _foci[index + 1].requestFocus();
    }
    if (_otp.length == 6) {
      _foci.last.unfocus();
    }
  }

  Future<void> _verify() async {
    if (_otp.length != 6) {
      setState(() => _error = 'Enter the complete 6-digit OTP');
      return;
    }
    setState(() {
      _isVerifying = true;
      _error = null;
    });
    try {
      final repo = ref.read(authRepositoryProvider);
      final tokens = await repo.verifyOtp(widget.phone, _otp);
      final auth = ref.read(authStateProvider);
      await auth.login(
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        user: tokens.user,
      );
      if (!mounted) return;
      context.go(AppRoutes.home);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Invalid or expired OTP. Please try again.';
        _isVerifying = false;
      });
    }
  }

  Future<void> _resend() async {
    setState(() {
      _error = null;
      _isVerifying = true;
    });
    try {
      await ref.read(authRepositoryProvider).sendOtp(widget.phone);
      if (!mounted) return;
      _startCooldown();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('OTP resent')),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not resend OTP');
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _foci) {
      f.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = AppStrings.t;
    return Scaffold(
      appBar: ASHATopAppBar(
        title: lang('verify_otp'),
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            const SizedBox(height: ASHASpacing.stackXL),
            Text(
              lang('enter_otp'),
              style: ASHATypography.bodyLG,
            ),
            const SizedBox(height: ASHASpacing.stackSM),
            Text(
              '+91 ${widget.phone}',
              style: ASHATypography.headlineMD.copyWith(
                color: ASHAColors.primary,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(6, (i) {
                return SizedBox(
                  width: 48,
                  child: TextField(
                    controller: _controllers[i],
                    focusNode: _foci[i],
                    onChanged: (v) {
                      setState(() => _error = null);
                      _onDigitChanged(i, v);
                    },
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    maxLength: 1,
                    style: ASHATypography.headlineMD,
                    decoration: InputDecoration(
                      counterText: '',
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide:
                            const BorderSide(color: ASHAColors.outlineVariant),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: ASHAColors.primary,
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
            if (_error != null) ...[
              const SizedBox(height: ASHASpacing.stackMD),
              Text(
                _error!,
                style: ASHATypography.bodyMD.copyWith(
                  color: ASHAColors.error,
                ),
              ),
            ],
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: lang('verify_otp'),
              onPressed: _isVerifying ? null : _verify,
              loading: _isVerifying,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_cooldown > 0)
                  Text(
                    'Resend in 0:${_cooldown.toString().padLeft(2, '0')}',
                    style: ASHATypography.labelMD.copyWith(
                      color: ASHAColors.onSurfaceVariant,
                    ),
                  )
                else
                  TextButton(
                    onPressed: _isVerifying ? null : _resend,
                    child: Text(
                      lang('resend_otp'),
                      style: ASHATypography.labelLG.copyWith(
                        color: ASHAColors.primary,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
