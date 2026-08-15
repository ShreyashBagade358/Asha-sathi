import 'package:flutter/material.dart';
import 'package:material_symbols_icons/material_symbols_icons.dart';

import '../theme/asha_colors.dart';
import '../theme/asha_spacing.dart';
import '../theme/asha_typography.dart';
import 'asha_button.dart';

enum ErrorScreenType {
  network,
  sessionExpired,
  dataNotFound,
  notFound404,
  maintenance,
  syncFailed,
  serverError500,
}

class ErrorScreenConfig {
  const ErrorScreenConfig({
    required this.icon,
    required this.headline,
    required this.message,
    required this.primaryLabel,
    required this.secondaryLabel,
  });

  final IconData icon;
  final String headline;
  final String message;
  final String primaryLabel;
  final String secondaryLabel;
}

ErrorScreenConfig errorScreenConfig(ErrorScreenType type) {
  switch (type) {
    case ErrorScreenType.network:
      return const ErrorScreenConfig(
        icon: Symbols.wifi_off_rounded,
        headline: 'No Internet Connection',
        message: 'You appear to be offline. Check your connection and try again.',
        primaryLabel: 'Try Again',
        secondaryLabel: 'Work Offline',
      );
    case ErrorScreenType.sessionExpired:
      return const ErrorScreenConfig(
        icon: Symbols.lock_clock_rounded,
        headline: 'Session Expired',
        message: 'Your session has ended. Please log in again to continue.',
        primaryLabel: 'Log In Again',
        secondaryLabel: 'Go to Login',
      );
    case ErrorScreenType.dataNotFound:
      return const ErrorScreenConfig(
        icon: Symbols.search_off_rounded,
        headline: 'No Data Found',
        message:
            'We could not find any records here. Try clearing your filters.',
        primaryLabel: 'Clear Filters',
        secondaryLabel: 'Go Back',
      );
    case ErrorScreenType.notFound404:
      return const ErrorScreenConfig(
        icon: Symbols.link_off_rounded,
        headline: 'Page Not Found',
        message:
            'The page you are looking for does not exist or has been moved.',
        primaryLabel: 'Go to Home',
        secondaryLabel: 'Go Back',
      );
    case ErrorScreenType.maintenance:
      return const ErrorScreenConfig(
        icon: Symbols.construction_rounded,
        headline: 'Under Maintenance',
        message:
            'We are making some improvements. Please check back shortly.',
        primaryLabel: 'Refresh',
        secondaryLabel: 'Back to Home',
      );
    case ErrorScreenType.syncFailed:
      return const ErrorScreenConfig(
        icon: Symbols.sync_problem_rounded,
        headline: 'Sync Failed',
        message:
            'We could not sync your data. Please check your connection and try again.',
        primaryLabel: 'Retry Sync',
        secondaryLabel: 'Work Offline',
      );
    case ErrorScreenType.serverError500:
      return const ErrorScreenConfig(
        icon: Symbols.report_rounded,
        headline: 'Server Error',
        message:
            'Something went wrong on our end. Please try again in a few minutes.',
        primaryLabel: 'Try Again',
        secondaryLabel: 'Back to Home',
      );
  }
}

Widget buildErrorScreen(
  ErrorScreenType type, {
  VoidCallback? onPrimary,
  VoidCallback? onSecondary,
}) {
  return ASHAErrorScreen(
    type: type,
    onPrimary: onPrimary,
    onSecondary: onSecondary,
  );
}

/// Full-screen error state (used for network / data problems).
class ASHAErrorScreen extends StatelessWidget {
  const ASHAErrorScreen({
    super.key,
    required this.type,
    this.onPrimary,
    this.onSecondary,
  });

  final ErrorScreenType type;
  final VoidCallback? onPrimary;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final config = errorScreenConfig(type);

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(ASHASpacing.marginMobile),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surfaceContainerHighest,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        config.icon,
                        size: 48,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  const SizedBox(height: ASHASpacing.stackLG),
                  Text(
                    config.headline,
                    textAlign: TextAlign.center,
                    style: ASHATypography.headlineLG.copyWith(
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: ASHASpacing.stackSM),
                  Text(
                    config.message,
                    textAlign: TextAlign.center,
                    style: ASHATypography.bodyMD.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: ASHASpacing.stackXL),
                  ASHAButton(
                    label: config.primaryLabel,
                    onPressed: onPrimary,
                  ),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHAButton(
                    label: config.secondaryLabel,
                    onPressed: onSecondary,
                    variant: ASHAButtonVariant.outline,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact empty-state widget for lists without data.
class ASHAEmptyState extends StatelessWidget {
  const ASHAEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(ASHASpacing.stackXL),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: ASHASpacing.stackMD),
            Text(
              title,
              textAlign: TextAlign.center,
              style: ASHATypography.headlineMD.copyWith(
                color: theme.colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackSM),
            Text(
              message,
              textAlign: TextAlign.center,
              style: ASHATypography.bodyMD.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: ASHASpacing.stackLG),
              ASHAButton(
                label: actionLabel!,
                variant: ASHAButtonVariant.outline,
                onPressed: onAction ?? () {},
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Centered loading indicator with an optional label.
class ASHALoadingView extends StatelessWidget {
  const ASHALoadingView({super.key, this.message = 'Loading…'});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: ASHASpacing.stackMD),
          Text(
            message,
            style: ASHATypography.labelMD.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// Amber banner shown when a screen is rendering fallback demo data.
class ASHAMockDataBanner extends StatelessWidget {
  const ASHAMockDataBanner({
    super.key,
    this.message = 'Showing sample data - backend unreachable',
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: ASHAColors.warning.withValues(alpha: 0.14),
      padding: const EdgeInsets.symmetric(
        horizontal: ASHASpacing.stackMD,
        vertical: ASHASpacing.stackSM,
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, size: 16, color: ASHAColors.warning),
          const SizedBox(width: ASHASpacing.stackSM),
          Expanded(
            child: Text(
              message,
              style: ASHATypography.labelMD.copyWith(color: ASHAColors.warning),
            ),
          ),
        ],
      ),
    );
  }
}
