import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'health_record_model.dart';
import 'health_records_repository.dart';

/// Full view of one health record with its measured values.
class RecordDetailScreen extends ConsumerStatefulWidget {
  const RecordDetailScreen({super.key, required this.recordId});

  final String recordId;

  @override
  ConsumerState<RecordDetailScreen> createState() => _RecordDetailScreenState();
}

class _RecordDetailScreenState extends ConsumerState<RecordDetailScreen> {
  HealthRecordModel? _record;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final record =
        await ref.read(healthRecordsRepositoryProvider).fetchById(widget.recordId);
    if (mounted) setState(() {
      _record = record;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final record = _record;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: record?.typeLabel ?? 'Record',
        onBack: () => context.pop(),
      ),
      body: _loading || record == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ASHACard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(record.title, style: ASHATypography.titleLarge),
                      const SizedBox(height: ASHASpacing.stackSM),
                      Text(record.summary, style: ASHATypography.bodyMD),
                      const SizedBox(height: ASHASpacing.stackMD),
                      _InfoRow(icon: Icons.location_on_outlined, label: 'Facility', value: record.facilityName.isEmpty ? '—' : record.facilityName),
                      _InfoRow(icon: Icons.person_outline, label: 'Provider', value: record.providerName.isEmpty ? '—' : record.providerName),
                      _InfoRow(icon: Icons.calendar_today_outlined, label: 'Date', value: formatDate(record.recordedAt ?? DateTime.now())),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                if (record.values.isNotEmpty) ...[
                  ASHASectionHeader(title: 'Measurements'),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHACard(
                    child: Column(
                      children: [
                        for (final entry in record.values.entries)
                          _InfoRow(
                            icon: Icons.circle,
                            label: entry.key,
                            value: entry.value.toString(),
                          ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: ASHASpacing.stackMD),
                if (record.shareable) ...[
                  ASHAButton(
                    label: 'Share record',
                    icon: Icons.share_outlined,
                    variant: ASHAButtonVariant.outline,
                    onPressed: () => context.push('/records/${record.id}/share'),
                  ),
                  const SizedBox(height: ASHASpacing.stackSM),
                ],
                ASHAButton(
                  label: 'Download PDF',
                  icon: Icons.download_outlined,
                  variant: ASHAButtonVariant.outline,
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Download queued')),
                    );
                  },
                ),
              ],
            ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 14, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Text(label, style: ASHATypography.bodySmall.copyWith(
                color: theme.colorScheme.onSurfaceVariant)),
          ),
          Expanded(
            child: Text(value, style: ASHATypography.bodyMD, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}
