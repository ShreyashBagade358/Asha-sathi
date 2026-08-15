import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/abha_record_model.dart';

final _abhaProvider = FutureProvider<List<ABHARecordModel>>((ref) async {
  return ref.watch(abhaRepositoryProvider).fetchAll();
});

class ABHAStatusScreen extends ConsumerWidget {
  const ABHAStatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(_abhaProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'ABHA Status',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: records.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            final linked = list.where((r) => r.status == 'linked').length;
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                ASHACard(
                  title: '$linked of ${list.length} linked',
                  subtitle: 'Beneficiaries with ABHA Health ID',
                  child: const Icon(Icons.verified_user_outlined,
                      color: ASHAColors.primary),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                if (list.isEmpty)
                  const ASHACard(
                    title: 'No ABHA records',
                    subtitle: 'Link the first Health ID to get started.',
                    child: SizedBox.shrink(),
                  )
                else
                  ...list.map((r) => Padding(
                        padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                        child: ASHACard(
                          title: r.abhaNumber ?? r.healthId ?? r.abhaId,
                          subtitle: '${r.linkingMethod} · ${r.beneficiaryId ?? '—'}',
                          child: Row(
                            children: [
                              StatusChip(
                                status: r.status == 'linked'
                                    ? StatusChipType.success
                                    : StatusChipType.warning,
                                label: r.status,
                              ),
                              const Spacer(),
                              if (r.status == 'linked' && !r.consentGranted)
                                ASHAButton(
                                  label: 'Consent',
                                  variant: ASHAButtonVariant.outline,
                                  height: 36,
                                  onPressed: () => context.pushNamed(
                                    AppRoutes.abhaConsent,
                                    extra: r,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      )),
              ],
            );
          },
        ),
      ),
    );
  }
}
