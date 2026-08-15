import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'health_record_model.dart';
import 'health_records_repository.dart';

/// Health records grouped by type.
class RecordsScreen extends ConsumerStatefulWidget {
  const RecordsScreen({super.key});

  @override
  ConsumerState<RecordsScreen> createState() => _RecordsScreenState();
}

class _RecordsScreenState extends ConsumerState<RecordsScreen> {
  List<HealthRecordModel> _records = [];
  bool _loading = true;
  String _typeFilter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final records = await ref.read(healthRecordsRepositoryProvider).fetchRecords();
    if (mounted) setState(() {
      _records = records;
      _loading = false;
    });
  }

  List<HealthRecordModel> get _filtered {
    if (_typeFilter == 'all') return _records;
    return _records.where((r) => r.type == _typeFilter).toList();
  }

  static const _typeFilters = ['all', 'anc', 'growth', 'immunization', 'lab', 'ncd'];

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    return Scaffold(
      appBar: ASHATopAppBar(title: 'Health Records'),
      body: Column(
        children: [
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                  horizontal: ASHASpacing.gutter, vertical: ASHASpacing.stackSM),
              children: [
                for (final type in _typeFilters)
                  Padding(
                    padding: const EdgeInsets.only(right: ASHASpacing.stackSM),
                    child: FilterChip(
                      label: Text(type == 'all' ? 'All' : capitalize(type)),
                      selected: _typeFilter == type,
                      onSelected: (_) => setState(() => _typeFilter = type),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                    ? const ASHAEmptyState(
                        icon: Icons.folder_open_outlined,
                        title: 'No records found',
                        message: 'Records will appear here once added by your ASHA or PHC.',
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(ASHASpacing.gutter),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final record = filtered[index];
                            return _RecordTile(
                              record: record,
                              onTap: () => context.push('/records/${record.id}'),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({required this.record, required this.onTap});

  final HealthRecordModel record;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final icon = switch (record.type) {
      'anc' => Icons.pregnant_woman_outlined,
      'growth' => Icons.monitor_weight_outlined,
      'immunization' => Icons.vaccines_outlined,
      'lab' => Icons.biotech_outlined,
      'ncd' => Icons.monitor_heart_outlined,
      _ => Icons.description_outlined,
    };

    return ASHACard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
            ),
            child: Icon(icon, color: theme.colorScheme.primary),
          ),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(record.title, style: ASHATypography.titleMedium),
                const SizedBox(height: 2),
                Text(
                  '${record.typeLabel} · ${formatDate(record.recordedAt ?? DateTime.now())}',
                  style: ASHATypography.bodySmall.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: ASHASpacing.stackSM),
          StatusChip(
            status: statusChipTypeFrom(record.status),
            label: record.status,
            compact: true,
          ),
        ],
      ),
    );
  }
}
