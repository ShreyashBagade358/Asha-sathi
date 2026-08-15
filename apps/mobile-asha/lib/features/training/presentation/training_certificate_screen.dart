import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';

/// Certificate awarded after passing a training quiz.
class TrainingCertificateScreen extends StatelessWidget {
  const TrainingCertificateScreen({super.key, required this.trainingId});

  final String trainingId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Certificate',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            ASHACard(
              title: 'Certificate of Completion',
              subtitle: 'Module $trainingId',
              child: Column(
                children: [
                  const SizedBox(height: ASHASpacing.stackSM),
                  const Icon(Icons.military_tech,
                      size: 96, color: ASHAColors.primary),
                  const SizedBox(height: ASHASpacing.stackMD),
                  Text('This certifies that', style: ASHATypography.bodyMD),
                  const SizedBox(height: 4),
                  Text(
                    'ASHASathi Worker',
                    style: ASHATypography.headlineMD.copyWith(
                      color: ASHAColors.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('has completed the module and passed the assessment',
                      style: ASHATypography.bodyMD),
                  const SizedBox(height: ASHASpacing.stackMD),
                  Text(
                    'Awarded ${DateTime.now().day} ${_monthName(DateTime.now().month)} ${DateTime.now().year}',
                    style: ASHATypography.labelMD.copyWith(
                      color: ASHAColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: 'Share Certificate',
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Sharing available once PDF export is enabled')),
                );
              },
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.share_outlined,
            ),
            const SizedBox(height: ASHASpacing.stackSM),
            ASHAButton(
              label: 'Back to Training',
              onPressed: () => context.pushReplacementNamed(AppRoutes.trainingList),
              variant: ASHAButtonVariant.outline,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
            ),
          ],
        ),
      ),
    );
  }

  String _monthName(int m) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[m - 1];
  }
}
