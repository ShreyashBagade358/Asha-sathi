import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_repository.dart';
import '../core/config/app_config.dart';

/// "More" tab: profile, tools and logout.
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
                        initials(user?.name ?? 'S'),
                        style: ASHATypography.headlineMD,
                      ),
                    ),
                    const SizedBox(width: ASHASpacing.stackMD),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user?.name ?? 'Beneficiary', style: ASHATypography.titleMedium),
                          Text(
                            user?.abhaNumber ?? AppConfig.defaultAbhaNumber,
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
                  'ASHA Sathi Patient v${AppConfig.appVersion}',
                  style: ASHATypography.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: ASHASpacing.stackMD),
          _MenuTile(
            icon: Icons.health_and_safety_outlined,
            title: 'My Profile & ABHA',
            subtitle: 'View and update personal details',
            onTap: () => context.push('/profile'),
          ),
          _MenuTile(
            icon: Icons.folder_shared_outlined,
            title: 'Health Records',
            subtitle: 'ANC, growth, immunizations & more',
            onTap: () => context.push('/records'),
          ),
          _MenuTile(
            icon: Icons.event_note_outlined,
            title: 'Appointments',
            subtitle: 'Upcoming and past visits',
            onTap: () => context.push('/appointments'),
          ),
          _MenuTile(
            icon: Icons.alarm_outlined,
            title: 'Reminders',
            subtitle: 'Medication, visits & vaccinations',
            onTap: () => context.push('/reminders'),
          ),
          _MenuTile(
            icon: Icons.volunteer_activism_outlined,
            title: 'Government Schemes',
            subtitle: 'Benefits you may be eligible for',
            onTap: () => context.push('/schemes'),
          ),
          _MenuTile(
            icon: Icons.report_problem_outlined,
            title: 'Grievances',
            subtitle: 'Raise or track a complaint',
            onTap: () => context.push('/grievance'),
          ),
          _MenuTile(
            icon: Icons.contact_emergency_outlined,
            title: 'Emergency Contacts',
            subtitle: 'ASHA, ANM & helplines',
            onTap: () => context.push('/emergency/contacts'),
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
