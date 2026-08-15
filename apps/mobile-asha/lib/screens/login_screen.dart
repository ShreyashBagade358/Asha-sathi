import 'dart:async';

import 'package:asha_design_system/asha_design_system.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_repository.dart';
import '../core/config/app_config.dart';
import '../core/config/languages.dart';
import '../core/l10n/app_strings.dart';
import '../core/navigation/router.dart';
import '../core/providers/providers.dart';
import '../core/utils/formatters.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneController = TextEditingController();
  bool _isLoading = false;
  bool _isOnline = true;
  String? _error;
  StreamSubscription<List<ConnectivityResult>>? _connSub;

  @override
  void initState() {
    super.initState();
    _watchConnectivity();
  }

  Future<void> _watchConnectivity() async {
    final connectivity = Connectivity();
    final results = await connectivity.checkConnectivity();
    if (!mounted) return;
    setState(() {
      _isOnline = results.any((r) => r != ConnectivityResult.none);
    });
    _connSub = connectivity.onConnectivityChanged.listen((results) {
      if (!mounted) return;
      setState(() {
        _isOnline = results.any((r) => r != ConnectivityResult.none);
      });
    });
  }

  Future<void> _sendOtp() async {
    final phone = _phoneController.text.trim();
    final normalised = normalisePhone(phone);
    if (normalised == null) {
      setState(() => _error = 'Enter a valid 10-digit mobile number');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final repo = ref.read(authRepositoryProvider);
      await repo.sendOtp(normalised);
      if (!mounted) return;
      context.pushNamed(
        AppRoutes.otp,
        extra: normalised,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not send OTP. Check network and try again.';
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _connSub?.cancel();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = AppStrings.t;
    return Scaffold(
      appBar: ASHATopAppBar(title: lang('login')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            const SizedBox(height: ASHASpacing.stackLG),
            _LanguageToggle(),
            const SizedBox(height: ASHASpacing.stackXL),
            Text(
              lang('welcome'),
              style: ASHATypography.headlineLGMobile,
            ),
            const SizedBox(height: ASHASpacing.stackSM),
            Text(
              lang('enter_phone'),
              style: ASHATypography.bodyMD.copyWith(
                color: ASHAColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHATextField(
              label: lang('phone'),
              hint: '98765 43210',
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              prefixIcon: Icon(Icons.phone_android),
              errorText: _error,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHAButton(
              label: lang('send_otp'),
              onPressed: _isLoading ? null : _sendOtp,
              loading: _isLoading,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
            ),
            if (!_isOnline) ...[
              const SizedBox(height: ASHASpacing.stackMD),
              StatusChip(
                status: StatusChipType.warning,
                label: lang('offline_notice'),
              ),
            ],
            const SizedBox(height: ASHASpacing.stackLG),
            Center(
              child: Text(
                'v${AppConfig.appVersion}',
                style: ASHATypography.labelMD.copyWith(
                  color: ASHAColors.outline,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact language picker cycling through [supportedLanguages].
class _LanguageToggle extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeProvider)?.languageCode ?? 'en';
    final selected = languageForCode(current);
    return ASHACard(
      onTap: () {
        final idx = supportedLanguages.indexWhere((l) => l.code == current);
        final next = supportedLanguages[(idx + 1) % supportedLanguages.length];
        ref.read(localeProvider.notifier).state = next.locale;
      },
      child: Row(
        children: [
          const Icon(Icons.translate, color: ASHAColors.primary),
          const SizedBox(width: ASHASpacing.stackSM),
          Text(selected.flag, style: ASHATypography.labelLG),
          const SizedBox(width: ASHASpacing.stackSM),
          Expanded(
            child: Text(
              '${selected.name} (${selected.nameNative})',
              style: ASHATypography.labelLG,
            ),
          ),
          const Icon(Icons.swap_horiz, color: ASHAColors.onSurfaceVariant),
        ],
      ),
    );
  }
}
