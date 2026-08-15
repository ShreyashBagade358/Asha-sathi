import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_repository.dart';
import '../core/config/app_config.dart';

/// "More" tab: links to management modules + logout.
class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final user = auth is AuthAuthenticated ? auth.user : null;

    return Scaffold(
      appBar: ASHATopAppBar(title: 'More'),
      body: ListView(
        padding: const EdgeInsets.all(ASHASpacing.gutter),
        children: [
          ASHACard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                      child: Text(
                        initials(user?.name ?? 'PHC'),
                        style: ASHATypography.headlineMD,
                      ),
                    ),
                    const SizedBox(width: ASHASpacing.stackMD),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user?.name ?? 'PHC Admin', style: ASHATypography.titleMedium),
                          Text(
                            user?.facilityName ?? AppConfig.defaultFacilityName,
                            style: ASHATypography.bodySmall.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                const Divider(),
                const SizedBox(height: ASHASpacing.stackSM),
                Text(
                  'ASHA Sathi PHC Admin v${AppConfig.appVersion}',
                  style: ASHATypography.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: ASHASpacing.stackMD),
          _MenuTile(
            icon: Icons.apartment_outlined,
            title: 'Facilities',
            subtitle: 'PHCs, sub-centres & villages',
            onTap: () => context.push('/facility'),
          ),
          _MenuTile(
            icon: Icons.badge_outlined,
            title: 'Staff Management',
            subtitle: 'ASHAs, ANMs & supervisors',
            onTap: () => context.push('/staff'),
          ),
          _MenuTile(
            icon: Icons.verified_outlined,
            title: 'Beneficiary Review',
            subtitle: 'Approve entries synced from ASHAs',
            onTap: () => context.push('/verification'),
          ),
          _MenuTile(
            icon: Icons.insert_chart_outlined,
            title: 'Reports',
            subtitle: 'Monthly KPIs & exports',
            onTap: () => context.push('/reports'),
          ),
          const SizedBox(height: ASHASpacing.stackMD),
          ASHAButton(
            label: 'Logout',
            icon: Icons.logout,
            variant: ASHAButtonVariant.danger,
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).signOut();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
      child: ASHACard(
        onTap: onTap,
        padding: const EdgeInsets.all(ASHASpacing.stackMD),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
              ),
              child: Icon(icon, color: theme.colorScheme.primary),
            ),
            const SizedBox(width: ASHASpacing.stackMD),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: ASHATypography.titleMedium),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: ASHATypography.bodySmall.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}
