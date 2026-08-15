import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

/// Saved emergency contacts for the beneficiary.
class EmergencyContactsScreen extends StatelessWidget {
  const EmergencyContactsScreen({super.key});

  Future<void> _call(String number) async {
    final uri = Uri(scheme: 'tel', path: number);
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) {
      debugPrint('Could not launch phone dialer for $number');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Emergency Contacts',
        onBack: () => context.pop(),
      ),
      body: ListView(
        padding: const EdgeInsets.all(ASHASpacing.gutter),
        children: [
          ASHASectionHeader(title: 'Your care team'),
          const SizedBox(height: ASHASpacing.stackSM),
          _ContactTile(
            name: 'Sunita Devi',
            role: 'Your ASHA',
            village: 'Simri',
            phone: '+91 98123 45001',
            color: theme.colorScheme.primaryContainer,
            onCall: () => _call('+919812345001'),
          ),
          _ContactTile(
            name: 'Rekha Yadav',
            role: 'ANM (Sub-centre Simri)',
            village: 'Simri',
            phone: '+91 98123 45002',
            color: theme.colorScheme.primaryContainer,
            onCall: () => _call('+919812345002'),
          ),
          _ContactTile(
            name: 'Dr. Meera Nair',
            role: 'Medical Officer',
            village: 'PHC Bhagalpur-01',
            phone: '+91 93400 12345',
            color: theme.colorScheme.primaryContainer,
            onCall: () => _call('+919340012345'),
          ),
          const SizedBox(height: ASHASpacing.stackMD),
          ASHASectionHeader(title: 'Helplines'),
          const SizedBox(height: ASHASpacing.stackSM),
          _ContactTile(
            name: 'Ambulance',
            role: 'National Emergency',
            village: '24x7',
            phone: '108',
            color: theme.colorScheme.errorContainer,
            onCall: () => _call('108'),
          ),
          _ContactTile(
            name: 'Child Helpline',
            role: 'National',
            village: '24x7',
            phone: '1098',
            color: theme.colorScheme.errorContainer,
            onCall: () => _call('1098'),
          ),
          _ContactTile(
            name: 'Maternal Health Helpline',
            role: 'JSY / RCH Support',
            village: '24x7',
            phone: '104',
            color: theme.colorScheme.errorContainer,
            onCall: () => _call('104'),
          ),
        ],
      ),
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({
    required this.name,
    required this.role,
    required this.village,
    required this.phone,
    required this.color,
    required this.onCall,
  });

  final String name;
  final String role;
  final String village;
  final String phone;
  final Color color;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
      child: ASHACard(
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: color,
              child: Text(initials(name), style: ASHATypography.titleMedium),
            ),
            const SizedBox(width: ASHASpacing.stackMD),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: ASHATypography.titleMedium),
                  const SizedBox(height: 2),
                  Text(
                    '$role · $village',
                    style: ASHATypography.bodySmall.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    phone,
                    style: ASHATypography.bodyMD.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.call),
              tooltip: 'Call $name',
              onPressed: onCall,
            ),
          ],
        ),
      ),
    );
  }
}
