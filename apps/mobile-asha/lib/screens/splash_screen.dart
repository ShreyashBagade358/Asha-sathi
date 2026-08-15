import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_state.dart';
import '../core/navigation/router.dart';
import '../core/providers/providers.dart';

/// Branded splash screen shown on launch. Routes to the home shell when a
/// session exists, otherwise to login.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final auth = ref.read(authStateProvider);
    if (!auth.isAuthenticated) {
      await auth.restoreSession();
    }
    // Brief brand moment.
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    context.goNamed(
      auth.isAuthenticated ? AppRoutes.home : AppRoutes.login,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ASHAColors.primary,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: ASHAColors.onPrimary,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(
                Icons.health_and_safety,
                size: 48,
                color: ASHAColors.primary,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text(
              'ASHA Sathi',
              style: ASHATypography.headlineLG.copyWith(
                color: ASHAColors.onPrimary,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackSM),
            Text(
              'आपकी हर सहायता के लिए',
              style: ASHATypography.bodyMD.copyWith(
                color: ASHAColors.onPrimary.withValues(alpha: 0.85),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
