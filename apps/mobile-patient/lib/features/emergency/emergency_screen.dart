import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';

/// Emergency screen: SOS actions and immediate helplines.
class EmergencyScreen extends StatelessWidget {
  const EmergencyScreen({super.key});

  Future<void> _call(String number) async {
    final uri = Uri(scheme: 'tel', path: number);
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) {
      debugPrint('Could not launch phone dialer for $number');
    }
  }

  Future<void> _sendSos() async {
    final uri = Uri(
      scheme: 'sms',
      path: AppConfig.emergencyHelpline,
      queryParameters: {'body': 'SOS - I need urgent medical assistance.'},
    );
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) {
      debugPrint('Could not launch SMS composer.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: ASHATopAppBar(title: 'Emergency', onBack: () => context.pop()),
      body: ListView(
        padding: const EdgeInsets.all(ASHASpacing.gutter),
        children: [
          Container(
            padding: const EdgeInsets.all(ASHASpacing.stackLG),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  theme.colorScheme.error,
                  theme.colorScheme.error.withValues(alpha: 0.85),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusXl),
            ),
            child: Column(
              children: [
                const Icon(Icons.emergency, color: Colors.white, size: 56),
                const SizedBox(height: ASHASpacing.stackMD),
                const Text(
                  'SOS - Medical Emergency',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                Text(
                  'Send an SOS alert to your ASHA and nearest PHC.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                SizedBox(
                  width: double.infinity,
                  height: 64,
                  child: ElevatedButton.icon(
                    onPressed: _sendSos,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: theme.colorScheme.error,
                      shape: StadiumBorder(
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.6),
                          width: 2,
                        ),
                      ),
                    ),
                    icon: const Icon(Icons.warning_amber_rounded),
                    label: const Text(
                      'Send SOS',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: ASHASpacing.stackLG),
          ASHASectionHeader(title: 'Call now'),
          const SizedBox(height: ASHASpacing.stackSM),
          _CallTile(
            icon: Icons.ambulance_outlined,
            title: 'Ambulance',
            subtitle: AppConfig.emergencyHelpline,
            onTap: () => _call(AppConfig.emergencyHelpline),
          ),
          _CallTile(
            icon: Icons.local_hospital_outlined,
            title: 'PHC Bhagalpur-01',
            subtitle: '+91 93400 12345',
            onTap: () => _call('+919340012345'),
          ),
          _CallTile(
            icon: Icons.medical_services_outlined,
            title: 'CHC Block Health',
            subtitle: '+91 93400 67890',
            onTap: () => _call('+919340067890'),
          ),
          const SizedBox(height: ASHASpacing.stackMD),
          ASHASectionHeader(title: 'More help'),
          const SizedBox(height: ASHASpacing.stackSM),
          ASHAButton(
            label: 'Emergency contacts',
            icon: Icons.contact_emergency_outlined,
            variant: ASHAButtonVariant.outline,
            onPressed: () => context.push('/emergency/contacts'),
          ),
        ],
      ),
    );
  }
}

class _CallTile extends StatelessWidget {
  const _CallTile({
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
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: theme.colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
              ),
              child: Icon(icon, color: theme.colorScheme.error),
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
            const Icon(Icons.call, color: theme.colorScheme.error),
          ],
        ),
      ),
    );
  }
}
