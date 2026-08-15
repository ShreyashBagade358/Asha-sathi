import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/incentive_models.dart';

final _claimsProvider = FutureProvider<List<IncentiveClaimModel>>((ref) async {
  return ref.watch(incentiveRepositoryProvider).fetchClaims();
});

/// Monthly incentive claims with status tracking.
class IncentiveListScreen extends ConsumerStatefulWidget {
  const IncentiveListScreen({super.key});

  @override
  ConsumerState<IncentiveListScreen> createState() => _IncentiveListScreenState();
}

class _IncentiveListScreenState extends ConsumerState<IncentiveListScreen> {
  @override
  Widget build(BuildContext context) {
    final claims = ref.watch(_claimsProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Incentives',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Incentives are generated automatically from your recorded activities.')),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.incentiveClaim),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.currency_rupee),
      ),
      body: SafeArea(
        child: claims.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            double total = 0;
            for (final c in list) {
              if (c.status == 'approved') total += c.amount ?? 0;
            }
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                ASHACard(
                  title: 'Approved this cycle',
                  subtitle: 'Total ₹${total.toStringAsFixed(0)}',
                  child: const Icon(Icons.payments_outlined, color: ASHAColors.primary),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                if (list.isEmpty)
                  const ASHACard(
                    title: 'No claims yet',
                    subtitle: 'Generate claims from your activities.',
                    child: SizedBox.shrink(),
                  )
                else
                  ...list.map((c) {
                    final statusChip = switch (c.status) {
                      'approved' => const StatusChip(
                          status: StatusChipType.success, label: 'Approved'),
                      'rejected' => const StatusChip(
                          status: StatusChipType.danger, label: 'Rejected'),
                      'submitted' => const StatusChip(
                          status: StatusChipType.info, label: 'Submitted'),
                      _ => const StatusChip(
                          status: StatusChipType.warning, label: 'Draft'),
                    };
                    return Padding(
                      padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                      child: ASHACard(
                        title: c.activityName,
                        subtitle: '${c.month ?? '—'} · qty ${c.quantity ?? 0}',
                        child: Row(
                          children: [
                            Text(
                              '₹${(c.amount ?? 0).toStringAsFixed(0)}',
                              style: ASHATypography.headlineMD.copyWith(
                                color: ASHAColors.primary,
                              ),
                            ),
                            const Spacer(),
                            statusChip,
                          ],
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHAButton(
                  label: 'Village Forms (VHND etc.)',
                  onPressed: () => context.pushNamed(AppRoutes.villageForms),
                  variant: ASHAButtonVariant.outline,
                  fullWidth: true,
                  height: 48,
                  icon: Icons.description_outlined,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
