import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/beneficiary_model.dart';

final _beneficiaryDetailProvider =
    FutureProvider.family<BeneficiaryModel?, String>((ref, id) async {
  return ref.watch(beneficiaryRepositoryProvider).getById(id);
});

/// Profile screen with timeline / records / actions tabs.
class BeneficiaryDetailScreen extends ConsumerStatefulWidget {
  const BeneficiaryDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<BeneficiaryDetailScreen> createState() => _BeneficiaryDetailScreenState();
}

class _BeneficiaryDetailScreenState
    extends ConsumerState<BeneficiaryDetailScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(_beneficiaryDetailProvider(widget.id));
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Beneficiary',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (b) {
            if (b == null) return buildErrorScreen(ErrorScreenType.dataNotFound);
            final age = ageFromDob(tryParseDate(b.dob));
            return Column(
              children: [
                _ProfileHeader(beneficiary: b, age: age),
                DefaultTabController(
                  length: 3,
                  child: Column(
                    children: [
                      TabBar(
                        onTap: (i) => setState(() => _tab = i),
                        tabs: const [
                          Tab(text: 'Timeline'),
                          Tab(text: 'Records'),
                          Tab(text: 'Actions'),
                        ],
                      ),
                      SizedBox(
                        height: 420,
                        child: IndexedStack(
                          index: _tab,
                          children: [
                            _TimelineTab(beneficiaryId: b.beneficiaryId),
                            _RecordsTab(beneficiary: b),
                            _ActionsTab(beneficiary: b),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.beneficiary, required this.age});

  final BeneficiaryModel beneficiary;
  final Age age;

  @override
  Widget build(BuildContext context) {
    return ASHACard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 32,
            backgroundColor: ASHAColors.primaryContainer,
            child: Text(
              initials(beneficiary.fullName),
              style: ASHATypography.headlineMD.copyWith(color: ASHAColors.primary),
            ),
          ),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(beneficiary.fullName, style: ASHATypography.headlineMD),
                const SizedBox(height: 4),
                Text(
                  '${beneficiary.beneficiaryId} · ${age}',
                  style: ASHATypography.bodyMD.copyWith(
                    color: ASHAColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (beneficiary.isPregnant)
                      const StatusChip(
                          status: StatusChipType.warning, label: 'Pregnant'),
                    if (beneficiary.abhaId != null)
                      const SizedBox(width: 8),
                    if (beneficiary.abhaId != null)
                      const StatusChip(
                          status: StatusChipType.info, label: 'ABHA linked'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineTab extends StatelessWidget {
  const _TimelineTab({required this.beneficiaryId});

  final String beneficiaryId;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(ASHASpacing.marginMobile),
      children: [
        ASHACard(
          title: 'Registered',
          subtitle: 'Profile created for this beneficiary.',
          child: const Icon(Icons.person_add_alt_1, color: ASHAColors.primary),
        ),
      ],
    );
  }
}

class _RecordsTab extends StatelessWidget {
  const _RecordsTab({required this.beneficiary});

  final BeneficiaryModel beneficiary;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(ASHASpacing.marginMobile),
      children: [
        _InfoRow(label: 'Gender', value: capitalizeWords(beneficiary.gender)),
        _InfoRow(label: 'Date of birth', value: formatDate(tryParseDate(beneficiary.dob))),
        _InfoRow(label: 'Phone', value: beneficiary.phone ?? '—'),
        _InfoRow(label: 'Marital status', value: capitalizeWords(beneficiary.maritalStatus ?? '—')),
        _InfoRow(label: 'Blood group', value: beneficiary.bloodGroup ?? '—'),
        _InfoRow(label: 'ABHA ID', value: beneficiary.abhaId ?? '—'),
        _InfoRow(label: 'Household', value: beneficiary.householdId ?? '—'),
        _InfoRow(label: 'Village', value: beneficiary.villageId ?? '—'),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: ASHATypography.bodyMD.copyWith(color: ASHAColors.onSurfaceVariant),
            ),
          ),
          Text(value, style: ASHATypography.bodyMD),
        ],
      ),
    );
  }
}

class _ActionsTab extends StatelessWidget {
  const _ActionsTab({required this.beneficiary});

  final BeneficiaryModel beneficiary;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(ASHASpacing.marginMobile),
      children: [
        ASHAButton(
          label: 'Start Pregnancy / ANC',
          onPressed: () => context.pushNamed(
            AppRoutes.pregnancyRegister,
            extra: beneficiary.beneficiaryId,
          ),
          fullWidth: true,
          height: ASHASpacing.touchTargetMin,
          icon: Icons.pregnant_woman,
        ),
        const SizedBox(height: ASHASpacing.stackSM),
        ASHAButton(
          label: 'CBAC Screening (NCD)',
          onPressed: () => context.pushNamed(AppRoutes.cbacScreening),
          variant: ASHAButtonVariant.outline,
          fullWidth: true,
          height: ASHASpacing.touchTargetMin,
          icon: Icons.favorite_border,
        ),
        const SizedBox(height: ASHASpacing.stackSM),
        ASHAButton(
          label: 'Link ABHA',
          onPressed: () => context.pushNamed(AppRoutes.abhaLink),
          variant: ASHAButtonVariant.outline,
          fullWidth: true,
          height: ASHASpacing.touchTargetMin,
          icon: Icons.health_and_safety_outlined,
        ),
        const SizedBox(height: ASHASpacing.stackSM),
        ASHAButton(
          label: 'Record Referral',
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Referral form coming soon')),
            );
          },
          variant: ASHAButtonVariant.secondary,
          fullWidth: true,
          height: ASHASpacing.touchTargetMin,
          icon: Icons.send_outlined,
        ),
      ],
    );
  }
}
