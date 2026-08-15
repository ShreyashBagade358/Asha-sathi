import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app_shell.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/config/app_config.dart';
import '../../../core/config/languages.dart';
import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';

/// "More" tab and settings hub.
///
/// Hosts profile, language + theme preferences, deep links into the feature
/// catalogue, and logout.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Settings',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Manage language, theme and account.')),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            // Profile card
            ASHACard(
              title: user?.name ?? 'ASHA Worker',
              subtitle: '${user?.role.toUpperCase() ?? 'ASHA'} · ${user?.phone ?? ''}',
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: ASHAColors.primaryContainer,
                    child: Text(
                      _initials(user?.name ?? 'AS'),
                      style: ASHATypography.labelLG
                          .copyWith(color: ASHAColors.primary),
                    ),
                  ),
                  const Spacer(),
                  StatusChip(
                    status: authState.isAuthenticated
                        ? StatusChipType.success
                        : StatusChipType.neutral,
                    label: authState.isAuthenticated ? 'Logged in' : 'Offline',
                  ),
                ],
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),

            // Preferences
            ASHACard(
              title: 'Preferences',
              child: Column(
                children: [
                  _LanguageTile(),
                  const Divider(height: 1, color: ASHAColors.outlineVariant),
                  _ThemeTile(),
                ],
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),

            // Quick links
            ASHACard(
              title: 'Workspace',
              child: Column(
                children: [
                  _LinkTile(
                    icon: Icons.home_work_outlined,
                    label: 'Households',
                    route: AppRoutes.households,
                  ),
                  _LinkTile(
                    icon: Icons.notifications_outlined,
                    label: 'Notifications',
                    route: AppRoutes.notificationList,
                  ),
                  _LinkTile(
                    icon: Icons.sync,
                    label: 'Sync Status',
                    route: AppRoutes.syncStatus,
                  ),
                  _LinkTile(
                    icon: Icons.school_outlined,
                    label: 'Training',
                    route: AppRoutes.trainingList,
                  ),
                  _LinkTile(
                    icon: Icons.receipt_long_outlined,
                    label: 'Incentives',
                    route: AppRoutes.incentives,
                  ),
                  _LinkTile(
                    icon: Icons.health_and_safety_outlined,
                    label: 'ABHA',
                    route: AppRoutes.abhaStatus,
                  ),
                ],
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),

            // About
            ASHACard(
              title: 'About',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.info_outline,
                    color: ASHAColors.primary),
                title: Text('ASHA Sathi',
                    style: ASHATypography.labelLG),
                subtitle: Text(
                  'Version ${AppConfig.appVersion}\nOffline-first companion for Indian ASHA frontline health workers.',
                  style: ASHATypography.labelMD
                      .copyWith(color: ASHAColors.onSurfaceVariant),
                ),
              ),
            ),
            const SizedBox(height: ASHASpacing.stackXL),

            ASHAButton(
              label: 'Logout',
              icon: Icons.logout,
              variant: ASHAButtonVariant.primary,
              height: 48,
              onPressed: () => _confirmLogout(context, ref),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'AS';
    final first = parts.first[0];
    final second = parts.length > 1 ? parts[1][0] : '';
    return (first + second).toUpperCase();
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout?'),
        content: const Text(
            'You will stay logged in on this device. Data remains saved offline.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(authStateProvider).logout();
    if (context.mounted) context.goNamed(AppRoutes.login);
  }
}

class _LanguageTile extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);
    final code = locale?.languageCode ?? 'en';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.language, color: ASHAColors.primary),
      title: Text('Language', style: ASHATypography.labelLG),
      subtitle: Text(
        supportedLanguages.firstWhere(
          (l) => l.code == code,
          orElse: () => supportedLanguages.first,
        ).name,
        style: ASHATypography.labelMD
            .copyWith(color: ASHAColors.onSurfaceVariant),
      ),
      trailing: DropdownButton<String>(
        value: code,
        underline: const SizedBox.shrink(),
        items: [
          for (final l in supportedLanguages)
            DropdownMenuItem(value: l.code, child: Text(l.name)),
        ],
        onChanged: (value) {
          if (value != null) {
            ref.read(localeProvider.notifier).state = Locale(value);
          }
        },
      ),
    );
  }
}

class _ThemeTile extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.dark_mode_outlined, color: ASHAColors.primary),
      title: Text('Theme', style: ASHATypography.labelLG),
      subtitle: Text(
        switch (mode) {
          ThemeMode.light => 'Light',
          ThemeMode.dark => 'Dark',
          _ => 'System',
        },
        style: ASHATypography.labelMD
            .copyWith(color: ASHAColors.onSurfaceVariant),
      ),
      trailing: SegmentedButton<ThemeMode>(
        segments: const [
          ButtonSegment(
            value: ThemeMode.light,
            icon: Icon(Icons.light_mode_outlined),
          ),
          ButtonSegment(
            value: ThemeMode.dark,
            icon: Icon(Icons.dark_mode_outlined),
          ),
        ],
        selected: {mode},
        onSelectionChanged: (selection) {
          ref.read(themeModeProvider.notifier).state = selection.first;
        },
      ),
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({
    required this.icon,
    required this.label,
    required this.route,
  });

  final IconData icon;
  final String label;
  final String route;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: ASHAColors.primary),
      title: Text(label, style: ASHATypography.labelLG),
      trailing: const Icon(Icons.chevron_right, color: ASHAColors.outline),
      onTap: () => context.pushNamed(route),
    );
  }
}
