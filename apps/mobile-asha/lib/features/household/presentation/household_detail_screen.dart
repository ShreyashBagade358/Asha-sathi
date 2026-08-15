import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/household_model.dart';

final _householdDetailProvider =
    FutureProvider.family<HouseholdModel?, String>((ref, id) async {
  return ref.watch(householdRepositoryProvider).getById(id);
});

class HouseholdDetailScreen extends ConsumerWidget {
  const HouseholdDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_householdDetailProvider(id));
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Household',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (model) {
            if (model == null) return buildErrorScreen(ErrorScreenType.dataNotFound);
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                ASHACard(
                  title: model.hhid,
                  subtitle: '${model.villageId} · ${model.summaryAddress}',
                  child: Row(
                    children: [
                      if (model.consentGiven)
                        const StatusChip(
                            status: StatusChipType.success, label: 'Consent given')
                      else
                        const StatusChip(
                            status: StatusChipType.warning, label: 'No consent'),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                Text('Amenities', style: ASHATypography.headlineMD),
                const SizedBox(height: ASHASpacing.stackSM),
                if (model.amenities.isEmpty)
                  Text('None recorded', style: ASHATypography.bodyMD)
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: model.amenities
                        .map((a) => StatusChip(status: StatusChipType.neutral, label: a))
                        .toList(),
                  ),
                const SizedBox(height: ASHASpacing.stackLG),
                Text('Members', style: ASHATypography.headlineMD),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  title: 'No members linked yet',
                  subtitle: 'Register beneficiaries to link them to this household.',
                  child: const SizedBox.shrink(),
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'Register Beneficiary',
                  onPressed: () => context.pushNamed(
                    AppRoutes.beneficiaryNew,
                    extra: model.hhid,
                  ),
                  fullWidth: true,
                  height: ASHASpacing.touchTargetMin,
                  icon: Icons.person_add_alt_1,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
