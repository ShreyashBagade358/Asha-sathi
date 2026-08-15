import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'abha_card_widget.dart';
import 'patient_profile_model.dart';
import 'profile_repository.dart';

/// View the ABHA card and personal health profile.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  PatientProfileModel? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile = await ref.read(profileRepositoryProvider).fetchProfile();
    if (mounted) setState(() {
      _profile = profile;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;

    return Scaffold(
      appBar: ASHATopAppBar(title: 'My Profile', onBack: () => context.pop()),
      body: _loading || profile == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ABHACardWidget(profile: profile),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHASectionHeader(title: 'Personal details'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    children: [
                      _InfoRow(icon: Icons.badge_outlined, label: 'Name', value: profile.name),
                      _InfoRow(icon: Icons.phone_android, label: 'Phone', value: profile.phone),
                      _InfoRow(icon: Icons.cake_outlined, label: 'Date of birth', value: profile.dob.isEmpty ? '—' : _formatDob(profile.dob)),
                      _InfoRow(icon: Icons.person_outline, label: 'Gender', value: profile.gender.isEmpty ? '—' : profile.gender),
                      _InfoRow(icon: Icons.family_restroom_outlined, label: 'Marital status', value: profile.maritalStatus.isEmpty ? '—' : profile.maritalStatus),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Location & ASHA'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    children: [
                      _InfoRow(icon: Icons.village_outlined, label: 'Village', value: profile.village.isEmpty ? '—' : profile.village),
                      _InfoRow(icon: Icons.map_outlined, label: 'District', value: profile.district.isEmpty ? '—' : profile.district),
                      _InfoRow(icon: Icons.health_and_safety_outlined, label: 'ASHA', value: profile.ashaName.isEmpty ? '—' : '${profile.ashaName} (${profile.ashaPhone})'),
                      _InfoRow(icon: Icons.medical_services_outlined, label: 'ANM', value: profile.anmName.isEmpty ? '—' : '${profile.anmName} (${profile.anmPhone})'),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Health info'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    children: [
                      _InfoRow(icon: Icons.bloodtype_outlined, label: 'Blood group', value: profile.bloodGroup.isEmpty ? '—' : profile.bloodGroup),
                      _InfoRow(icon: Icons.warning_amber_outlined, label: 'High-risk pregnancy', value: profile.highRiskPregnancy ? 'Yes - under PHC care' : 'No'),
                      _InfoRow(icon: Icons.allergy_outlined, label: 'Allergies', value: profile.allergies.isEmpty ? 'None reported' : profile.allergies.join(', ')),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'Update profile',
                  icon: Icons.edit_outlined,
                  variant: ASHAButtonVariant.outline,
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Profile editing coming soon')),
                    );
                  },
                ),
              ],
            ),
    );
  }

  String _formatDob(String iso) {
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(iso));
    } catch (_) {
      return iso;
    }
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Text(label, style: ASHATypography.bodySmall.copyWith(
                color: theme.colorScheme.onSurfaceVariant)),
          ),
          Expanded(
            child: Text(value, style: ASHATypography.bodyMD, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}
