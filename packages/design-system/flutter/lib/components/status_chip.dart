import 'package:flutter/material.dart';

import '../theme/asha_spacing.dart';
import '../theme/asha_typography.dart';

enum StatusChipType { success, danger, warning, neutral, info }

/// Maps a raw string (risk level, state, priority, sync status...) to a
/// [StatusChipType]. Unknown / null values degrade to neutral.
StatusChipType statusChipTypeFrom(String? value) {
  if (value == null) return StatusChipType.neutral;
  switch (value.toLowerCase()) {
    case 'low':
    case 'normal':
    case 'healthy':
    case 'approved':
    case 'verified':
    case 'active':
    case 'complete':
    case 'completed':
    case 'delivered':
    case 'success':
    case 'synced':
    case 'paid':
      return StatusChipType.success;
    case 'medium':
    case 'mam':
    case 'pending':
    case 'review':
    case 'in_progress':
    case 'in progress':
    case 'scheduled':
    case 'warning':
    case 'escalated':
    case 'syncing':
      return StatusChipType.warning;
    case 'high':
    case 'sam':
    case 'danger':
    case 'critical':
    case 'rejected':
    case 'overdue':
    case 'stockout':
    case 'outbreak':
    case 'hrp':
    case 'failed':
    case 'sync_failed':
      return StatusChipType.danger;
    case 'info':
    case 'new':
    case 'note':
      return StatusChipType.info;
    default:
      return StatusChipType.neutral;
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.status,
    required this.label,
    this.compact = false,
  });

  final StatusChipType status;
  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final Color background;
    final Color foreground;
    switch (status) {
      case StatusChipType.success:
        background = theme.colorScheme.tertiaryContainer;
        foreground = theme.colorScheme.onTertiaryContainer;
      case StatusChipType.danger:
        background = theme.colorScheme.errorContainer;
        foreground = theme.colorScheme.onErrorContainer;
      case StatusChipType.warning:
        background = theme.colorScheme.secondaryContainer;
        foreground = theme.colorScheme.onSecondaryContainer;
      case StatusChipType.info:
        background = theme.colorScheme.primaryContainer;
        foreground = theme.colorScheme.onPrimaryContainer;
      case StatusChipType.neutral:
        background = theme.colorScheme.surfaceContainerHighest;
        foreground = theme.colorScheme.onSurfaceVariant;
    }

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusFull),
        ),
        child: Text(
          label,
          style: ASHATypography.labelMD.copyWith(
            color: foreground,
            fontSize: 11,
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: foreground,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: ASHATypography.labelMD.copyWith(color: foreground),
          ),
        ],
      ),
    );
  }
}
