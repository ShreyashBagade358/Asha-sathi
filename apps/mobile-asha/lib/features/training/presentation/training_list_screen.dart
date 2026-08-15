import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../data/training_module_model.dart';

/// Static module catalogue (video cards). A real backend can hydrate this via
/// the API when available.
final trainingCatalogProvider = FutureProvider<List<TrainingModule>>((ref) async {
  return const [
    TrainingModule(
      trainingId: 'T-001',
      title: 'ANC & Danger Signs',
      description: 'Complete antenatal care, danger signs and when to refer.',
      durationMinutes: 12,
      thumbnailUrl: '',
    ),
    TrainingModule(
      trainingId: 'T-002',
      title: 'HBNC Visit Protocol',
      description: 'Home-based newborn care at day 3, 7, 14, 21 and 28.',
      durationMinutes: 10,
      thumbnailUrl: '',
    ),
    TrainingModule(
      trainingId: 'T-003',
      title: 'Immunization Schedule',
      description: 'National immunization schedule and cold chain basics.',
      durationMinutes: 15,
      thumbnailUrl: '',
    ),
    TrainingModule(
      trainingId: 'T-004',
      title: 'NCD Screening (CBAC)',
      description: 'Community based assessment checklist for NCDs.',
      durationMinutes: 8,
      thumbnailUrl: '',
    ),
    TrainingModule(
      trainingId: 'T-005',
      title: 'Family Planning Counselling',
      description: 'Contraceptive options and counselling for eligible couples.',
      durationMinutes: 9,
      thumbnailUrl: '',
    ),
  ];
});

class TrainingListScreen extends ConsumerWidget {
  const TrainingListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final modules = ref.watch(trainingCatalogProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Training',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Short video modules to refresh your skills.')),
        ),
      ),
      body: SafeArea(
        child: modules.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            return ListView.builder(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              itemCount: list.length,
              itemBuilder: (context, i) {
                final m = list[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                  child: ASHACard(
                    onTap: () => context.pushNamed(
                      AppRoutes.trainingDetail,
                      pathParameters: {'id': m.trainingId},
                    ),
                    title: m.title,
                    subtitle: '${m.durationMinutes} min · ${m.description}',
                    child: Row(
                      children: [
                        Container(
                          width: 64,
                          height: 40,
                          decoration: BoxDecoration(
                            color: ASHAColors.primaryContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.play_arrow,
                              color: ASHAColors.primary),
                        ),
                        const Spacer(),
                        if (m.completionStatus == 'completed')
                          const StatusChip(
                              status: StatusChipType.success, label: 'Done'),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
