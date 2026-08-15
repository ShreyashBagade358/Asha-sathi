import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../data/training_module_model.dart';
import 'training_list_screen.dart';

/// Training detail: video player placeholder + a short quiz.
class TrainingDetailScreen extends ConsumerStatefulWidget {
  const TrainingDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<TrainingDetailScreen> createState() => _TrainingDetailScreenState();
}

class _TrainingDetailScreenState extends ConsumerState<TrainingDetailScreen> {
  static const _quiz = [
    ('Which visit checks the newborn on day 7?', ['HBNC', 'PNC', 'ANC'], 0),
    ('Full ANC for a low-risk pregnancy needs at least how many visits?', ['2', '4', '6'], 1),
  ];

  final _answers = <int?>[];
  bool _submitted = false;

  @override
  Widget build(BuildContext context) {
    final module = ref.watch(trainingCatalogProvider)
        .valueOrNull
        ?.where((m) => m.trainingId == widget.id)
        .firstOrNull;
    return Scaffold(
      appBar: ASHATopAppBar(
        title: module?.title ?? 'Training',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            // Video player placeholder
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(
                decoration: BoxDecoration(
                  color: ASHAColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.play_circle_outline,
                        size: 72, color: ASHAColors.primary),
                    const SizedBox(height: ASHASpacing.stackSM),
                    Text('Video player',
                        style: ASHATypography.bodyMD.copyWith(
                          color: ASHAColors.onSurfaceVariant,
                        )),
                  ],
                ),
              ),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            Text(module?.description ?? '', style: ASHATypography.bodyMD),
            const SizedBox(height: ASHASpacing.stackLG),
            Text('Quiz', style: ASHATypography.headlineMD),
            const SizedBox(height: ASHASpacing.stackSM),
            ..._quiz.asMap().entries.map((e) {
              final idx = e.key;
              final (q, options, correct) = e.value;
              final selected = idx < _answers.length ? _answers[idx] : null;
              return ASHACard(
                title: 'Q${idx + 1}. $q',
                child: Column(
                  children: options.asMap().entries.map((o) {
                    final optionIdx = o.key;
                    final isSelected = selected == optionIdx;
                    return RadioListTile<int>(
                      value: optionIdx,
                      groupValue: selected,
                      onChanged: _submitted
                          ? null
                          : (v) {
                              setState(() {
                                while (_answers.length <= idx) {
                                  _answers.add(null);
                                }
                                _answers[idx] = v;
                              });
                            },
                      title: Text(o.value),
                      activeColor: ASHAColors.primary,
                    );
                  }).toList(),
                ),
              );
            }),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHAButton(
              label: _submitted ? 'Submit again' : 'Submit Quiz',
              onPressed: () {
                setState(() {
                  _submitted = true;
                });
                final score = _quiz.asMap().entries.where((e) {
                  final idx = e.key;
                  final correct = e.value.$3;
                  return idx < _answers.length && _answers[idx] == correct;
                }).length;
                final passed = score == _quiz.length;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      passed
                          ? 'Quiz passed! Certificate available.'
                          : 'Score $score/${_quiz.length}. Review and try again.',
                    ),
                  ),
                );
                if (passed) {
                  context.pushNamed(
                    AppRoutes.trainingCertificate,
                    pathParameters: {'id': widget.id},
                  );
                }
              },
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.quiz_outlined,
            ),
          ],
        ),
      ),
    );
  }
}
