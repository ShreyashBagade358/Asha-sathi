import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'grievance_model.dart';
import 'grievance_repository.dart';

/// Tracking view of one grievance with a progress timeline.
class GrievanceStatusScreen extends ConsumerStatefulWidget {
  const GrievanceStatusScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<GrievanceStatusScreen> createState() => _GrievanceStatusScreenState();
}

class _GrievanceStatusScreenState extends ConsumerState<GrievanceStatusScreen> {
  GrievanceModel? _grievance;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final grievance =
        await ref.read(grievanceRepositoryProvider).fetchById(widget.id);
    if (mounted) setState(() {
      _grievance = grievance;
      _loading = false;
    });
  }

  int get _stageIndex {
    switch (_grievance?.status) {
      case 'submitted':
        return 0;
      case 'under_review':
        return 1;
      case 'in_progress':
        return 2;
      case 'resolved':
        return 3;
      default:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final grievance = _grievance;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Grievance Status',
        onBack: () => context.pop(),
      ),
      body: _loading || grievance == null
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
                          Expanded(
                            child: Text(
                              grievance.title,
                              style: ASHATypography.titleLarge,
                            ),
                          ),
                          StatusChip(
                            status: statusChipTypeFrom(grievance.status),
                            label: grievance.statusLabel,
                          ),
                        ],
                      ),
                      const SizedBox(height: ASHASpacing.stackSM),
                      Text(
                        'Reference: ${grievance.referenceNumber}',
                        style: ASHATypography.bodySmall.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: ASHASpacing.stackSM),
                      Text(grievance.description, style: ASHATypography.bodyMD),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Progress'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: _Timeline(
                    currentStage: _stageIndex,
                    stages: const [
                      'Submitted',
                      'Under review',
                      'In progress',
                      'Resolved',
                    ],
                  ),
                ),
                if (grievance.response.isNotEmpty) ...[
                  const SizedBox(height: ASHASpacing.stackMD),
                  ASHASectionHeader(title: 'Response'),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHACard(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.message_outlined,
                            color: theme.colorScheme.primary),
                        const SizedBox(width: ASHASpacing.stackMD),
                        Expanded(
                          child: Text(grievance.response,
                              style: ASHATypography.bodyMD),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'Refresh status',
                  icon: Icons.refresh,
                  variant: ASHAButtonVariant.outline,
                  onPressed: _loading ? null : _load,
                ),
              ],
            ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.currentStage, required this.stages});

  final int currentStage;
  final List<String> stages;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        for (var i = 0; i < stages.length; i++)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 28,
                child: Column(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i <= currentStage
                            ? theme.colorScheme.primary
                            : theme.colorScheme.surfaceContainerHighest,
                      ),
                      child: i <= currentStage
                          ? Icon(Icons.check,
                              size: 14, color: theme.colorScheme.onPrimary)
                          : null,
                    ),
                    if (i < stages.length - 1)
                      Container(
                        width: 2,
                        height: 28,
                        color: i < currentStage
                            ? theme.colorScheme.primary
                            : theme.colorScheme.surfaceContainerHighest,
                      ),
                  ],
                ),
              ),
              const SizedBox(width: ASHASpacing.stackMD),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  stages[i],
                  style: ASHATypography.bodyMD.copyWith(
                    color: i <= currentStage
                        ? theme.colorScheme.onSurface
                        : theme.colorScheme.onSurfaceVariant,
                    fontWeight:
                        i == currentStage ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ),
            ],
          ),
      ],
    );
  }
}
