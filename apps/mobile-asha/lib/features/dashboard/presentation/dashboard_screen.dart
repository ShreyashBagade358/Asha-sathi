import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/dashboard_models.dart';

final _kpisProvider = FutureProvider<ASHAKpiModel>((ref) async {
  return ref.watch(dashboardRepositoryProvider).fetchKpis();
});

/// Home dashboard with a grid of KPI cards.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpis = ref.watch(_kpisProvider);
    final auth = ref.watch(authStateProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'ASHA Sathi',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Your daily summary. Tap cards for details.')),
        ),
      ),
      body: SafeArea(
        child: kpis.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (k) {
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                ASHACard(
                  title: 'Welcome',
                  subtitle:
                      '${auth.user?.name ?? 'ASHA Worker'} · ${auth.user?.villageId ?? 'Your village'}',
                  child: const Icon(Icons.favorite, color: ASHAColors.primary),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: ASHASpacing.stackSM,
                  crossAxisSpacing: ASHASpacing.stackSM,
                  children: [
                    _KpiCard(
                      label: 'PW Registered',
                      value: k.pregnantWomen,
                      icon: Icons.pregnant_woman,
                      color: ASHAColors.primary,
                      onTap: () => context.pushNamed(AppRoutes.pregnancy),
                    ),
                    _KpiCard(
                      label: 'ANC Done',
                      value: k.ancDone,
                      icon: Icons.medical_services_outlined,
                      color: ASHAColors.secondary,
                      onTap: () => context.pushNamed(AppRoutes.pregnancy),
                    ),
                    _KpiCard(
                      label: 'High-Risk',
                      value: k.hrp,
                      icon: Icons.warning_amber_outlined,
                      color: ASHAColors.error,
                      onTap: () => context.pushNamed(AppRoutes.hrpList),
                    ),
                    _KpiCard(
                      label: 'Immunized',
                      value: k.immunized,
                      icon: Icons.vaccines_outlined,
                      color: ASHAColors.tertiary,
                      onTap: () => context.pushNamed(AppRoutes.children),
                    ),
                    _KpiCard(
                      label: 'HBNC',
                      value: k.hbncDone,
                      icon: Icons.home_outlined,
                      color: ASHAColors.secondary,
                      onTap: () => context.pushNamed(AppRoutes.children),
                    ),
                    _KpiCard(
                      label: 'EC Couples',
                      value: k.eligibleCouples,
                      icon: Icons.family_restroom,
                      color: ASHAColors.primary,
                      onTap: () => context.pushNamed(AppRoutes.ecList),
                    ),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _KpiCard(
                  label: 'Incentives earned (₹)',
                  value: k.incentivesEarned,
                  icon: Icons.payments_outlined,
                  color: ASHAColors.primary,
                  onTap: () => context.pushNamed(AppRoutes.incentives),
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHAButton(
                  label: 'Open Work Plan (${k.dueTasks} tasks due)',
                  onPressed: () => context.pushNamed(AppRoutes.workPlan),
                  fullWidth: true,
                  height: 48,
                  icon: Icons.task_alt_outlined,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ASHACard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: ASHASpacing.stackSM),
          Text('$value', style: ASHATypography.headlineMD.copyWith(color: color)),
          const SizedBox(height: 4),
          Text(label, style: ASHATypography.labelMD),
        ],
      ),
    );
  }
}
