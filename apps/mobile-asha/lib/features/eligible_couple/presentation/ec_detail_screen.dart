import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/ec_models.dart';

final _ecDetailProvider =
    FutureProvider.family<EligibleCoupleModel?, String>((ref, id) async {
  return ref.watch(eligibleCoupleRepositoryProvider).getById(id);
});

class ECDetailScreen extends ConsumerStatefulWidget {
  const ECDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<ECDetailScreen> createState() => _ECDetailScreenState();
}

class _ECDetailScreenState extends ConsumerState<ECDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(_ecDetailProvider(widget.id));
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Eligible Couple',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (c) {
            if (c == null) return buildErrorScreen(ErrorScreenType.dataNotFound);
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                ASHACard(
                  title: '${c.husbandName} & ${c.wifeName}',
                  subtitle: '${c.ecId} · ${c.address ?? 'No address'}',
                  child: Row(
                    children: [
                      if (c.needsFamilyPlanning)
                        const StatusChip(
                            status: StatusChipType.info, label: 'Needs FP counselling')
                      else
                        StatusChip(
                          status: StatusChipType.success,
                          label: c.contraceptiveMethod ?? 'No method',
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _Row('Wife beneficiary', c.wifeBeneficiaryId ?? '—'),
                _Row('Wife age', '${c.age ?? 0} years'),
                _Row('Children', '${c.childrenCount ?? 0}'),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'New Follow-up Visit',
                  onPressed: () => context.pushNamed(
                    AppRoutes.ecFollowup,
                    pathParameters: {'id': c.ecId},
                  ),
                  fullWidth: true,
                  height: ASHASpacing.touchTargetMin,
                  icon: Icons.favorite_outline,
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                Text('Follow-up history', style: ASHATypography.headlineMD),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  title: 'No follow-ups yet',
                  subtitle: 'Counsel the couple on their next visit.',
                  child: const SizedBox.shrink(),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);

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
