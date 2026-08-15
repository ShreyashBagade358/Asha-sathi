import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'scheme_model.dart';
import 'schemes_repository.dart';

/// Details, eligibility and application status of one scheme.
class SchemeDetailScreen extends ConsumerStatefulWidget {
  const SchemeDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<SchemeDetailScreen> createState() => _SchemeDetailScreenState();
}

class _SchemeDetailScreenState extends ConsumerState<SchemeDetailScreen> {
  SchemeModel? _scheme;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final scheme = await ref.read(schemesRepositoryProvider).fetchById(widget.id);
    if (mounted) setState(() {
      _scheme = scheme;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = _scheme;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Scheme',
        onBack: () => context.pop(),
      ),
      body: _loading || scheme == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ASHACard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          StatusChip(
                            status: scheme.eligible
                                ? StatusChipType.success
                                : StatusChipType.neutral,
                            label: scheme.eligible ? 'You are eligible' : 'Not eligible',
                          ),
                          const SizedBox(width: ASHASpacing.stackSM),
                          StatusChip(
                            status: statusChipTypeFrom(scheme.status),
                            label: scheme.status,
                          ),
                        ],
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      Text(scheme.name, style: ASHATypography.titleLarge),
                      const SizedBox(height: 4),
                      Text(
                        scheme.department,
                        style: ASHATypography.bodySmall.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      Text(scheme.description, style: ASHATypography.bodyMD),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _SectionCard(
                  title: 'Benefits',
                  icon: Icons.card_giftcard_outlined,
                  content: scheme.benefits,
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _SectionCard(
                  title: 'Eligibility',
                  icon: Icons.verified_outlined,
                  content: scheme.eligibility,
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _SectionCard(
                  title: 'Documents required',
                  icon: Icons.folder_copy_outlined,
                  content: scheme.documents,
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _SectionCard(
                  title: 'Application status',
                  icon: Icons.assignment_outlined,
                  content: switch (scheme.appliedStatus) {
                    'applied' => 'You have already applied. Your application is under process.',
                    'not_applied' => 'Not applied yet. Contact your ASHA to apply for this scheme.',
                    'not_eligible' => 'You currently do not meet the eligibility criteria.',
                    _ => 'Status unknown.',
                  },
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                if (scheme.eligible)
                  ASHAButton(
                    label: scheme.appliedStatus == 'applied'
                        ? 'Track application'
                        : 'Apply for this scheme',
                    icon: scheme.appliedStatus == 'applied'
                        ? Icons.track_changes_outlined
                        : Icons.send_outlined,
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            scheme.appliedStatus == 'applied'
                                ? 'Application is with the department'
                                : 'Application sent to ASHA for assistance',
                          ),
                        ),
                      );
                    },
                  ),
              ],
            ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.content,
  });

  final String title;
  final IconData icon;
  final String content;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ASHACard(
      title: title,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: theme.colorScheme.primary),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(child: Text(content, style: ASHATypography.bodyMD)),
        ],
      ),
    );
  }
}
